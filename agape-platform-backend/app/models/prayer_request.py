from datetime import datetime
from bson import ObjectId

class PrayerRequest:
    """Prayer request model for sharing prayer needs."""

    def __init__(self, content, user_id, is_private=False, is_anonymous=False,
                 camp_id=None, created_at=None, status='active', is_testimony=False):
        self.content = content
        self.user_id = user_id  # Who submitted the request
        self.is_private = is_private  # Only visible to leaders if true
        self.is_anonymous = is_anonymous  # Display without name if true
        self.camp_id = camp_id  # None for ministry-wide requests
        self.created_at = created_at or datetime.utcnow()
        self.status = status  # 'active', 'answered', 'archived'
        self.is_testimony = is_testimony  # If it's a testimony of answered prayer
        self.praying_users = []  # Users who are praying for this request
        self.testimony_content = None  # Content added when prayer is answered

    def to_dict(self):
        """Convert prayer request data to dictionary."""
        return {
            'content': self.content,
            'user_id': str(self.user_id),
            'is_private': self.is_private,
            'is_anonymous': self.is_anonymous,
            'camp_id': str(self.camp_id) if self.camp_id else None,
            'created_at': self.created_at,
            'status': self.status,
            'is_testimony': self.is_testimony,
            'praying_users': [str(user_id) for user_id in self.praying_users],
            'testimony_content': self.testimony_content
        }

    @classmethod
    def from_dict(cls, data):
        """Create prayer request from dictionary data."""
        for field in ['user_id', 'camp_id']:
            if field in data and data[field] and isinstance(data[field], str):
                data[field] = ObjectId(data[field])

        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])

        if 'praying_users' in data:
            data['praying_users'] = [ObjectId(id_) if isinstance(id_, str) else id_
                                    for id_ in data['praying_users']]

        return cls(**data)
