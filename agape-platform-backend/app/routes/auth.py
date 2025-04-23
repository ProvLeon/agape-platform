from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt
)
from werkzeug.security import generate_password_hash, check_password_hash
from bson.objectid import ObjectId
from datetime import datetime, timezone

from app import mongo

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    # Basic validation
    required_fields = ['first_name', 'last_name', 'email', 'password']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Check if email already exists
    if mongo.db.users.find_one({'email': data['email']}):
        return jsonify({'error': 'Email already registered'}), 409

    # Create new user document
    new_user = {
        'first_name': data['first_name'],
        'last_name': data['last_name'],
        'email': data['email'],
        'password_hash': generate_password_hash(data['password']),
        'role': 'member',  # Default role
        'camp_id': ObjectId(data['camp_id']) if 'camp_id' in data and data['camp_id'] else None,
        'phone': data.get('phone'),
        'profile_image': data.get('profile_image'),
        'spiritual_gifts': data.get('spiritual_gifts', []),
        'joined_date': datetime.now(timezone.utc),
        'is_active': True
    }

    result = mongo.db.users.insert_one(new_user)

    if result.inserted_id:
        return jsonify({
            'message': 'User registered successfully',
            'user_id': str(result.inserted_id)
        }), 201
    else:
        return jsonify({'error': 'Registration failed'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data or 'email' not in data or 'password' not in data:
        return jsonify({'error': 'Email and password required'}), 400

    user = mongo.db.users.find_one({'email': data['email']})

    if not user or not check_password_hash(user['password_hash'], data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401

    if not user.get('is_active', True):
        return jsonify({'error': 'Account is inactive'}), 403

    # Update last login time
    mongo.db.users.update_one(
        {'_id': user['_id']},
        {'$set': {'last_login': datetime.now(timezone.utc)}}
    )

    # Create access token
    access_token = create_access_token(
        identity=str(user['_id']),
        additional_claims={
            'role': user.get('role', 'member'),
            'camp_id': str(user['camp_id']) if 'camp_id' in user and user['camp_id'] else None
        }
    )

    return jsonify({
        'access_token': access_token,
        'user': {
            'id': str(user['_id']),
            'first_name': user['first_name'],
            'last_name': user['last_name'],
            'email': user['email'],
            'role': user.get('role', 'member')
        }
    }), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    claims = get_jwt()

    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Remove sensitive data
    user.pop('password_hash', None)

    # Convert ObjectId to string
    user['_id'] = str(user['_id'])
    if 'camp_id' in user and user['camp_id']:
        user['camp_id'] = str(user['camp_id'])

    return jsonify({'user': user}), 200

@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data or 'current_password' not in data or 'new_password' not in data:
        return jsonify({'error': 'Current and new password required'}), 400

    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})

    if not user or not check_password_hash(user['password_hash'], data['current_password']):
        return jsonify({'error': 'Current password is incorrect'}), 401

    # Update password
    mongo.db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'password_hash': generate_password_hash(data['new_password'])}}
    )

    return jsonify({'message': 'Password updated successfully'}), 200
