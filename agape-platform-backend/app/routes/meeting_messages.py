from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson.objectid import ObjectId
from datetime import datetime, timezone

from app import mongo
from app.services.socket_service import emit_to_room

meeting_messages_bp = Blueprint('meeting_messages', __name__)
"""Blueprint for managing in-meeting communication: chat messages during live meetings."""

@meeting_messages_bp.route('/<meeting_id>/messages', methods=['GET'])
@jwt_required()
def get_meeting_messages(meeting_id):
    """Get messages for a specific meeting"""
    user_id = get_jwt_identity()

    # Check if meeting exists
    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})
    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    # Check if user has access to meeting
    # For simplicity, anyone who can view the meeting can see its messages

    # Pagination
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))  # More messages per page for chat
    skip = (page - 1) * per_page

    # Get messages for this meeting
    messages = mongo.db.meeting_messages.find(
        {'meeting_id': ObjectId(meeting_id)}
    ).sort('created_at', 1).skip(skip).limit(per_page)

    # Process results
    result = []
    for msg in messages:
        msg['_id'] = str(msg['_id'])
        msg['user_id'] = str(msg['user_id'])
        msg['meeting_id'] = str(msg['meeting_id'])

        # Add user info
        user = mongo.db.users.find_one(
            {'_id': ObjectId(msg['user_id'])},
            {'first_name': 1, 'last_name': 1, 'profile_image': 1}
        )
        if user:
            msg['user'] = {
                'id': str(user['_id']),
                'name': f"{user['first_name']} {user['last_name']}",
                'profile_image': user.get('profile_image')
            }

        # Format date
        if 'created_at' in msg:
            msg['created_at'] = msg['created_at'].isoformat()

        result.append(msg)

    # Get total count
    total = mongo.db.meeting_messages.count_documents({'meeting_id': ObjectId(meeting_id)})

    return jsonify({
        'messages': result,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }), 200

@meeting_messages_bp.route('/<meeting_id>/messages', methods=['POST'])
@jwt_required()
def create_meeting_message(meeting_id):
    """Create a new message in a meeting"""
    user_id = get_jwt_identity()
    data = request.get_json()

    # Check if meeting exists and is active
    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})
    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    if meeting['status'] != 'in_progress':
        return jsonify({'error': 'Cannot send message to a meeting that is not in progress'}), 400

    # Basic validation
    if 'content' not in data:
        return jsonify({'error': 'Message content is required'}), 400

    # Create message
    new_message = {
        'content': data['content'],
        'user_id': ObjectId(user_id),
        'meeting_id': ObjectId(meeting_id),
        'message_type': data.get('message_type', 'text'),
        'attachment_urls': data.get('attachment_urls', []),
        'created_at': datetime.now(timezone.utc)
    }

    result = mongo.db.meeting_messages.insert_one(new_message)

    if result.inserted_id:
        # Get user info for response
        user = mongo.db.users.find_one(
            {'_id': ObjectId(user_id)},
            {'first_name': 1, 'last_name': 1, 'profile_image': 1}
        )

        # Format response
        response = {
            'message_id': str(result.inserted_id),
            'content': new_message['content'],
            'user_id': user_id,
            'meeting_id': meeting_id,
            'message_type': new_message['message_type'],
            'attachment_urls': new_message['attachment_urls'],
            'created_at': new_message['created_at'].isoformat(),
            'user': {
                'id': user_id,
                'name': f"{user['first_name']} {user['last_name']}",
                'profile_image': user.get('profile_image')
            }
        }

        # Emit via WebSocket
        emit_to_room('new_meeting_message', response, room=f"meeting_{meeting_id}")

        return jsonify({
            'message': 'Message sent successfully',
            'message_id': str(result.inserted_id),
            'data': response
        }), 201
    else:
        return jsonify({'error': 'Failed to send message'}), 500
