from datetime import datetime
from bson import ObjectId

class User:
    """User model that defines the structure for MongoDB documents."""

    def __init__(self, first_name, last_name, email, password_hash, role='member',
                 camp_id=None, phone=None, profile_image=None, spiritual_gifts=None,
                 joined_date=None, is_active=True):
        self.first_name = first_name
        self.last_name = last_name
        self.email = email
        self.password_hash = password_hash
        self.role = role  # 'super_admin', 'camp_leader', 'member', 'guest'
        self.camp_id = camp_id
        self.phone = phone
        self.profile_image = profile_image
        self.spiritual_gifts = spiritual_gifts or []
        self.joined_date = joined_date or datetime.utcnow()
        self.is_active = is_active
        self.last_login = None

    def to_dict(self):
        """Convert user data to dictionary."""
        return {
            'first_name': self.first_name,
            'last_name': self.last_name,
            'email': self.email,
            'role': self.role,
            'camp_id': str(self.camp_id) if self.camp_id else None,
            'phone': self.phone,
            'profile_image': self.profile_image,
            'spiritual_gifts': self.spiritual_gifts,
            'joined_date': self.joined_date,
            'is_active': self.is_active,
            'last_login': self.last_login
        }

    @classmethod
    def from_dict(cls, data):
        """Create user from dictionary data."""
        # Handle ObjectId conversion for MongoDB
        if 'camp_id' in data and data['camp_id']:
            if isinstance(data['camp_id'], str):
                data['camp_id'] = ObjectId(data['camp_id'])

        if 'joined_date' in data and isinstance(data['joined_date'], str):
            data['joined_date'] = datetime.fromisoformat(data['joined_date'])

        return cls(**data)
