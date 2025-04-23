from datetime import datetime
from bson import ObjectId

class Camp:
    """Camp model for organizing groups within the ministry."""

    def __init__(self, name, description, leader_id=None, created_at=None,
                 meeting_schedule=None, is_active=True):
        self.name = name
        self.description = description
        self.leader_id = leader_id
        self.created_at = created_at or datetime.utcnow()
        self.meeting_schedule = meeting_schedule or []
        self.is_active = is_active

    def to_dict(self):
        """Convert camp data to dictionary."""
        return {
            'name': self.name,
            'description': self.description,
            'leader_id': str(self.leader_id) if self.leader_id else None,
            'created_at': self.created_at,
            'meeting_schedule': self.meeting_schedule,
            'is_active': self.is_active
        }

    @classmethod
    def from_dict(cls, data):
        """Create camp from dictionary data."""
        if 'leader_id' in data and data['leader_id']:
            if isinstance(data['leader_id'], str):
                data['leader_id'] = ObjectId(data['leader_id'])

        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])

        return cls(**data)
