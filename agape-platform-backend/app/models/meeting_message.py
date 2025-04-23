from datetime import datetime
from bson import ObjectId

class MeetingMessage:
    """Meeting message model for communication during meetings."""

    def __init__(self, content, user_id, meeting_id, message_type='text',
                 attachment_urls=None, created_at=None):
        self.content = content
        self.user_id = user_id
        self.meeting_id = meeting_id
        self.message_type = message_type  # 'text', 'image', 'document', 'video', etc.
        self.attachment_urls = attachment_urls or []
        self.created_at = created_at or datetime.utcnow()

    def to_dict(self):
        """Convert meeting message data to dictionary."""
        return {
            'content': self.content,
            'user_id': str(self.user_id),
            'meeting_id': str(self.meeting_id),
            'message_type': self.message_type,
            'attachment_urls': self.attachment_urls,
            'created_at': self.created_at
        }

    @classmethod
    def from_dict(cls, data):
        """Create meeting message from dictionary data."""
        for field in ['user_id', 'meeting_id']:
            if field in data and data[field] and isinstance(data[field], str):
                data[field] = ObjectId(data[field])

        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])

        return cls(**data)
