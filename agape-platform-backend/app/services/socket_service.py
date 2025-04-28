from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import decode_token
from flask import request
from app import mongo
from bson import ObjectId
import json
from datetime import datetime, timezone
from app.utils.helpers import serialize_document
from typing import Any, Optional

# Initialize SocketIO
socketio = SocketIO()

def emit_to_room(event: str, data: Any, room: str, include_self: Optional[bool] = None) -> None:
    """Wrapper for socketio.emit with proper type hints for room parameter."""
    socketio.emit(event, data, room=room, include_self=include_self)  # type: ignore

# Store active users
active_users = {}

def configure_socket(app):
    """Configure socket events and initialize with app"""
    socketio.init_app(app, cors_allowed_origins="*")

    @socketio.on('connect')
    def handle_connect():
        """Handle client connection"""
        print("Client connected")

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        sid = request.sid

        # Remove user from active users
        user_id = None
        for uid, session_data in active_users.items():
            if sid in session_data['sessions']:
                user_id = uid
                session_data['sessions'].remove(sid)

                # If no more sessions, mark user as offline
                if not session_data['sessions']:
                    session_data['status'] = 'offline'
                    # Broadcast user status change
                    emit('user_status_change', {
                        'user_id': user_id,
                        'status': 'offline'
                    }, broadcast=True)
                break

        print(f"Client disconnected: {sid}, User: {user_id}")

    @socketio.on('authenticate')
    def handle_authentication(data):
        """Authenticate user with JWT token"""
        token = data.get('token')
        if not token:
            emit('authentication_error', {'message': 'No token provided'})
            return

        try:
            # Decode JWT token
            decoded_token = decode_token(token)
            user_id = decoded_token['sub']  # Subject is the user ID

            # Get user info
            user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
            if not user:
                emit('authentication_error', {'message': 'User not found'})
                return

            # Join user to their personal room
            join_room(f"user_{user_id}")

            # Join camp room if user belongs to a camp
            if user.get('camp_id'):
                camp_id = str(user['camp_id'])
                join_room(f"camp_{camp_id}")

            # Join ministry-wide room
            join_room("ministry")

            # Store user in active users
            if user_id in active_users:
                active_users[user_id]['sessions'].add(request.sid)
                active_users[user_id]['status'] = 'online'
            else:
                active_users[user_id] = {
                    'sessions': {request.sid},
                    'status': 'online',
                    'user_info': {
                        'id': user_id,
                        'name': f"{user['first_name']} {user['last_name']}",
                        'role': user.get('role', 'member'),
                        'profile_image': user.get('profile_image')
                    }
                }

            # Get unread notifications count
            unread_count = mongo.db.notifications.count_documents({
                'user_id': ObjectId(user_id),
                'is_read': False
            })

            # Broadcast user status change to others
            emit('user_status_change', {
                'user_id': user_id,
                'status': 'online'
            }, broadcast=True, include_self=False)

            # Emit success event to the user
            emit('authenticated', {
                'user_id': user_id,
                'status': 'online',
                'unread_notifications': unread_count
            })

            print(f"User authenticated: {user_id}")

        except Exception as e:
            print(f"Authentication error: {str(e)}")
            emit('authentication_error', {'message': str(e)})

    @socketio.on('join_meeting')
    def handle_join_meeting(data):
        """Join a meeting room"""
        meeting_id = data.get('meeting_id')
        user_id = data.get('user_id')

        if not meeting_id or not user_id:
            emit('error', {'message': 'Meeting ID and User ID required'})
            return

        # Join the meeting room
        meeting_room = f"meeting_{meeting_id}"
        join_room(meeting_room)

        # Update meeting attendees in database
        mongo.db.meetings.update_one(
            {'_id': ObjectId(meeting_id)},
            {'$addToSet': {'attendees': ObjectId(user_id)}}
        )

        # Get user info to broadcast to meeting participants
        user = mongo.db.users.find_one(
            {'_id': ObjectId(user_id)},
            {'first_name': 1, 'last_name': 1, 'profile_image': 1}
        )

        # Notify other meeting participants
        emit_to_room('user_joined_meeting', {
            'user_id': user_id,
            'meeting_id': meeting_id,
            'user_name': f"{user['first_name']} {user['last_name']}",
            'profile_image': user.get('profile_image'),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=meeting_room, include_self=False)

        print(f"User {user_id} joined meeting {meeting_id}")

    @socketio.on('leave_meeting')
    def handle_leave_meeting(data):
        """Leave a meeting room"""
        meeting_id = data.get('meeting_id')
        user_id = data.get('user_id')

        if not meeting_id or not user_id:
            emit('error', {'message': 'Meeting ID and User ID required'})
            return

        # Leave the meeting room
        meeting_room = f"meeting_{meeting_id}"
        leave_room(meeting_room)

        # Notify other meeting participants
        emit_to_room('user_left_meeting', {
            'user_id': user_id,
            'meeting_id': meeting_id,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=meeting_room)

        print(f"User {user_id} left meeting {meeting_id}")

    @socketio.on('meeting_message')
    def handle_meeting_message(data):
        """Send message within a meeting"""
        meeting_id = data.get('meeting_id')
        user_id = data.get('user_id')
        content = data.get('content')

        if not meeting_id or not user_id or not content:
            emit('error', {'message': 'Meeting ID, User ID and Content required'})
            return

        # Get user info
        user = mongo.db.users.find_one(
            {'_id': ObjectId(user_id)},
            {'first_name': 1, 'last_name': 1, 'profile_image': 1}
        )

        # Create message document
        message = {
            'meeting_id': ObjectId(meeting_id),
            'user_id': ObjectId(user_id),
            'content': content,
            'timestamp': datetime.now(timezone.utc)
        }

        # Store in database
        result = mongo.db.meeting_messages.insert_one(message)

        # Broadcast to meeting room
        meeting_room = f"meeting_{meeting_id}"
        emit_to_room('new_meeting_message', {
            'message_id': str(result.inserted_id),
            'meeting_id': meeting_id,
            'user_id': user_id,
            'user_name': f"{user['first_name']} {user['last_name']}",
            'profile_image': user.get('profile_image'),
            'content': content,
            'timestamp': message['timestamp'].isoformat()
        }, room=meeting_room)

    @socketio.on('new_message')
    def handle_new_message(data):
        """Handle new message from client"""
        content = data.get('content')
        sender_id = data.get('sender_id')
        recipient_type = data.get('recipient_type')
        recipient_id = data.get('recipient_id')
        is_announcement = data.get('is_announcement', False)
        temp_id = data.get('tempId')  # Add tempId handling

        # Validate data
        if not content or not sender_id or not recipient_type:
            emit('error', {'message': 'Incomplete message data'})
            return

        if recipient_type in ['camp', 'user'] and not recipient_id:
            emit('error', {'message': 'Recipient ID required for camp or user messages'})
            return

        # Create message in database using the messages route logic
        new_message = {
            'content': content,
            'sender_id': ObjectId(sender_id),
            'recipient_type': recipient_type,
            'recipient_id': ObjectId(recipient_id) if recipient_type in ['camp', 'user'] else None,
            'message_type': data.get('message_type', 'text'),
            'attachment_urls': data.get('attachment_urls', []),
            'is_announcement': is_announcement,
            'created_at': datetime.now(timezone.utc),
            'is_deleted': False,
            'read_by': []
        }

        result = mongo.db.messages.insert_one(new_message)
        message_id = str(result.inserted_id)

        # Get sender information for the response
        sender = mongo.db.users.find_one(
            {'_id': ObjectId(sender_id)},
            {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
        )

        # Format response message
        response = {
            'message_id': message_id,
            'content': content,
            'sender_id': sender_id,
            'recipient_type': recipient_type,
            'recipient_id': recipient_id if recipient_type in ['camp', 'user'] else None,
            'message_type': new_message['message_type'],
            'attachment_urls': new_message['attachment_urls'],
            'is_announcement': is_announcement,
            'created_at': new_message['created_at'].isoformat(),
            'is_deleted': False,
            'read_by': [],
            'sender': {
                'id': sender_id,
                'first_name': sender['first_name'],
                'last_name': sender['last_name'],
                'profile_image': sender.get('profile_image')
            }
        }

        # Include tempId if it was provided
        if temp_id:
            response['tempId'] = temp_id

        if recipient_type == 'user':
            chat_participants = sorted([sender_id, recipient_id])
            chat_room = f"chat_{chat_participants[0]}_{chat_participants[1]}"

            # Emit to the specific chat room
            print(f"Emitting new_message to chat room: {chat_room}")
            emit_to_room('new_message', response, room=chat_room)

            # Also emit to individual user rooms for notifications when not in chat view
            emit_to_room('new_message', response, room=f"user_{recipient_id}")
            emit_to_room('new_message', response, room=f"user_{sender_id}")
        elif recipient_type == 'ministry':
            emit_to_room('new_message', response, room='ministry')
        elif recipient_type == 'camp':
            emit_to_room('new_message', response, room=f"camp_{recipient_id}")

        # Determine room to broadcast to
        if recipient_type == 'ministry':
            emit_to_room('new_message', response, room='ministry')
        elif recipient_type == 'camp':
            emit_to_room('new_message', response, room=f"camp_{recipient_id}")
        else:  # user-to-user message
            # IMPORTANT: Always send to both sender and recipient rooms
            emit_to_room('new_message', response, room=f"user_{recipient_id}")
            emit_to_room('new_message', response, room=f"user_{sender_id}")

        # Send specific confirmation event with tempId mapping
        if temp_id:
            confirmation_data = {
                'tempId': temp_id,
                'message_id': message_id,
                'sender_id': sender_id,
                'recipient_id': recipient_id
            }
            emit_to_room('message_confirmed', confirmation_data, room=f"user_{sender_id}")
            if recipient_type == 'user':
                emit_to_room('message_confirmed', confirmation_data, room=f"user_{recipient_id}")

    @socketio.on('new_prayer_request')
    def handle_new_prayer_request(data):
        """Handle new prayer request"""
        # This will be processed through the RESTful API,
        # but we'll broadcast to the appropriate room
        prayer_request_id = data.get('prayer_request_id')

        # Get the prayer request from DB
        prayer_request = mongo.db.prayer_requests.find_one({'_id': ObjectId(prayer_request_id)})

        if not prayer_request:
            return

        # Format the prayer request for broadcast
        formatted_request = serialize_document(prayer_request)

        # Skip private requests
        if prayer_request.get('is_private', False):
            return

        # Broadcast to appropriate room
        if prayer_request.get('camp_id'):
            camp_id = str(prayer_request['camp_id'])
            emit_to_room('new_prayer_request', formatted_request, room=f"camp_{camp_id}")
        else:
            # Ministry-wide prayer request
            emit_to_room('new_prayer_request', formatted_request, room="ministry")

    @socketio.on('prayer_request_answered')
    def handle_prayer_answered(data):
        """Handle answered prayer notification"""
        prayer_request_id = data.get('prayer_request_id')
        testimony = data.get('testimony')

        # Get the prayer request
        prayer_request = mongo.db.prayer_requests.find_one({'_id': ObjectId(prayer_request_id)})

        if not prayer_request:
            return

        # Format for broadcast
        formatted_response = {
            'prayer_request_id': prayer_request_id,
            'testimony': testimony,
            'user_id': str(prayer_request['user_id']),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

        # Skip private requests
        if prayer_request.get('is_private', False):
            return

        # Broadcast to appropriate room
        if prayer_request.get('camp_id'):
            camp_id = str(prayer_request['camp_id'])
            emit_to_room('prayer_request_answered', formatted_response, room=f"camp_{camp_id}")
        else:
            # Ministry-wide prayer request
            emit_to_room('prayer_request_answered', formatted_response, room="ministry")

    @socketio.on('set_status')
    def handle_status_change(data):
        """Handle user status change"""
        user_id = data.get('user_id')
        status = data.get('status')  # 'online', 'offline', 'away', 'busy', 'in_meeting'

        if not user_id or not status:
            emit('error', {'message': 'User ID and Status required'})
            return

        # Update user status
        if user_id in active_users:
            active_users[user_id]['status'] = status

            # Broadcast status change to all users
            emit('user_status_change', {
                'user_id': user_id,
                'status': status
            }, broadcast=True)

    @socketio.on('get_active_users')
    def handle_get_active_users():
        """Return list of active users"""
        users_list = []
        for user_id, data in active_users.items():
            if data['status'] != 'offline' and data['sessions']:
                users_list.append({
                    'user_id': user_id,
                    'status': data['status'],
                    'user_info': data['user_info']
                })

        emit('active_users', {'users': users_list})

    @socketio.on('start_meeting')
    def handle_start_meeting(data):
        """Start a meeting and notify participants"""
        meeting_id = data.get('meeting_id')
        host_id = data.get('host_id')

        if not meeting_id or not host_id:
            emit('error', {'message': 'Meeting ID and Host ID required'})
            return

        # Update meeting status in database
        meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})

        if not meeting:
            emit('error', {'message': 'Meeting not found'})
            return

        # Update meeting status
        mongo.db.meetings.update_one(
            {'_id': ObjectId(meeting_id)},
            {'$set': {'status': 'in_progress'}}
        )

        # Format meeting data
        meeting_data = serialize_document(meeting)
        if isinstance(meeting_data, dict):  # Make sure it's a dictionary
            meeting_data['status'] = 'in_progress'
            meeting_data['started_at'] = datetime.now(timezone.utc).isoformat()
        else:
            # Handle the error case or convert to dictionary
            meeting_data = {
                'id': str(meeting['_id']),
                'status': 'in_progress',
                'started_at': datetime.now(timezone.utc).isoformat(),
            }

        # Notify all users who should attend this meeting
        if meeting.get('camp_id'):
            # Camp meeting
            emit_to_room('meeting_started', meeting_data, room=f"camp_{str(meeting['camp_id'])}")
        else:
            # Ministry-wide meeting
            emit_to_room('meeting_started', meeting_data, room="ministry")

    @socketio.on('end_meeting')
    def handle_end_meeting(data):
        """End a meeting and notify participants"""
        meeting_id = data.get('meeting_id')
        host_id = data.get('host_id')
        recording_url = data.get('recording_url')

        if not meeting_id or not host_id:
            emit('error', {'message': 'Meeting ID and Host ID required'})
            return

        # Update meeting status in database
        update_data = {'status': 'completed'}
        if recording_url:
            update_data['recording_url'] = recording_url

        mongo.db.meetings.update_one(
            {'_id': ObjectId(meeting_id)},
            {'$set': update_data}
        )

        meeting_room = f"meeting_{meeting_id}"

        # Notify all participants
        emit_to_room('meeting_ended', {
            'meeting_id': meeting_id,
            'ended_at': datetime.now(timezone.utc).isoformat(),
            'recording_url': recording_url
        }, room=meeting_room)

    @socketio.on('typing')
    def handle_typing(data):
        """Broadcast that a user is typing"""
        user_id = data.get('user_id')
        conversation_type = data.get('conversation_type')  # 'meeting', 'direct', 'camp'
        conversation_id = data.get('conversation_id')  # meeting_id, user_id, or camp_id

        if not user_id or not conversation_type or not conversation_id:
            return

        # Determine room to broadcast to
        room = None
        if conversation_type == 'meeting':
            room = f"meeting_{conversation_id}"
        elif conversation_type == 'direct':
            room = f"user_{conversation_id}"
        elif conversation_type == 'camp':
            room = f"camp_{conversation_id}"

        if room:
            socketio.emit('user_typing', {
                'user_id': user_id,
                'conversation_type': conversation_type,
                'conversation_id': conversation_id,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, room=room, include_self=False) # type: ignore

    @socketio.on('new_notification')
    def handle_new_notification(data):
        """Send a notification to a user"""
        user_id = data.get('user_id')
        title = data.get('title')
        body = data.get('body')

        if not user_id or not title or not body:
            return

        # Send notification to specific user
        emit('notification', {
            'title': title,
            'body': body,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=f"user_{user_id}")  # type: ignore

    @socketio.on('join_chat')
    def handle_join_chat(data):
        """Join a user-to-user chat room"""
        user_id = data.get('user_id')
        partner_id = data.get('partner_id')

        if not user_id or not partner_id:
            emit('error', {'message': 'User ID and Partner ID required'})
            return

        # Create a consistent room name for this conversation
        # Sort IDs to ensure same room regardless of who joins
        chat_participants = sorted([user_id, partner_id])
        chat_room = f"chat_{chat_participants[0]}_{chat_participants[1]}"

        join_room(chat_room)
        print(f"User {user_id} joined chat room with {partner_id}: {chat_room}")

        # Emit confirmation
        emit('chat_joined', {
            'room': chat_room,
            'user_id': user_id,
            'partner_id': partner_id
        })

    @socketio.on('leave_chat')
    def handle_leave_chat(data):
        """Leave a user-to-user chat room"""
        user_id = data.get('user_id')
        partner_id = data.get('partner_id')

        if not user_id or not partner_id:
            emit('error', {'message': 'User ID and Partner ID required'})
            return

        # Create consistent room name
        chat_participants = sorted([user_id, partner_id])
        chat_room = f"chat_{chat_participants[0]}_{chat_participants[1]}"

        leave_room(chat_room)
        print(f"User {user_id} left chat room with {partner_id}: {chat_room}")

    return socketio
