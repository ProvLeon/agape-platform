from datetime import datetime
from bson import ObjectId

class Message:
    """Message model for both ministry-wide and camp-specific communications."""

    def __init__(self, content, sender_id, recipient_type, recipient_id=None,
                 message_type='text', attachment_urls=None, is_announcement=False,
                 created_at=None, is_deleted=False):
        self.content = content
        self.sender_id = sender_id
        self.recipient_type = recipient_type  # 'ministry', 'camp', 'user'
        self.recipient_id = recipient_id  # Camp ID or User ID if personal message
        self.message_type = message_type  # 'text', 'image', 'document', 'video', etc.
        self.attachment_urls = attachment_urls or []
        self.is_announcement = is_announcement
        self.created_at = created_at or datetime.utcnow()
        self.is_deleted = is_deleted
        self.read_by = []  # List of user IDs who have read the message

    def to_dict(self):
        """Convert message data to dictionary."""
        return {
            'content': self.content,
            'sender_id': str(self.sender_id),
            'recipient_type': self.recipient_type,
            'recipient_id': str(self.recipient_id) if self.recipient_id else None,
            'message_type': self.message_type,
            'attachment_urls': self.attachment_urls,
            'is_announcement': self.is_announcement,
            'created_at': self.created_at,
            'is_deleted': self.is_deleted,
            'read_by': [str(user_id) for user_id in self.read_by]
        }

    @classmethod
    def from_dict(cls, data):
        """Create message from dictionary data."""
        if 'sender_id' in data and data['sender_id']:
            if isinstance(data['sender_id'], str):
                data['sender_id'] = ObjectId(data['sender_id'])

        if 'recipient_id' in data and data['recipient_id']:
            if isinstance(data['recipient_id'], str):
                data['recipient_id'] = ObjectId(data['recipient_id'])

        if 'read_by' in data:
            data['read_by'] = [ObjectId(id_) if isinstance(id_, str) else id_
                              for id_ in data['read_by']]

        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])

        return cls(**data)
