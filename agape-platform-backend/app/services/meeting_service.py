from app import mongo
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from app.utils.helpers import calculate_next_occurrence
from app.services.notification_service import send_meeting_notification

def create_recurring_meetings(meeting_id):
    """Create future instances of a recurring meeting"""
    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})

    if not meeting or not meeting.get('is_recurring') or not meeting.get('recurring_pattern'):
        return False

    # Check if we've already created instances
    existing_count = mongo.db.meetings.count_documents({
        'recurring_group_id': meeting_id
    })

    if existing_count > 0:
        # Already created, don't duplicate
        return True

    # Create the next 8 instances (2 months for weekly)
    instances = []
    last_start = meeting['scheduled_start']
    last_end = meeting['scheduled_end']

    for i in range(8):
        next_start = calculate_next_occurrence(last_start, meeting['recurring_pattern'])
        if not next_start:
            break

        # Calculate duration
        duration = meeting['scheduled_end'] - meeting['scheduled_start']
        next_end = next_start + duration

        # Create new instance with same properties but different dates
        new_instance = {
            'title': meeting['title'],
            'description': meeting['description'],
            'scheduled_start': next_start,
            'scheduled_end': next_end,
            'host_id': meeting['host_id'],
            'meeting_type': meeting['meeting_type'],
            'camp_id': meeting.get('camp_id'),
            'is_recurring': True,
            'recurring_pattern': meeting['recurring_pattern'],
            'meeting_link': meeting.get('meeting_link'),
            'status': 'scheduled',
            'created_at': datetime.now(timezone.utc),
            'attendees': [],
            'recording_url': None,
            'recurring_group_id': meeting_id  # Link to the original meeting
        }

        instances.append(new_instance)
        last_start = next_start
        last_end = next_end

    if instances:
        mongo.db.meetings.insert_many(instances)

    return True

def get_upcoming_meetings_for_user(user_id, days=7):
    """Get upcoming meetings for a specific user in the next X days"""
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        return []

    now = datetime.now(timezone.utc)
    end_date = now + timedelta(days=days)

    # Build query filters
    if user.get('camp_id'):
        # User belongs to a camp
        filters = {
            'scheduled_start': {'$gte': now, '$lte': end_date},
            'status': 'scheduled',
            '$or': [
                {'camp_id': None},  # Ministry-wide meetings
                {'camp_id': user['camp_id']}  # User's camp meetings
            ]
        }
    else:
        # User doesn't belong to a camp, only ministry-wide meetings
        filters = {
            'scheduled_start': {'$gte': now, '$lte': end_date},
            'status': 'scheduled',
            'camp_id': None
        }

    # Find meetings
    meetings_cursor = mongo.db.meetings.find(filters).sort('scheduled_start', 1)

    # Process results
    meetings = []
    for meeting in meetings_cursor:
        meeting['_id'] = str(meeting['_id'])
        meeting['host_id'] = str(meeting['host_id'])
        if 'camp_id' in meeting and meeting['camp_id']:
            meeting['camp_id'] = str(meeting['camp_id'])

        # Add host information
        host = mongo.db.users.find_one(
            {'_id': ObjectId(meeting['host_id'])},
            {'password_hash': 0, 'first_name': 1, 'last_name': 1}
        )
        if host:
            meeting['host_name'] = f"{host['first_name']} {host['last_name']}"

        # Is user attending?
        meeting['is_attending'] = ObjectId(user_id) in meeting.get('attendees', [])

        # Calculate how far in the future
        time_diff = meeting['scheduled_start'] - now
        days_away = time_diff.days
        hours_away = time_diff.seconds // 3600

        if days_away == 0:
            if hours_away == 0:
                meeting['time_until'] = "Starting soon"
            else:
                meeting['time_until'] = f"In {hours_away} hours"
        elif days_away == 1:
            meeting['time_until'] = "Tomorrow"
        else:
            meeting['time_until'] = f"In {days_away} days"

        meetings.append(meeting)

    return meetings

def send_meeting_reminders():
    """Send reminders for upcoming meetings (would be called by a scheduled task)"""
    now = datetime.now(timezone.utc)

    # Find meetings in the next hour
    one_hour_from_now = now + timedelta(hours=1)

    filters = {
        'scheduled_start': {'$gte': now, '$lt': one_hour_from_now},
        'status': 'scheduled',
        'reminders_sent': {'$ne': True}  # Don't send reminders twice
    }

    upcoming_meetings = mongo.db.meetings.find(filters)

    for meeting in upcoming_meetings:
        # Send reminders
        send_meeting_notification(str(meeting['_id']), 'reminder')

        # Mark as sent
        mongo.db.meetings.update_one(
            {'_id': meeting['_id']},
            {'$set': {'reminders_sent': True}}
        )

    return True
