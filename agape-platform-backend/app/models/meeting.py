from datetime import datetime
from bson import ObjectId

class Meeting:
    """Meeting model for virtual gatherings."""

    def __init__(self, title, description, scheduled_start, scheduled_end, host_id,
                 meeting_type, camp_id=None, is_recurring=False, recurring_pattern=None,
                 meeting_link=None, status='scheduled', created_at=None):
        self.title = title
        self.description = description
        self.scheduled_start = scheduled_start
        self.scheduled_end = scheduled_end
        self.host_id = host_id
        self.meeting_type = meeting_type  # 'prayer', 'bible_study', 'camp_meeting', etc.
        self.camp_id = camp_id  # None for ministry-wide meetings
        self.is_recurring = is_recurring
        self.recurring_pattern = recurring_pattern  # e.g., {'frequency': 'weekly', 'day': 'friday'}
        self.meeting_link = meeting_link
        self.status = status  # 'scheduled', 'in_progress', 'completed', 'cancelled'
        self.created_at = created_at or datetime.utcnow()
        self.attendees = []  # List of user IDs who attended
        self.recording_url = None

    def to_dict(self):
        """Convert meeting data to dictionary."""
        return {
            'title': self.title,
            'description': self.description,
            'scheduled_start': self.scheduled_start,
            'scheduled_end': self.scheduled_end,
            'host_id': str(self.host_id),
            'meeting_type': self.meeting_type,
            'camp_id': str(self.camp_id) if self.camp_id else None,
            'is_recurring': self.is_recurring,
            'recurring_pattern': self.recurring_pattern,
            'meeting_link': self.meeting_link,
            'status': self.status,
            'created_at': self.created_at,
            'attendees': [str(user_id) for user_id in self.attendees],
            'recording_url': self.recording_url
        }

    @classmethod
    def from_dict(cls, data):
        """Create meeting from dictionary data."""
        for field in ['host_id', 'camp_id']:
            if field in data and data[field] and isinstance(data[field], str):
                data[field] = ObjectId(data[field])

        for date_field in ['scheduled_start', 'scheduled_end', 'created_at']:
            if date_field in data and isinstance(data[date_field], str):
                data[date_field] = datetime.fromisoformat(data[date_field])

        if 'attendees' in data:
            data['attendees'] = [ObjectId(id_) if isinstance(id_, str) else id_
                                for id_ in data['attendees']]

        return cls(**data)
