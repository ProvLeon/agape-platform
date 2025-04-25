from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash
from datetime import datetime, timezone

from app import mongo
from app.utils.validators import is_valid_role

users_bp = Blueprint('users', __name__)

# Helper function to check if user has admin rights
def is_admin(claims):
    return claims.get('role') in ['super_admin', 'camp_leader']

# @users_bp.route('/', methods=['GET'])
# @jwt_required()
# def get_users():
    claims = get_jwt()

    # Only admins can see all users
    if not is_admin(claims):
        return jsonify({'error': 'Unauthorized access'}), 403

    # Pagination parameters
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    skip = (page - 1) * per_page

    # Filtering
    filters = {}
    if 'camp_id' in request.args:
        filters['camp_id'] = ObjectId(request.args['camp_id'])
    if 'role' in request.args:
        filters['role'] = request.args['role']
    if 'search' in request.args:
        search = request.args['search']
        filters['$or'] = [
            {'first_name': {'$regex': search, '$options': 'i'}},
            {'last_name': {'$regex': search, '$options': 'i'}},
            {'email': {'$regex': search, '$options': 'i'}}
        ]

    # Camp leaders can only see their camp members
    if claims.get('role') == 'camp_leader':
        if 'camp_id' not in filters:
            filters['camp_id'] = ObjectId(claims.get('camp_id'))

    # Execute query
    total = mongo.db.users.count_documents(filters)
    users_cursor = mongo.db.users.find(
        filters,
        {'password_hash': 0}  # Exclude password
    ).skip(skip).limit(per_page)

    # Process results
    users = []
    for user in users_cursor:
        user['_id'] = str(user['_id'])
        if 'camp_id' in user and user['camp_id']:
            user['camp_id'] = str(user['camp_id'])
        users.append(user)

    return jsonify({
        'users': users,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }), 200

@users_bp.route('/', methods=['GET'])
@jwt_required() # Ensures user is logged in
def get_users():
    # claims = get_jwt() # Keep claims if needed for other filtering later

    # Pagination parameters (keep as is)
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    skip = (page - 1) * per_page

    # Filtering
    filters = {'is_active': True} # Default: Only show active users

    # --- REMOVE OR COMMENT OUT THE STRICT ADMIN CHECK ---
    # if not is_admin(claims):
    #     return jsonify({'error': 'Unauthorized access'}), 403
    # -----------------------------------------------------

    # Optional: Add search filter (keep as is)
    if 'search' in request.args:
        search = request.args['search']
        filters['$or'] = [
            {'first_name': {'$regex': search, '$options': 'i'}},
            {'last_name': {'$regex': search, '$options': 'i'}},
            {'email': {'$regex': search, '$options': 'i'}}
        ]

    # Optional: Add filtering based on role if needed later
    # if claims.get('role') == 'member':
    #     filters['role'] = {'$ne': 'super_admin'} # Example: Don't show admins to members

    # Execute query (keep as is)
    total = mongo.db.users.count_documents(filters)
    users_cursor = mongo.db.users.find(
        filters,
        {'password_hash': 0}
    ).sort([('last_name', 1), ('first_name', 1)]).skip(skip).limit(per_page) # Added sort

    # Process results (keep as is)
    users = []
    for user in users_cursor:
        user['_id'] = str(user['_id'])
        if 'camp_id' in user and user['camp_id']:
            user['camp_id'] = str(user['camp_id'])
        # Exclude self from list if needed (can also be done on frontend)
        # if str(user['_id']) == get_jwt_identity():
        #     continue
        users.append(user)

    return jsonify({
        'items': users, # Changed key to 'items' to match frontend expectation
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }), 200

@users_bp.route('/<user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    current_user_id = get_jwt_identity()
    claims = get_jwt()

    # Users can see their own profile or admins can see any profile
    if user_id != current_user_id and not is_admin(claims):
        return jsonify({'error': 'Unauthorized access'}), 403

    # Camp leaders can only see their camp members
    if claims.get('role') == 'camp_leader' and user_id != current_user_id:
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        if not user or str(user.get('camp_id')) != claims.get('camp_id'):
            return jsonify({'error': 'Unauthorized access'}), 403

    user = mongo.db.users.find_one({'_id': ObjectId(user_id)}, {'password_hash': 0})

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Convert ObjectId to string
    user['_id'] = str(user['_id'])
    if 'camp_id' in user and user['camp_id']:
        user['camp_id'] = str(user['camp_id'])

    return jsonify({'user': user}), 200

@users_bp.route('/', methods=['POST'])
@jwt_required()
def create_user():
    claims = get_jwt()

    # Only admins can create users
    if not is_admin(claims):
        return jsonify({'error': 'Unauthorized access'}), 403

    data = request.get_json()

    # Validate required fields
    required_fields = ['first_name', 'last_name', 'email', 'password', 'role']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Validate role
    if not is_valid_role(data['role']):
        return jsonify({'error': 'Invalid role'}), 400

    # Super admins can create any user, camp leaders can only create members in their camp
    if claims.get('role') == 'camp_leader':
        if data['role'] in ['super_admin', 'camp_leader']:
            return jsonify({'error': 'Unauthorized to create users with this role'}), 403
        data['camp_id'] = claims.get('camp_id')

    # Check if email already exists
    if mongo.db.users.find_one({'email': data['email']}):
        return jsonify({'error': 'Email already registered'}), 409

    # Prepare user document
    new_user = {
        'first_name': data['first_name'],
        'last_name': data['last_name'],
        'email': data['email'],
        'password_hash': generate_password_hash(data['password']),
        'role': data['role'],
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
            'message': 'User created successfully',
            'user_id': str(result.inserted_id)
        }), 201
    else:
        return jsonify({'error': 'Failed to create user'}), 500

@users_bp.route('/<user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    current_user_id = get_jwt_identity()
    claims = get_jwt()

    # Users can update their own profile or admins can update any profile
    if user_id != current_user_id and not is_admin(claims):
        return jsonify({'error': 'Unauthorized access'}), 403

    # Get current user data for validation
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Camp leaders can only update members in their camp
    if claims.get('role') == 'camp_leader' and user_id != current_user_id:
        if str(user.get('camp_id')) != claims.get('camp_id'):
            return jsonify({'error': 'Unauthorized access'}), 403

    data = request.get_json()
    update_data = {}

    # Fields that any user can update about themselves
    allowed_self_update = ['first_name', 'last_name', 'phone', 'profile_image', 'spiritual_gifts']

    # Process updates
    for field in allowed_self_update:
        if field in data:
            update_data[field] = data[field]

    # Only admins can update these fields
    if is_admin(claims):
        if 'role' in data and is_valid_role(data['role']):
            # Camp leaders can't change roles to admin
            if claims.get('role') == 'camp_leader' and data['role'] in ['super_admin', 'camp_leader']:
                return jsonify({'error': 'Unauthorized to assign this role'}), 403
            update_data['role'] = data['role']

        if 'camp_id' in data:
            # Camp leaders can only assign to their own camp
            if claims.get('role') == 'camp_leader' and data['camp_id'] != claims.get('camp_id'):
                return jsonify({'error': 'Unauthorized to assign to this camp'}), 403
            update_data['camp_id'] = ObjectId(data['camp_id']) if data['camp_id'] else None

        if 'is_active' in data:
            update_data['is_active'] = bool(data['is_active'])

    # If password is being updated
    if 'password' in data and data['password']:
        # Only self or admin can change password
        if user_id == current_user_id or is_admin(claims):
            update_data['password_hash'] = generate_password_hash(data['password'])

    if not update_data:
        return jsonify({'message': 'No fields to update'}), 200

    result = mongo.db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': update_data}
    )

    if result.modified_count:
        return jsonify({'message': 'User updated successfully'}), 200
    else:
        return jsonify({'message': 'No changes made'}), 200

@users_bp.route('/<user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    claims = get_jwt()

    # Only super admins can delete users
    if claims.get('role') != 'super_admin':
        return jsonify({'error': 'Unauthorized access'}), 403

    # Check if user exists
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Soft delete by setting is_active to false
    result = mongo.db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'is_active': False}}
    )

    if result.modified_count:
        return jsonify({'message': 'User deactivated successfully'}), 200
    else:
        return jsonify({'error': 'Failed to deactivate user'}), 500
