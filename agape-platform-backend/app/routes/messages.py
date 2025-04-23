from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson.objectid import ObjectId
from datetime import datetime, timezone
import os

from app import mongo
from app.config import app_config

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

    # Prepare message document
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
        return jsonify({
            'message': 'Message sent successfully',
            'message_id': str(result.inserted_id)
        }), 201
    else:
        return jsonify({'error': 'Failed to send message'}), 500

@messages_bp.route('/', methods=['GET'])
@jwt_required()
def get_messages():
    user_id = get_jwt_identity()
    claims = get_jwt()

    # Determine which messages the user can access
    filters = {'is_deleted': False}

    # Message type filters
    message_type = request.args.get('type')
    if message_type == 'ministry':
        filters['recipient_type'] = 'ministry'
    elif message_type == 'camp':
        # Get user's camp
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        if not user or not user.get('camp_id'):
            return jsonify({'error': 'User not assigned to any camp'}), 400

        filters['recipient_type'] = 'camp'
        filters['recipient_id'] = user['camp_id']
    elif message_type == 'personal':
        filters['$or'] = [
            {'recipient_type': 'user', 'recipient_id': ObjectId(user_id)},
            {'recipient_type': 'user', 'sender_id': ObjectId(user_id)}
        ]
    elif message_type == 'sent':
        filters['sender_id'] = ObjectId(user_id)

    # Optional filtering by conversation partner for personal messages
    if message_type == 'personal' and 'partner_id' in request.args:
        partner_id = ObjectId(request.args['partner_id'])
        filters['$or'] = [
            {'recipient_type': 'user', 'recipient_id': ObjectId(user_id), 'sender_id': partner_id},
            {'recipient_type': 'user', 'recipient_id': partner_id, 'sender_id': ObjectId(user_id)}
        ]

    # Announcement filter
    if 'announcements_only' in request.args and request.args['announcements_only'].lower() == 'true':
        filters['is_announcement'] = True

    # Date range filtering
    if 'from_date' in request.args:
        try:
            from_date = datetime.fromisoformat(request.args['from_date'])
            filters['created_at'] = {'$gte': from_date}
        except ValueError:
            pass

    if 'to_date' in request.args:
        try:
            to_date = datetime.fromisoformat(request.args['to_date'])
            if 'created_at' in filters:
                filters['created_at']['$lte'] = to_date
            else:
                filters['created_at'] = {'$lte': to_date}
        except ValueError:
            pass

    # Pagination
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    skip = (page - 1) * per_page

    # Execute query
    total = mongo.db.messages.count_documents(filters)
    messages_cursor = mongo.db.messages.find(filters).sort(
        'created_at', -1  # Sort by newest first
    ).skip(skip).limit(per_page)

    # Process results
    messages = []
    for msg in messages_cursor:
        msg['_id'] = str(msg['_id'])
        msg['sender_id'] = str(msg['sender_id'])
        if 'recipient_id' in msg and msg['recipient_id']:
            msg['recipient_id'] = str(msg['recipient_id'])

        # Add sender information
        sender = mongo.db.users.find_one(
            {'_id': ObjectId(msg['sender_id'])},
            {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
        )
        if sender:
            sender['_id'] = str(sender['_id'])
            msg['sender'] = sender

        # Add read status for current user
        msg['is_read'] = ObjectId(user_id) in msg.get('read_by', [])
        msg['read_by'] = [str(uid) for uid in msg.get('read_by', [])]

        messages.append(msg)

    return jsonify({
        'messages': messages,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }), 200

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
