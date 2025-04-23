from email_validator import validate_email, EmailNotValidError
import re

def is_valid_email(email):
    """Validate email format"""
    try:
        validate_email(email)
        return True
    except EmailNotValidError:
        return False

def is_valid_password(password):
    """
    Validate password strength
    - At least 8 characters
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one number
    """
    if len(password) < 8:
        return False

    if not re.search(r'[A-Z]', password):
        return False

    if not re.search(r'[a-z]', password):
        return False

    if not re.search(r'[0-9]', password):
        return False

    return True

def is_valid_phone(phone):
    """Validate phone number format"""
    # Basic pattern for international format with optional country code
    pattern = r'^\+?[0-9]{10,15}$'
    return bool(re.match(pattern, phone))

def is_valid_role(role):
    """Validate user role"""
    valid_roles = ['super_admin', 'camp_leader', 'member', 'guest']
    return role in valid_roles

def is_valid_meeting_type(meeting_type):
    """Validate meeting type"""
    valid_types = ['prayer', 'bible_study', 'camp_meeting', 'leadership', 'other']
    return meeting_type in valid_types

def is_valid_date_format(date_str):
    """Validate ISO date format"""
    try:
        from datetime import datetime
        datetime.fromisoformat(date_str)
        return True
    except (ValueError, TypeError):
        return False

def is_valid_url(url):
    """Basic URL validation"""
    pattern = r'^(http|https)://[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(/\S*)?$'
    return bool(re.match(pattern, url))
