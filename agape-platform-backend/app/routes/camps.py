from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from bson.objectid import ObjectId
from datetime import datetime, timezone

from app import mongo

camps_bp = Blueprint('camps', __name__)

# Helper function to check if user has admin rights
def is_admin(claims):
    return claims.get('role') in ['super_admin', 'camp_leader']

@camps_bp.route('/', methods=['GET'])
@jwt_required()
def get_camps():
    # Any user can view camps

    # Pagination parameters
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    skip = (page - 1) * per_page

    # Filtering
    filters = {}
    if 'search' in request.args:
        search = request.args['search']
        filters['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]

    # Only show active camps to regular members
    claims = get_jwt()
    if claims.get('role') not in ['super_admin', 'camp_leader']:
        filters['is_active'] = True

    # Execute query
    total = mongo.db.camps.count_documents(filters)
    camps_cursor = mongo.db.camps.find(filters).skip(skip).limit(per_page)

    # Process results
    camps = []
    for camp in camps_cursor:
        camp['_id'] = str(camp['_id'])
        if 'leader_id' in camp and camp['leader_id']:
            camp['leader_id'] = str(camp['leader_id'])
        camps.append(camp)

    return jsonify({
        'camps': camps,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }), 200

@camps_bp.route('/<camp_id>', methods=['GET'])
@jwt_required()
def get_camp(camp_id):
    # Any user can view a camp's details

    camp = mongo.db.camps.find_one({'_id': ObjectId(camp_id)})

    if not camp:
        return jsonify({'error': 'Camp not found'}), 404

    # Convert ObjectId to string
    camp['_id'] = str(camp['_id'])
    if 'leader_id' in camp and camp['leader_id']:
        camp['leader_id'] = str(camp['leader_id'])

    # Include leader details if leader_id exists
    if 'leader_id' in camp and camp['leader_id']:
        leader = mongo.db.users.find_one(
            {'_id': ObjectId(camp['leader_id'])},
            {'password_hash': 0}
        )
        if leader:
            leader['_id'] = str(leader['_id'])
            camp['leader'] = leader

    # Include members count
    camp['members_count'] = mongo.db.users.count_documents({'camp_id': ObjectId(camp_id)})

    return jsonify({'camp': camp}), 200

@camps_bp.route('/', methods=['POST'])
@jwt_required()
def create_camp():
    claims = get_jwt()

    # Only super admins can create camps
    if claims.get('role') != 'super_admin':
        return jsonify({'error': 'Unauthorized access'}), 403

    data = request.get_json()

    # Validate required fields
    if 'name' not in data:
        return jsonify({'error': 'Camp name is required'}), 400

    # Check if camp with same name exists
    if mongo.db.camps.find_one({'name': data['name']}):
        return jsonify({'error': 'Camp with this name already exists'}), 409

    # Prepare camp document
    new_camp = {
        'name': data['name'],
        'description': data.get('description', ''),
        'leader_id': ObjectId(data['leader_id']) if 'leader_id' in data and data['leader_id'] else None,
        'created_at': datetime.now(timezone.utc),
        'meeting_schedule': data.get('meeting_schedule', []),
        'is_active': True
    }

    result = mongo.db.camps.insert_one(new_camp)

    if result.inserted_id:
        # If a leader was assigned, update their role to camp_leader
        if new_camp['leader_id']:
            mongo.db.users.update_one(
                {'_id': new_camp['leader_id']},
                {'$set': {'role': 'camp_leader', 'camp_id': result.inserted_id}}
            )

        return jsonify({
            'message': 'Camp created successfully',
            'camp_id': str(result.inserted_id)
        }), 201
    else:
        return jsonify({'error': 'Failed to create camp'}), 500

@camps_bp.route('/<camp_id>', methods=['PUT'])
@jwt_required()
def update_camp(camp_id):
    claims = get_jwt()

    # Super admins can update any camp
    # Camp leaders can only update their own camp
    if claims.get('role') == 'camp_leader':
        # Check if the user is the leader of this camp
        camp = mongo.db.camps.find_one({'_id': ObjectId(camp_id)})
        if not camp or str(camp.get('leader_id')) != claims.get('user_id'):
            return jsonify({'error': 'Unauthorized access'}), 403
    elif claims.get('role') != 'super_admin':
        return jsonify({'error': 'Unauthorized access'}), 403

    data = request.get_json()
    update_data = {}

    # Fields that can be updated
    allowed_fields = ['name', 'description', 'meeting_schedule', 'is_active']

    # Process updates
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    # Only super admins can change camp leader
    if 'leader_id' in data and claims.get('role') == 'super_admin':
        # Get current leader to revert their role if needed
        current_camp = mongo.db.camps.find_one({'_id': ObjectId(camp_id)})
        current_leader_id = current_camp.get('leader_id')

        # Set new leader
        new_leader_id = ObjectId(data['leader_id']) if data['leader_id'] else None
        update_data['leader_id'] = new_leader_id

        # Update leader roles
        if current_leader_id and current_leader_id != new_leader_id:
            # Revert old leader's role back to member
            mongo.db.users.update_one(
                {'_id': current_leader_id},
                {'$set': {'role': 'member'}}
            )

        if new_leader_id:
            # Set new leader's role
            mongo.db.users.update_one(
                {'_id': new_leader_id},
                {'$set': {'role': 'camp_leader', 'camp_id': ObjectId(camp_id)}}
            )

    if not update_data:
        return jsonify({'message': 'No fields to update'}), 200

    result = mongo.db.camps.update_one(
        {'_id': ObjectId(camp_id)},
        {'$set': update_data}
    )

    if result.modified_count:
        return jsonify({'message': 'Camp updated successfully'}), 200
    else:
        return jsonify({'message': 'No changes made'}), 200

@camps_bp.route('/<camp_id>', methods=['DELETE'])
@jwt_required()
def delete_camp(camp_id):
    claims = get_jwt()

    # Only super admins can delete camps
    if claims.get('role') != 'super_admin':
        return jsonify({'error': 'Unauthorized access'}), 403

    # Check if camp exists
    camp = mongo.db.camps.find_one({'_id': ObjectId(camp_id)})
    if not camp:
        return jsonify({'error': 'Camp not found'}), 404

    # Soft delete by setting is_active to false
    result = mongo.db.camps.update_one(
        {'_id': ObjectId(camp_id)},
        {'$set': {'is_active': False}}
    )

    if result.modified_count:
        return jsonify({'message': 'Camp deactivated successfully'}), 200
    else:
        return jsonify({'error': 'Failed to deactivate camp'}), 500

@camps_bp.route('/<camp_id>/members', methods=['GET'])
@jwt_required()
def get_camp_members(camp_id):
    claims = get_jwt()

    # Check if camp exists
    camp = mongo.db.camps.find_one({'_id': ObjectId(camp_id)})
    if not camp:
        return jsonify({'error': 'Camp not found'}), 404

    # Any member can view camp members, but only active ones
    # Admin can see inactive members too
    filters = {'camp_id': ObjectId(camp_id)}
    if not is_admin(claims):
        filters['is_active'] = True

    # Pagination
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    skip = (page - 1) * per_page

    # Execute query
    total = mongo.db.users.count_documents(filters)
    members_cursor = mongo.db.users.find(
        filters,
        {'password_hash': 0}  # Exclude password
    ).skip(skip).limit(per_page)

    # Process results
    members = []
    for member in members_cursor:
        member['_id'] = str(member['_id'])
        if 'camp_id' in member and member['camp_id']:
            member['camp_id'] = str(member['camp_id'])
        members.append(member)

    return jsonify({
        'members': members,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }), 200
