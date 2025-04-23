from app import mongo
from bson import ObjectId
from datetime import datetime, timezone
from app.services.socket_service import socketio

# In a real implementation, this would connect to FCM, APNS, etc.
# For now, we'll simulate notification storage in the database

def send_meeting_notification(meeting_id, event_type, new_status=None):
    """
    Send notifications about meeting events

    Args:
        meeting_id: ID of the meeting
        event_type: Type of event ('created', 'rescheduled', 'cancelled', etc.)
        new_status: New status of the meeting if changed
    """
    # Get meeting details
    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})
    if not meeting:
        return False

    # Determine recipients
    recipients = []

    # For ministry-wide meetings, notify all active users
    if not meeting.get('camp_id'):
        users_cursor = mongo.db.users.find(
            {'is_active': True},
            {'_id': 1}
        )
        recipients = [user['_id'] for user in users_cursor]

    # For camp meetings, notify camp members
    else:
        users_cursor = mongo.db.users.find(
            {'camp_id': meeting['camp_id'], 'is_active': True},
            {'_id': 1}
        )
        recipients = [user['_id'] for user in users_cursor]

    # Prepare notification title and body
    title = f"Meeting Update: {meeting['title']}"
    body = ""

    if event_type == 'created':
        body = f"New meeting scheduled for {meeting['scheduled_start'].strftime('%B %d at %I:%M %p')}"
    elif event_type == 'rescheduled':
        body = f"Meeting rescheduled to {meeting['scheduled_start'].strftime('%B %d at %I:%M %p')}"
    elif event_type == 'cancelled':
        body = f"Meeting cancelled: {meeting['title']}"
    elif event_type == 'started':
        body = f"Meeting in progress: {meeting['title']}"
    elif event_type == 'ended':
        body = f"Meeting has ended: {meeting['title']}"
    elif event_type == 'status_changed' and new_status:
        body = f"Meeting status updated to {new_status}: {meeting['title']}"
    elif event_type == 'reminder':
        body = f"Meeting starts soon: {meeting['title']} at {meeting['scheduled_start'].strftime('%I:%M %p')}"

    # Create notifications in DB
    notifications = []
    for recipient_id in recipients:
        notification = {
            'user_id': recipient_id,
            'title': title,
            'body': body,
            'related_type': 'meeting',
            'related_id': meeting['_id'],
            'created_at': datetime.now(timezone.utc),
            'is_read': False
        }
        notifications.append(notification)

    if notifications:
        result = mongo.db.notifications.insert_many(notifications)

        # Send real-time notifications via WebSocket
        notification_data = {
            'title': title,
            'body': body,
            'meeting_id': str(meeting['_id']),
            'event_type': event_type,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

        # Send to ministry or camp room
        if not meeting.get('camp_id'):
            socketio.emit('meeting_notification', notification_data, room='ministry')
        else:
            camp_id = str(meeting['camp_id'])
            socketio.emit('meeting_notification', notification_data, room=f"camp_{camp_id}")

        # Also send individual notifications
        for recipient_id in recipients:
            socketio.emit('notification', {
                'type': 'meeting',
                'title': title,
                'body': body,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, room=f"user_{str(recipient_id)}")

    # In a real implementation, we'd trigger push notifications here
    return True

def send_prayer_request_notification(request_id, event_type):
    """
    Send notifications about prayer request events

    Args:
        request_id: ID of the prayer request
        event_type: Type of event ('new', 'answered', etc.)
    """
    # Get prayer request details
    prayer = mongo.db.prayer_requests.find_one({'_id': ObjectId(request_id)})
    if not prayer:
        return False

    # Skip notifications for private requests
    if prayer.get('is_private', False):
        return True

    # Determine recipients
    recipients = []

    # For ministry-wide prayer requests, notify all active users
    if not prayer.get('camp_id'):
        users_cursor = mongo.db.users.find(
            {'is_active': True},
            {'_id': 1}
        )
        recipients = [user['_id'] for user in users_cursor]

    # For camp prayer requests, notify camp members
    else:
        users_cursor = mongo.db.users.find(
            {'camp_id': prayer['camp_id'], 'is_active': True},
            {'_id': 1}
        )
        recipients = [user['_id'] for user in users_cursor]

    # Prepare notification title and body
    title = "Prayer Request"
    body = ""

    if event_type == 'new':
        body = "New prayer request has been shared"
        if not prayer.get('is_anonymous', False):
            user = mongo.db.users.find_one({'_id': prayer['user_id']})
            if user:
                body = f"New prayer request from {user['first_name']} {user['last_name']}"

    elif event_type == 'answered':
        body = "A prayer request has been answered!"
        if not prayer.get('is_anonymous', False):
            user = mongo.db.users.find_one({'_id': prayer['user_id']})
            if user:
                body = f"{user['first_name']}'s prayer request has been answered!"

    # Create notifications in DB
    notifications = []
    for recipient_id in recipients:
        # Don't notify the author about their own request
        if recipient_id == prayer['user_id']:
            continue

        notification = {
            'user_id': recipient_id,
            'title': title,
            'body': body,
            'related_type': 'prayer_request',
            'related_id': prayer['_id'],
            'created_at': datetime.now(timezone.utc),
            'is_read': False
        }
        notifications.append(notification)

    if notifications:
        result = mongo.db.notifications.insert_many(notifications)

        # Send real-time notifications via WebSocket
        notification_data = {
            'title': title,
            'body': body,
            'prayer_request_id': str(prayer['_id']),
            'event_type': event_type,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

        # Broadcast to appropriate room
        if not prayer.get('camp_id'):
            socketio.emit('prayer_notification', notification_data, room='ministry')
        else:
            camp_id = str(prayer['camp_id'])
            socketio.emit('prayer_notification', notification_data, room=f"camp_{camp_id}")

        # Also send individual notifications
        for recipient in notifications:
            socketio.emit('notification', {
                'type': 'prayer_request',
                'title': title,
                'body': body,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, room=f"user_{str(recipient['user_id'])}")

    # In a real implementation, we'd trigger push notifications here
    return True

def get_user_notifications(user_id, unread_only=False, limit=20):
    """Get notifications for a specific user"""
    filters = {'user_id': ObjectId(user_id)}

    if unread_only:
        filters['is_read'] = False

    notifications = mongo.db.notifications.find(filters).sort(
        'created_at', -1
    ).limit(limit)

    result = []
    for notification in notifications:
        notification['_id'] = str(notification['_id'])
        notification['user_id'] = str(notification['user_id'])
        if 'related_id' in notification and notification['related_id']:
            notification['related_id'] = str(notification['related_id'])
        result.append(notification)

    return result

def mark_notification_as_read(notification_id, user_id):
    """Mark a notification as read"""
    result = mongo.db.notifications.update_one(
        {'_id': ObjectId(notification_id), 'user_id': ObjectId(user_id)},
        {'$set': {'is_read': True}}
    )

    return result.modified_count > 0

def mark_all_notifications_as_read(user_id):
    """Mark all notifications as read for a user"""
    result = mongo.db.notifications.update_many(
        {'user_id': ObjectId(user_id), 'is_read': False},
        {'$set': {'is_read': True}}
    )

    # Emit notification count update via WebSocket
    socketio.emit('notifications_read', {
        'user_id': user_id,
        'count': 0
    }, room=f"user_{user_id}")

    return result.modified_count
