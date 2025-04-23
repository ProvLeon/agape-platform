from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson.objectid import ObjectId
from datetime import datetime, timezone

from app import mongo

prayer_requests_bp = Blueprint('prayer_requests', __name__)

@prayer_requests_bp.route('/', methods=['POST'])
@jwt_required()
def create_prayer_request():
    user_id = get_jwt_identity()
    data = request.get_json()

    # Validate required fields
    if 'content' not in data:
        return jsonify({'error': 'Prayer request content is required'}), 400

    # Get user's camp if not specified
    camp_id = None
    if 'camp_id' in data and data['camp_id']:
        camp_id = ObjectId(data['camp_id'])
    else:
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        if user and user.get('camp_id'):
            camp_id = user['camp_id']

    # Prepare prayer request document
    new_prayer_request = {
        'content': data['content'],
        'user_id': ObjectId(user_id),
        'is_private': data.get('is_private', False),
        'is_anonymous': data.get('is_anonymous', False),
        'camp_id': camp_id,
        'created_at': datetime.now(timezone.utc),
        'status': 'active',
        'is_testimony': data.get('is_testimony', False),
        'praying_users': [],
        'testimony_content': data.get('testimony_content') if data.get('is_testimony', False) else None
    }

    result = mongo.db.prayer_requests.insert_one(new_prayer_request)

    if result.inserted_id:
        return jsonify({
            'message': 'Prayer request created successfully',
            'prayer_request_id': str(result.inserted_id)
        }), 201
    else:
        return jsonify({'error': 'Failed to create prayer request'}), 500

@prayer_requests_bp.route('/', methods=['GET'])
@jwt_required()
def get_prayer_requests():
    user_id = get_jwt_identity()
    claims = get_jwt()

    # Default filters
    filters = {}

    # Filter by status
    status = request.args.get('status')
    if status:
        filters['status'] = status

    # Filter for testimonies
    if 'testimonies' in request.args and request.args['testimonies'].lower() == 'true':
        filters['is_testimony'] = True

    # Filter by camp
    if 'camp_id' in request.args:
        if request.args['camp_id']:
            filters['camp_id'] = ObjectId(request.args['camp_id'])
        else:
            filters['camp_id'] = None  # Ministry-wide

    # Filter by date range
    if 'from_date' in request.args:
        try:
            from_date = datetime.fromisoformat(request.args['from_date'])
            filters['created_at'] = {'$gte': from_date}
        except ValueError:
            pass

    if 'to_date' in request.args:
        try:
            to_date = datetime.fromisoformat(request.args['to_date'])
            if 'created_at' in filters:
                filters['created_at']['$lte'] = to_date
            else:
                filters['created_at'] = {'$lte': to_date}
        except ValueError:
            pass

    # User-specific filters
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})

    # Show only private requests to admins
    if claims.get('role') not in ['super_admin', 'camp_leader']:
        filters['is_private'] = False
    elif claims.get('role') == 'camp_leader':
        # Camp leaders can see private requests from their camp
        if 'is_private' not in filters:
            camp_id = claims.get('camp_id')
            if camp_id:
                filters['$or'] = [
                    {'is_private': False},
                    {'is_private': True, 'camp_id': ObjectId(camp_id)}
                ]

    # Handle search query
    if 'search' in request.args:
        search = request.args['search']
        if 'is_private' in filters and filters['is_private'] is False:
            # For non-admins searching public requests
            filters['$and'] = [
                {'is_private': False},
                {'content': {'$regex': search, '$options': 'i'}}
            ]
            del filters['is_private']
        else:
            # For admins searching all accessible requests
            if '$or' in filters:
                # Complex query with OR conditions for privacy
                or_conditions = filters['$or']
                del filters['$or']

                filters['$and'] = [
                    {'$or': or_conditions},
                    {'content': {'$regex': search, '$options': 'i'}}
                ]
            else:
                # Simple search
                filters['content'] = {'$regex': search, '$options': 'i'}

    # Filter for personal requests
    if 'personal' in request.args and request.args['personal'].lower() == 'true':
        filters['user_id'] = ObjectId(user_id)

    # Pagination
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    skip = (page - 1) * per_page

    # Execute query
    total = mongo.db.prayer_requests.count_documents(filters)
    requests_cursor = mongo.db.prayer_requests.find(filters).sort(
        'created_at', -1  # Newest first
    ).skip(skip).limit(per_page)

    # Process results
    prayer_requests = []
    for pr in requests_cursor:
        pr['_id'] = str(pr['_id'])
        pr['user_id'] = str(pr['user_id'])
        if 'camp_id' in pr and pr['camp_id']:
            pr['camp_id'] = str(pr['camp_id'])

        # Add user information if not anonymous
        if not pr['is_anonymous']:
            user = mongo.db.users.find_one(
                {'_id': ObjectId(pr['user_id'])},
                {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
            )
            if user:
                user['_id'] = str(user['_id'])
                pr['user'] = user

        # Add camp information if applicable
        if 'camp_id' in pr and pr['camp_id']:
            camp = mongo.db.camps.find_one(
                {'_id': ObjectId(pr['camp_id'])},
                {'name': 1}
            )
            if camp:
                pr['camp_name'] = camp['name']

        # Convert praying users to strings
        pr['praying_users'] = [str(uid) for uid in pr.get('praying_users', [])]

        # Check if current user is praying
        pr['is_praying'] = ObjectId(user_id) in pr.get('praying_users', [])

        # Check if current user is author
        pr['is_author'] = pr['user_id'] == user_id

        prayer_requests.append(pr)

    return jsonify({
        'prayer_requests': prayer_requests,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }), 200

@prayer_requests_bp.route('/<request_id>', methods=['GET'])
@jwt_required()
def get_prayer_request(request_id):
    user_id = get_jwt_identity()
    claims = get_jwt()

    prayer_request = mongo.db.prayer_requests.find_one({'_id': ObjectId(request_id)})

    if not prayer_request:
        return jsonify({'error': 'Prayer request not found'}), 404

    # Check access for private requests
    if prayer_request['is_private']:
        is_author = str(prayer_request['user_id']) == user_id
        is_super_admin = claims.get('role') == 'super_admin'
        is_camp_leader = (
            claims.get('role') == 'camp_leader' and
            prayer_request.get('camp_id') and
            str(prayer_request['camp_id']) == claims.get('camp_id')
        )

        if not (is_author or is_super_admin or is_camp_leader):
            return jsonify({'error': 'Unauthorized access to this prayer request'}), 403

    # Format response
    prayer_request['_id'] = str(prayer_request['_id'])
    prayer_request['user_id'] = str(prayer_request['user_id'])
    if 'camp_id' in prayer_request and prayer_request['camp_id']:
        prayer_request['camp_id'] = str(prayer_request['camp_id'])

    # Add user information if not anonymous
    if not prayer_request['is_anonymous']:
        user = mongo.db.users.find_one(
            {'_id': ObjectId(prayer_request['user_id'])},
            {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
        )
        if user:
            user['_id'] = str(user['_id'])
            prayer_request['user'] = user

    # Add camp information if applicable
    if 'camp_id' in prayer_request and prayer_request['camp_id']:
        camp = mongo.db.camps.find_one({'_id': ObjectId(prayer_request['camp_id'])})
        if camp:
            camp['_id'] = str(camp['_id'])
            prayer_request['camp'] = camp

    # Convert praying users to strings
    prayer_request['praying_users'] = [str(uid) for uid in prayer_request.get('praying_users', [])]

    # Check if current user is praying
    prayer_request['is_praying'] = ObjectId(user_id) in prayer_request.get('praying_users', [])

    # Check if current user is author
    prayer_request['is_author'] = prayer_request['user_id'] == user_id

    # Add praying users details
    if prayer_request.get('praying_users'):
        praying_details = []
        for pray_id in prayer_request['praying_users']:
            pray_user = mongo.db.users.find_one(
                {'_id': ObjectId(pray_id)},
                {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
            )
            if pray_user:
                pray_user['_id'] = str(pray_user['_id'])
                praying_details.append(pray_user)

        prayer_request['praying_users_details'] = praying_details

    return jsonify({'prayer_request': prayer_request}), 200

@prayer_requests_bp.route('/<request_id>', methods=['PUT'])
@jwt_required()
def update_prayer_request(request_id):
    user_id = get_jwt_identity()
    claims = get_jwt()
    data = request.get_json()

    prayer_request = mongo.db.prayer_requests.find_one({'_id': ObjectId(request_id)})

    if not prayer_request:
        return jsonify({'error': 'Prayer request not found'}), 404

    # Check if user has permission to update this prayer request
    is_author = str(prayer_request['user_id']) == user_id
    is_super_admin = claims.get('role') == 'super_admin'
    is_camp_leader = (
        claims.get('role') == 'camp_leader' and
        prayer_request.get('camp_id') and
        str(prayer_request['camp_id']) == claims.get('camp_id')
    )

    if not (is_author or is_super_admin or is_camp_leader):
        return jsonify({'error': 'Unauthorized to update this prayer request'}), 403

    # Prepare update data
    update_data = {}

    # Fields that can be updated
    allowed_fields = ['content', 'is_private', 'is_anonymous', 'status', 'is_testimony', 'testimony_content']
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    # Only author can change privacy settings
    if not is_author and ('is_private' in update_data or 'is_anonymous' in update_data):
        return jsonify({'error': 'Only the author can change privacy settings'}), 403

    if not update_data:
        return jsonify({'message': 'No fields to update'}), 200

    result = mongo.db.prayer_requests.update_one(
        {'_id': ObjectId(request_id)},
        {'$set': update_data}
    )

    if result.modified_count:
        return jsonify({'message': 'Prayer request updated successfully'}), 200
    else:
        return jsonify({'message': 'No changes made'}), 200

@prayer_requests_bp.route('/<request_id>', methods=['DELETE'])
@jwt_required()
def delete_prayer_request(request_id):
    user_id = get_jwt_identity()
    claims = get_jwt()

    prayer_request = mongo.db.prayer_requests.find_one({'_id': ObjectId(request_id)})

    if not prayer_request:
        return jsonify({'error': 'Prayer request not found'}), 404

    # Check if user has permission to delete this prayer request
    is_author = str(prayer_request['user_id']) == user_id
    is_super_admin = claims.get('role') == 'super_admin'
    is_camp_leader = (
        claims.get('role') == 'camp_leader' and
        prayer_request.get('camp_id') and
        str(prayer_request['camp_id']) == claims.get('camp_id')
    )

    if not (is_author or is_super_admin or is_camp_leader):
        return jsonify({'error': 'Unauthorized to delete this prayer request'}), 403

    # Soft delete by archiving
    result = mongo.db.prayer_requests.update_one(
        {'_id': ObjectId(request_id)},
        {'$set': {'status': 'archived'}}
    )

    if result.modified_count:
        return jsonify({'message': 'Prayer request archived successfully'}), 200
    else:
        return jsonify({'error': 'Failed to archive prayer request'}), 500

@prayer_requests_bp.route('/<request_id>/pray', methods=['POST'])
@jwt_required()
def pray_for_request(request_id):
    user_id = get_jwt_identity()

    prayer_request = mongo.db.prayer_requests.find_one({'_id': ObjectId(request_id)})

    if not prayer_request:
        return jsonify({'error': 'Prayer request not found'}), 404

    # Check if private and if user has access
    if prayer_request['is_private']:
        claims = get_jwt()
        is_author = str(prayer_request['user_id']) == user_id
        is_super_admin = claims.get('role') == 'super_admin'
        is_camp_leader = (
            claims.get('role') == 'camp_leader' and
            prayer_request.get('camp_id') and
            str(prayer_request['camp_id']) == claims.get('camp_id')
        )

        if not (is_author or is_super_admin or is_camp_leader):
            return jsonify({'error': 'Unauthorized access to this prayer request'}), 403

    # Add user to praying list if not already there
    result = mongo.db.prayer_requests.update_one(
        {'_id': ObjectId(request_id)},
        {'$addToSet': {'praying_users': ObjectId(user_id)}}
    )

    return jsonify({'message': 'Successfully added to prayer list'}), 200

@prayer_requests_bp.route('/<request_id>/unpray', methods=['POST'])
@jwt_required()
def unpray_for_request(request_id):
    user_id = get_jwt_identity()

    prayer_request = mongo.db.prayer_requests.find_one({'_id': ObjectId(request_id)})

    if not prayer_request:
        return jsonify({'error': 'Prayer request not found'}), 404

    # Remove user from praying list
    result = mongo.db.prayer_requests.update_one(
        {'_id': ObjectId(request_id)},
        {'$pull': {'praying_users': ObjectId(user_id)}}
    )

    return jsonify({'message': 'Successfully removed from prayer list'}), 200

@prayer_requests_bp.route('/<request_id>/testimony', methods=['POST'])
@jwt_required()
def add_testimony(request_id):
    user_id = get_jwt_identity()
    claims = get_jwt()
    data = request.get_json()

    prayer_request = mongo.db.prayer_requests.find_one({'_id': ObjectId(request_id)})

    if not prayer_request:
        return jsonify({'error': 'Prayer request not found'}), 404

    # Check if user has permission to add testimony
    is_author = str(prayer_request['user_id']) == user_id

    if not is_author:
        return jsonify({'error': 'Only the author can add testimony'}), 403

    if 'testimony_content' not in data:
        return jsonify({'error': 'Testimony content is required'}), 400

    # Update prayer request with testimony
    result = mongo.db.prayer_requests.update_one(
        {'_id': ObjectId(request_id)},
        {
            '$set': {
                'is_testimony': True,
                'testimony_content': data['testimony_content'],
                'status': 'answered'
            }
        }
    )

    if result.modified_count:
        return jsonify({'message': 'Testimony added successfully'}), 200
    else:
        return jsonify({'error': 'Failed to add testimony'}), 500
