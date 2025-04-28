import traceback
from typing import Any, Dict, List, cast

from flask_socketio import SocketIO
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson.objectid import ObjectId, InvalidId # Import InvalidId for error handling
from datetime import datetime, timezone
import os

from app import mongo
from app.config import app_config
from app.utils.helpers import serialize_document # Use the helper
socketio = SocketIO()

messages_bp = Blueprint('messages', __name__)

@messages_bp.route('/', methods=['POST'])
@jwt_required()
def create_message():
    user_id = get_jwt_identity()
    claims = get_jwt()
    data = request.get_json()

    # Validate required fields
    if 'content' not in data:
        return jsonify({'error': 'Message content is required'}), 400
    if 'recipient_type' not in data:
        return jsonify({'error': 'Recipient type is required'}), 400

    # Validate recipient type
    valid_recipient_types = ['ministry', 'camp', 'user']
    if data['recipient_type'] not in valid_recipient_types:
        return jsonify({'error': 'Invalid recipient type'}), 400

    # Further validations based on recipient type
    if data['recipient_type'] in ['camp', 'user'] and 'recipient_id' not in data:
        return jsonify({'error': 'Recipient ID is required for camp or user messages'}), 400

    # Check permissions for announcements
    if data.get('is_announcement', False) and claims.get('role') not in ['super_admin', 'camp_leader']:
        return jsonify({'error': 'Only administrators can create announcements'}), 403

    # Check if sending to valid camp
    if data['recipient_type'] == 'camp':
        camp_id = ObjectId(data['recipient_id'])
        camp = mongo.db.camps.find_one({'_id': camp_id})
        if not camp:
            return jsonify({'error': 'Camp not found'}), 404

        # Regular members can only send to their own camp
        if claims.get('role') not in ['super_admin', 'camp_leader']:
            user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
            if not user or str(user.get('camp_id')) != data['recipient_id']:
                return jsonify({'error': 'You can only send messages to your own camp'}), 403

    # Check if sending to valid user
    if data['recipient_type'] == 'user':
        recipient = mongo.db.users.find_one({'_id': ObjectId(data['recipient_id'])})
        if not recipient:
            return jsonify({'error': 'Recipient user not found'}), 404

    temp_id = data.get('tempId')
    # Create message document
    new_message = {
        'content': data['content'],
        'sender_id': ObjectId(user_id),
        'recipient_type': data['recipient_type'],
        'recipient_id': ObjectId(data['recipient_id']) if data['recipient_type'] in ['camp', 'user'] else None,
        'message_type': data.get('message_type', 'text'),
        'attachment_urls': data.get('attachment_urls', []),
        'is_announcement': data.get('is_announcement', False),
        'created_at': datetime.now(timezone.utc),
        'is_deleted': False,
        'read_by': []
    }

    result = mongo.db.messages.insert_one(new_message)

    if result.inserted_id:
        message_id = str(result.inserted_id)

        # Include the temp_id in response if it was provided
        response_data = {
            'message': 'Message sent successfully',
            'message_id': message_id
        }

        if temp_id:
            response_data['tempId'] = temp_id

            # Emit a message confirmation event
            from app.services.socket_service import emit_to_room

            confirmation_data = {
                'tempId': temp_id,
                'message_id': message_id,
                'sender_id': user_id,
                'recipient_id': data['recipient_id']
            }

            socketio.emit('message_confirmed', confirmation_data, room=f"user_{user_id}")
            if data['recipient_type'] == 'user':
                socketio.emit('message_confirmed', confirmation_data, room=f"user_{data['recipient_id']}")

            # Send to both the sender and recipient
            # emit_to_room('message_confirmed', confirmation_data, room=f"user_{user_id}")
            # if data['recipient_type'] == 'user':
            #     emit_to_room('message_confirmed', confirmation_data, room=f"user_{data['recipient_id']}")

            sender = mongo.db.users.find_one(
                {'_id': ObjectId(user_id)},
                {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
            )

            # Format message for socket delivery
            message_response = {
                'message_id': message_id,
                'tempId': temp_id,
                'content': data['content'],
                'sender_id': user_id,
                'recipient_type': data['recipient_type'],
                'recipient_id': data['recipient_id'],
                'created_at': new_message['created_at'].isoformat(),
                'read_by': [],
                'sender': {
                    'id': user_id,
                    'first_name': sender['first_name'],
                    'last_name': sender['last_name'],
                    'profile_image': sender.get('profile_image', None)
                }
            }

            # Emit to recipient
            if data['recipient_type'] == 'user':
                socketio.emit('new_message', message_response, room=f"user_{data['recipient_id']}")
                # Also emit to sender to ensure they see it too
                socketio.emit('new_message', message_response, room=f"user_{user_id}")

        return jsonify(response_data), 201
    else:
        return jsonify({'error': 'Failed to send message'}), 500

@messages_bp.route('/', methods=['GET'])
@jwt_required()
def get_messages():
    try: # Wrap the whole route in a try...except
        user_id_str = get_jwt_identity()
        claims = get_jwt()
        user_role = claims.get('role', 'member')
        user_camp_id_str = claims.get('camp_id')

        try:
            user_id = ObjectId(user_id_str)
            user_camp_id = ObjectId(user_camp_id_str) if user_camp_id_str else None
        except InvalidId:
            return jsonify({'error': 'Invalid user or camp ID format in token'}), 400

        # --- Fetch Current User Once ---
        # Needed to determine camp membership for filtering if not in claims reliably
        current_user = mongo.db.users.find_one({'_id': user_id})
        if not current_user:
             # This shouldn't happen if JWT is valid, but handle defensively
             return jsonify({'error': 'Authenticated user not found in database'}), 404
        # Use camp_id from the database record as the source of truth
        user_camp_id = current_user.get('camp_id')


        # --- Pagination ---
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50)) # Increase default for conversation view
        limit = int(request.args.get('limit', per_page))
        skip = (page - 1) * limit

        # --- Build Filters ---
        filters: Dict[str, Any] = {'is_deleted': False}
        message_type_filter = request.args.get('type')

        # Define base conditions for what the user can generally access
        accessible_conditions = [
            # Personal messages TO the user
            {'recipient_type': 'user', 'recipient_id': user_id},
            # Personal messages FROM the user
            {'recipient_type': 'user', 'sender_id': user_id},
             # Ministry-wide messages
            {'recipient_type': 'ministry'}
        ]
        if user_camp_id:
             # Camp messages for the user's camp
            accessible_conditions.append({'recipient_type': 'camp', 'recipient_id': user_camp_id})

        # Apply type-specific filters OR default access filters
        if message_type_filter == 'personal':
            partner_id_str = request.args.get('partner_id')
            if partner_id_str:
                try:
                    partner_id = ObjectId(partner_id_str)
                    # Specific conversation
                    filters['$or'] = [
                        {'recipient_type': 'user', 'recipient_id': user_id, 'sender_id': partner_id},
                        {'recipient_type': 'user', 'recipient_id': partner_id, 'sender_id': user_id}
                    ]
                except InvalidId:
                    return jsonify({'error': 'Invalid partner ID format'}), 400
            else:
                 # All personal messages
                 filters['$or'] = [
                    {'recipient_type': 'user', 'recipient_id': user_id},
                    {'recipient_type': 'user', 'sender_id': user_id}
                 ]
        elif message_type_filter == 'camp':
             if user_camp_id:
                 filters['recipient_type'] = 'camp'
                 filters['recipient_id'] = user_camp_id
             else: # User not in a camp, cannot fetch camp messages specifically
                  return jsonify({'messages': [], 'total': 0, 'page': page, 'per_page': limit, 'pages': 0}), 200
        elif message_type_filter == 'ministry':
            filters['recipient_type'] = 'ministry'
        elif message_type_filter == 'sent':
             filters['sender_id'] = user_id
        else:
             # Default: No type specified, fetch all accessible
            filters['$or'] = accessible_conditions

        # --- Additional Filters ---
        if 'announcements_only' in request.args and request.args['announcements_only'].lower() == 'true':
            filters['is_announcement'] = True
        # ... (Add date filters as before if needed) ...
        if 'from_date' in request.args:
            try:
                from_date = datetime.fromisoformat(request.args['from_date'])
                filters.setdefault('created_at', {})['$gte'] = from_date
            except ValueError: pass # Ignore invalid date
        if 'to_date' in request.args:
            try:
                to_date = datetime.fromisoformat(request.args['to_date'])
                filters.setdefault('created_at', {})['$lte'] = to_date
            except ValueError: pass # Ignore invalid date


        # --- Execute Query ---
        print(f"DEBUG: Messages query filters: {filters}") # Log filters
        total = mongo.db.messages.count_documents(filters)
        messages_cursor = mongo.db.messages.find(filters).sort(
            'created_at', -1
        ).skip(skip).limit(limit)

        # --- Process Results ---
        messages_list = []
        user_cache = {} # Simple cache for user details

        def get_user_details(uid_str):
            if not uid_str: return None
            if uid_str in user_cache: return user_cache[uid_str]
            try:
                details = mongo.db.users.find_one(
                    {'_id': ObjectId(uid_str)},
                    {'first_name': 1, 'last_name': 1, 'profile_image': 1}
                )
                user_cache[uid_str] = serialize_document(details) if details else None
                return user_cache[uid_str]
            except InvalidId:
                return None

        for msg_doc in messages_cursor:
            serialized_msg_data= serialize_document(msg_doc)

            if not isinstance(serialized_msg_data, dict):
                # Should not happen if coming from MongoDB, but good practice
                print(f"Warning: Skipping message doc that didn't serialize to dict: {msg_doc.get('_id')}")
                continue
            msg: Dict[str, Any] = cast(Dict[str, Any], serialized_msg_data)

            msg['sender'] = get_user_details(msg.get('sender_id'))

            if msg['recipient_type'] == 'user' and msg.get('recipient_id'):
                msg['recipient'] = get_user_details(msg.get('recipient_id'))
            elif msg['recipient_type'] == 'camp' and msg.get('recipient_id'):
                camp_info = mongo.db.camps.find_one({'_id': ObjectId(msg['recipient_id'])}, {'name': 1})
                if camp_info:
                    msg['recipient'] = {'name': camp_info.get('name', 'Unknown Camp')}
                    msg['camp_name'] = camp_info.get('name')

            # Read status needs ObjectId comparison
            msg['is_read'] = user_id in msg_doc.get('read_by', [])
            msg['read_by'] = [str(uid) for uid in msg_doc.get('read_by', [])] # Keep string list for frontend

            messages_list.append(msg)

        return jsonify({
            'messages': messages_list,
            'total': total,
            'page': page,
            'per_page': limit,
            'pages': (total + limit - 1) // limit
        }), 200

    except Exception as e:
        print(f"ERROR in get_messages: {e}")
        traceback.print_exc()
        return jsonify({'error': 'An internal server error occurred'}), 500

@messages_bp.route('/<message_id>', methods=['GET'])
@jwt_required()
def get_message(message_id):
    user_id = get_jwt_identity()

    message = mongo.db.messages.find_one({'_id': ObjectId(message_id)})

    if not message:
        return jsonify({'error': 'Message not found'}), 404

    # Check if user has access to this message
    can_access = False

    # Ministry-wide messages are accessible to all
    if message['recipient_type'] == 'ministry':
        can_access = True

    # Camp messages are accessible to camp members
    elif message['recipient_type'] == 'camp':
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        can_access = user and user.get('camp_id') == message['recipient_id']

    # Personal messages are accessible to sender and recipient
    elif message['recipient_type'] == 'user':
        can_access = (
            str(message['sender_id']) == user_id or
            str(message['recipient_id']) == user_id
        )

    if not can_access:
        return jsonify({'error': 'Unauthorized access to this message'}), 403

    # Mark as read if not already
    if ObjectId(user_id) not in message.get('read_by', []):
        mongo.db.messages.update_one(
            {'_id': ObjectId(message_id)},
            {'$addToSet': {'read_by': ObjectId(user_id)}}
        )

    # Format response
    message['_id'] = str(message['_id'])
    message['sender_id'] = str(message['sender_id'])
    if 'recipient_id' in message and message['recipient_id']:
        message['recipient_id'] = str(message['recipient_id'])

    # Add sender information
    sender = mongo.db.users.find_one(
        {'_id': ObjectId(message['sender_id'])},
        {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
    )
    if sender:
        sender['_id'] = str(sender['_id'])
        message['sender'] = sender

    # Add recipient information for personal messages
    if message['recipient_type'] == 'user':
        recipient = mongo.db.users.find_one(
            {'_id': ObjectId(message['recipient_id'])},
            {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
        )
        if recipient:
            recipient['_id'] = str(recipient['_id'])
            message['recipient'] = recipient

    # Add camp information for camp messages
    if message['recipient_type'] == 'camp':
        camp = mongo.db.camps.find_one({'_id': message['recipient_id']})
        if camp:
            camp['_id'] = str(camp['_id'])
            message['recipient'] = {'name': camp['name']}

    message['read_by'] = [str(uid) for uid in message.get('read_by', [])]
    message['is_read'] = ObjectId(user_id) in message.get('read_by', [])

    return jsonify({'message': message}), 200

@messages_bp.route('/<message_id>', methods=['DELETE'])
@jwt_required()
def delete_message(message_id):
    user_id = get_jwt_identity()
    claims = get_jwt()

    message = mongo.db.messages.find_one({'_id': ObjectId(message_id)})

    if not message:
        return jsonify({'error': 'Message not found'}), 404

    # Check if user can delete this message
    can_delete = str(message['sender_id']) == user_id

    # Admins can delete any message in their domain
    if claims.get('role') == 'super_admin':
        can_delete = True
    elif claims.get('role') == 'camp_leader':
        # Camp leaders can delete messages in their camp
        if message['recipient_type'] == 'camp':
            user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
            can_delete = user and str(user.get('camp_id')) == str(message['recipient_id'])

    if not can_delete:
        return jsonify({'error': 'Unauthorized to delete this message'}), 403

    # Soft delete
    result = mongo.db.messages.update_one(
        {'_id': ObjectId(message_id)},
        {'$set': {'is_deleted': True}}
    )

    if result.modified_count:
        return jsonify({'message': 'Message deleted successfully'}), 200
    else:
        return jsonify({'error': 'Failed to delete message'}), 500

@messages_bp.route('/<message_id>/read', methods=['POST'])
@jwt_required()
def mark_as_read(message_id):
    user_id = get_jwt_identity()

    message = mongo.db.messages.find_one({'_id': ObjectId(message_id)})

    if not message:
        return jsonify({'error': 'Message not found'}), 404

    # Check if user has access to this message
    can_access = False

    # Ministry-wide messages are accessible to all
    if message['recipient_type'] == 'ministry':
        can_access = True

    # Camp messages are accessible to camp members
    elif message['recipient_type'] == 'camp':
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        can_access = user and user.get('camp_id') == message['recipient_id']

    # Personal messages are accessible to sender and recipient
    elif message['recipient_type'] == 'user':
        can_access = (
            str(message['sender_id']) == user_id or
            str(message['recipient_id']) == user_id
        )

    if not can_access:
        return jsonify({'error': 'Unauthorized access to this message'}), 403

    # Mark as read
    result = mongo.db.messages.update_one(
        {'_id': ObjectId(message_id)},
        {'$addToSet': {'read_by': ObjectId(user_id)}}
    )

    return jsonify({'message': 'Message marked as read'}), 200

@messages_bp.route('/attachment', methods=['POST'])
@jwt_required()
def upload_attachment():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Check file type
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'mp3', 'mp4'}
    if '.' not in file.filename or file.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
        return jsonify({'error': 'File type not allowed'}), 400

    # Create a secure filename
    from werkzeug.utils import secure_filename
    filename = secure_filename(file.filename)

    # Add timestamp to filename to make it unique
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{timestamp}_{filename}"

    # Save file
    file_path = os.path.join(app_config.UPLOAD_FOLDER, filename)
    file.save(file_path)

    # Generate URL for the file
    file_url = f"/uploads/{filename}"

    return jsonify({
        'message': 'File uploaded successfully',
        'file_url': file_url
    }), 201
