from app import mongo, jwt
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from datetime import datetime, timezone, timedelta

def authenticate_user(email, password):
    """Authenticate a user and return access token if valid"""
    user = mongo.db.users.find_one({'email': email})

    if not user or not check_password_hash(user['password_hash'], password):
        return None

    if not user.get('is_active', True):
        return None

    # Update last login time
    mongo.db.users.update_one(
        {'_id': user['_id']},
        {'$set': {'last_login': datetime.now(timezone.utc)}}
    )

    # Create access token
    additional_claims = {
        'role': user.get('role', 'member'),
    }

    if user.get('camp_id'):
        additional_claims['camp_id'] = str(user['camp_id'])

    access_token = create_access_token(
        identity=str(user['_id']),
        additional_claims=additional_claims
    )

    return {
        'access_token': access_token,
        'user': {
            'id': str(user['_id']),
            'first_name': user['first_name'],
            'last_name': user['last_name'],
            'email': user['email'],
            'role': user.get('role', 'member')
        }
    }

def change_password(user_id, current_password, new_password):
    """Change a user's password"""
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})

    if not user or not check_password_hash(user['password_hash'], current_password):
        return False

    result = mongo.db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'password_hash': generate_password_hash(new_password)}}
    )

    return result.modified_count > 0

def generate_password_reset_token(email):
    """Generate a token for password reset"""
    user = mongo.db.users.find_one({'email': email})

    if not user:
        return None

    # Generate a random token
    import secrets
    token = secrets.token_urlsafe(32)

    # Store the token with expiration
    expiration = datetime.now(timezone.utc) + timedelta(hours=24)

    mongo.db.password_resets.insert_one({
        'user_id': user['_id'],
        'token': token,
        'expires_at': expiration,
        'used': False
    })

    return {
        'token': token,
        'user_id': str(user['_id']),
        'email': user['email'],
        'expires_at': expiration
    }

def reset_password_with_token(token, new_password):
    """Reset a password using a reset token"""
    reset_request = mongo.db.password_resets.find_one({
        'token': token,
        'expires_at': {'$gt': datetime.now(timezone.utc)},
        'used': False
    })

    if not reset_request:
        return False

    # Update the user's password
    result = mongo.db.users.update_one(
        {'_id': reset_request['user_id']},
        {'$set': {'password_hash': generate_password_hash(new_password)}}
    )

    # Mark token as used
    mongo.db.password_resets.update_one(
        {'_id': reset_request['_id']},
        {'$set': {'used': True}})
    return result.modified_count > 0

def validate_token(token):
    """Check if a password reset token is valid"""
    reset_request = mongo.db.password_resets.find_one({
        'token': token,
        'expires_at': {'$gt': datetime.now(timezone.utc)},
        'used': False
    })

    return reset_request is not None

def get_user_by_id(user_id):
    """Get user information by ID, excluding sensitive fields"""
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})

    if not user:
        return None

    # Remove sensitive fields
    user.pop('password_hash', None)

    # Convert ObjectId to string
    user['_id'] = str(user['_id'])
    if 'camp_id' in user and user['camp_id']:
        user['camp_id'] = str(user['camp_id'])

    return user
