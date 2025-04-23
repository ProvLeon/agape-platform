from bson import ObjectId
from datetime import datetime, timedelta
import os
import secrets
import string

def generate_unique_filename(original_filename):
    """Generate a unique filename to prevent overwriting"""
    ext = os.path.splitext(original_filename)[1]
    random_string = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"{timestamp}_{random_string}{ext}"

def format_datetime(dt):
    """Format datetime for display"""
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    return dt.strftime("%B %d, %Y at %I:%M %p")

def calculate_next_occurrence(start_datetime, recurring_pattern):
    """Calculate the next occurrence based on recurring pattern"""
    if not recurring_pattern:
        return None

    frequency = recurring_pattern.get('frequency')
    day = recurring_pattern.get('day')

    if not frequency:
        return None

    if frequency == 'daily':
        return start_datetime + timedelta(days=1)

    if frequency == 'weekly':
        return start_datetime + timedelta(days=7)

    if frequency == 'monthly':
        # Add roughly a month - not perfect for all months
        return start_datetime + timedelta(days=30)

    return None

def get_readable_time_diff(dt):
    """Get human-readable time difference from now"""
    now = datetime.now()

    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)

    diff = now - dt if dt < now else dt - now

    days = diff.days
    hours, remainder = divmod(diff.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if dt > now:
        prefix = "in "
    else:
        prefix = ""

    if days > 0:
        if days == 1:
            return f"{prefix}1 day"
        return f"{prefix}{days} days"

    if hours > 0:
        if hours == 1:
            return f"{prefix}1 hour"
        return f"{prefix}{hours} hours"

    if minutes > 0:
        if minutes == 1:
            return f"{prefix}1 minute"
        return f"{prefix}{minutes} minutes"

    return "just now"

def serialize_objectid(obj):
    """Convert ObjectId to string in nested dictionary or list"""
    if isinstance(obj, dict):
        return {k: serialize_objectid(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_objectid(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    else:
        return obj
