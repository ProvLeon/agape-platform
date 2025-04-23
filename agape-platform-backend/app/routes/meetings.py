from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson.objectid import ObjectId
from datetime import datetime, timezone, timedelta

from app import mongo
from app.services.notification_service import send_meeting_notification

meetings_bp = Blueprint('meetings', __name__)

@meetings_bp.route('/', methods=['POST'])
@jwt_required()
def create_meeting():
    user_id = get_jwt_identity()
    claims = get_jwt()
    data = request.get_json()

    # Validate required fields
    required_fields = ['title', 'scheduled_start', 'scheduled_end', 'meeting_type']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Validate dates
    try:
        scheduled_start = datetime.fromisoformat(data['scheduled_start'])
        scheduled_end = datetime.fromisoformat(data['scheduled_end'])

        if scheduled_end <= scheduled_start:
            return jsonify({'error': 'End time must be after start time'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    # Check permission to create meeting
    is_admin = claims.get('role') == 'super_admin'
    is_camp_leader = claims.get('role') == 'camp_leader'

    # If creating camp meeting, check if user is camp leader of that camp
    if 'camp_id' in data and data['camp_id']:
        if not is_admin and not is_camp_leader:
            return jsonify({'error': 'Only admins and camp leaders can create camp meetings'}), 403

        if is_camp_leader and claims.get('camp_id') != data['camp_id']:
            return jsonify({'error': 'You can only create meetings for your own camp'}), 403
    else:
        # Ministry-wide meetings can only be created by super admins
        if not is_admin:
            return jsonify({'error': 'Only super admins can create ministry-wide meetings'}), 403

    # Prepare meeting document
    new_meeting = {
        'title': data['title'],
        'description': data.get('description', ''),
        'scheduled_start': scheduled_start,
        'scheduled_end': scheduled_end,
        'host_id': ObjectId(user_id),
        'meeting_type': data['meeting_type'],
        'camp_id': ObjectId(data['camp_id']) if 'camp_id' in data and data['camp_id'] else None,
        'is_recurring': data.get('is_recurring', False),
        'recurring_pattern': data.get('recurring_pattern'),
        'meeting_link': data.get('meeting_link'),
        'status': 'scheduled',
        'created_at': datetime.now(timezone.utc),
        'attendees': [],
        'recording_url': None
    }

    result = mongo.db.meetings.insert_one(new_meeting)

    if result.inserted_id:
        # Send notifications to relevant users
        meeting_id = str(result.inserted_id)
        send_meeting_notification(meeting_id, 'created')

        return jsonify({
            'message': 'Meeting created successfully',
            'meeting_id': meeting_id
        }), 201
    else:
        return jsonify({'error': 'Failed to create meeting'}), 500

@meetings_bp.route('/', methods=['GET'])
@jwt_required()
def get_meetings():
    user_id = get_jwt_identity()
    claims = get_jwt()

    # Default filters
    filters = {}

    # Filter by status
    status = request.args.get('status')
    if status:
        filters['status'] = status

    # Filter by meeting type
    meeting_type = request.args.get('type')
    if meeting_type:
        filters['meeting_type'] = meeting_type

    # Date range filtering
    if 'from_date' in request.args:
        try:
            from_date = datetime.fromisoformat(request.args['from_date'])
            filters['scheduled_start'] = {'$gte': from_date}
        except ValueError:
            pass

    if 'to_date' in request.args:
        try:
            to_date = datetime.fromisoformat(request.args['to_date'])
            if 'scheduled_start' in filters:
                filters['scheduled_start']['$lte'] = to_date
            else:
                filters['scheduled_start'] = {'$lte': to_date}
        except ValueError:
            pass

    # Filter for upcoming meetings
    if 'upcoming' in request.args and request.args['upcoming'].lower() == 'true':
        now = datetime.now(timezone.utc)
        if 'scheduled_start' in filters:
            filters['scheduled_start']['$gte'] = now
        else:
            filters['scheduled_start'] = {'$gte': now}

    # Filter by camp
    if 'camp_id' in request.args and request.args['camp_id']:
        filters['camp_id'] = ObjectId(request.args['camp_id'])

    # User-specific filtering
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})

    # Regular members see ministry-wide meetings and their camp's meetings
    if not claims.get('role') in ['super_admin', 'camp_leader']:
        if not user or not user.get('camp_id'):
            # User without camp can only see ministry-wide meetings
            filters['$or'] = [{'camp_id': None}]
        else:
            # User with camp can see ministry-wide and their camp's meetings
            filters['$or'] = [
                {'camp_id': None},
                {'camp_id': user['camp_id']}
            ]

    # Camp leaders see ministry-wide meetings and their camp's meetings
    elif claims.get('role') == 'camp_leader':
        if not 'camp_id' in request.args:  # If not specifically filtering by camp
            filters['$or'] = [
                {'camp_id': None},
                {'camp_id': ObjectId(claims.get('camp_id'))}
            ]

    # Super admins can see all meetings
    # Default: no additional filtering needed

    # Pagination
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    skip = (page - 1) * per_page

    # Execute query
    total = mongo.db.meetings.count_documents(filters)

    # Sort by start time, closest first
    meetings_cursor = mongo.db.meetings.find(filters).sort(
        'scheduled_start', 1
    ).skip(skip).limit(per_page)

    # Process results
    meetings = []
    for meeting in meetings_cursor:
        meeting['_id'] = str(meeting['_id'])
        meeting['host_id'] = str(meeting['host_id'])
        if 'camp_id' in meeting and meeting['camp_id']:
            meeting['camp_id'] = str(meeting['camp_id'])

        # Add host information
        host = mongo.db.users.find_one(
            {'_id': ObjectId(meeting['host_id'])},
            {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
        )
        if host:
            host['_id'] = str(host['_id'])
            meeting['host'] = host

        # Add camp information if applicable
        if 'camp_id' in meeting and meeting['camp_id']:
            camp = mongo.db.camps.find_one(
                {'_id': ObjectId(meeting['camp_id'])},
                {'name': 1}
            )
            if camp:
                meeting['camp_name'] = camp['name']

        # Convert attendees to strings
        meeting['attendees'] = [str(uid) for uid in meeting.get('attendees', [])]

        # Check if current user is attending
        meeting['is_attending'] = ObjectId(user_id) in meeting.get('attendees', [])

        meetings.append(meeting)

    return jsonify({
        'meetings': meetings,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }), 200

@meetings_bp.route('/<meeting_id>', methods=['GET'])
@jwt_required()
def get_meeting(meeting_id):
    user_id = get_jwt_identity()

    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    # Check if user has access to this meeting
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})

    can_access = True  # Allow access by default, restrict in specific cases

    # If it's a camp meeting, check if user is in that camp
    if meeting.get('camp_id') and user and user.get('camp_id') != meeting['camp_id']:
        claims = get_jwt()
        # Super admins can access any meeting
        if claims.get('role') != 'super_admin':
            can_access = False

    if not can_access:
        return jsonify({'error': 'Unauthorized access to this meeting'}), 403

    # Format response
    meeting['_id'] = str(meeting['_id'])
    meeting['host_id'] = str(meeting['host_id'])
    if 'camp_id' in meeting and meeting['camp_id']:
        meeting['camp_id'] = str(meeting['camp_id'])

    # Add host information
    host = mongo.db.users.find_one(
        {'_id': ObjectId(meeting['host_id'])},
        {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
    )
    if host:
        host['_id'] = str(host['_id'])
        meeting['host'] = host

    # Add camp information if applicable
    if 'camp_id' in meeting and meeting['camp_id']:
        camp = mongo.db.camps.find_one({'_id': ObjectId(meeting['camp_id'])})
        if camp:
            camp['_id'] = str(camp['_id'])
            meeting['camp'] = camp

    # Convert attendees to strings
    meeting['attendees'] = [str(uid) for uid in meeting.get('attendees', [])]

    # Check if current user is attending
    meeting['is_attending'] = ObjectId(user_id) in meeting.get('attendees', [])

    # Add attendee details
    if meeting.get('attendees'):
        attendees_details = []
        for attendee_id in meeting['attendees']:
            attendee = mongo.db.users.find_one(
                {'_id': ObjectId(attendee_id)},
                {'password_hash': 0, 'first_name': 1, 'last_name': 1, 'profile_image': 1}
            )
            if attendee:
                attendee['_id'] = str(attendee['_id'])
                attendees_details.append(attendee)

        meeting['attendees_details'] = attendees_details

    return jsonify({'meeting': meeting}), 200

@meetings_bp.route('/<meeting_id>', methods=['PUT'])
@jwt_required()
def update_meeting(meeting_id):
    user_id = get_jwt_identity()
    claims = get_jwt()
    data = request.get_json()

    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    # Check if user has permission to update this meeting
    is_host = str(meeting['host_id']) == user_id
    is_super_admin = claims.get('role') == 'super_admin'
    is_camp_leader = claims.get('role') == 'camp_leader' and str(meeting.get('camp_id')) == claims.get('camp_id')

    if not (is_host or is_super_admin or is_camp_leader):
        return jsonify({'error': 'Unauthorized to update this meeting'}), 403

    # Prepare update data
    update_data = {}

    # Fields that can be updated
    allowed_fields = ['title', 'description', 'meeting_link', 'status']
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    # Handle date updates with validation
    if 'scheduled_start' in data or 'scheduled_end' in data:
        start = data.get('scheduled_start', meeting['scheduled_start'].isoformat())
        end = data.get('scheduled_end', meeting['scheduled_end'].isoformat())

        try:
            scheduled_start = datetime.fromisoformat(start)
            scheduled_end = datetime.fromisoformat(end)

            if scheduled_end <= scheduled_start:
                return jsonify({'error': 'End time must be after start time'}), 400

            update_data['scheduled_start'] = scheduled_start
            update_data['scheduled_end'] = scheduled_end

        except ValueError:
            return jsonify({'error': 'Invalid date format'}), 400

    # Handle recurring pattern update
    if 'is_recurring' in data:
        update_data['is_recurring'] = data['is_recurring']

    if 'recurring_pattern' in data:
        update_data['recurring_pattern'] = data['recurring_pattern']

    # Recording URL can only be updated by host or admins
    if 'recording_url' in data and (is_host or is_super_admin or is_camp_leader):
        update_data['recording_url'] = data['recording_url']

    if not update_data:
        return jsonify({'message': 'No fields to update'}), 200

    result = mongo.db.meetings.update_one(
        {'_id': ObjectId(meeting_id)},
        {'$set': update_data}
    )

    if result.modified_count:
        # Send notifications for status changes
        if 'status' in update_data and update_data['status'] != meeting['status']:
            send_meeting_notification(meeting_id, 'status_changed', new_status=update_data['status'])
        elif 'scheduled_start' in update_data or 'scheduled_end' in update_data:
            send_meeting_notification(meeting_id, 'rescheduled')

        return jsonify({'message': 'Meeting updated successfully'}), 200
    else:
        return jsonify({'message': 'No changes made'}), 200

@meetings_bp.route('/<meeting_id>', methods=['DELETE'])
@jwt_required()
def delete_meeting(meeting_id):
    user_id = get_jwt_identity()
    claims = get_jwt()

    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    # Check if user has permission to delete this meeting
    is_host = str(meeting['host_id']) == user_id
    is_super_admin = claims.get('role') == 'super_admin'
    is_camp_leader = claims.get('role') == 'camp_leader' and str(meeting.get('camp_id')) == claims.get('camp_id')

    if not (is_host or is_super_admin or is_camp_leader):
        return jsonify({'error': 'Unauthorized to delete this meeting'}), 403

    # Instead of actual deletion, update status to 'cancelled'
    result = mongo.db.meetings.update_one(
        {'_id': ObjectId(meeting_id)},
        {'$set': {'status': 'cancelled'}}
    )

    if result.modified_count:
        # Send cancellation notification
        send_meeting_notification(meeting_id, 'cancelled')

        return jsonify({'message': 'Meeting cancelled successfully'}), 200
    else:
        return jsonify({'error': 'Failed to cancel meeting'}), 500

@meetings_bp.route('/<meeting_id>/attend', methods=['POST'])
@jwt_required()
def attend_meeting(meeting_id):
    user_id = get_jwt_identity()

    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    # Check if meeting is still open for attendance
    if meeting['status'] not in ['scheduled', 'in_progress']:
        return jsonify({'error': 'Cannot attend a completed or cancelled meeting'}), 400

    # Check if user has access to this meeting
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})

    can_access = True  # Allow access by default, restrict in specific cases

    # If it's a camp meeting, check if user is in that camp
    if meeting.get('camp_id') and user and user.get('camp_id') != meeting['camp_id']:
        claims = get_jwt()
        # Super admins can access any meeting
        if claims.get('role') != 'super_admin':
            can_access = False

    if not can_access:
        return jsonify({'error': 'Unauthorized access to this meeting'}), 403

    # Add user to attendees if not already there
    result = mongo.db.meetings.update_one(
        {'_id': ObjectId(meeting_id)},
        {'$addToSet': {'attendees': ObjectId(user_id)}}
    )

    return jsonify({'message': 'Successfully registered attendance'}), 200

@meetings_bp.route('/<meeting_id>/leave', methods=['POST'])
@jwt_required()
def leave_meeting(meeting_id):
    user_id = get_jwt_identity()

    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    # Check if meeting is still open for changes
    if meeting['status'] not in ['scheduled', 'in_progress']:
        return jsonify({'error': 'Cannot leave a completed or cancelled meeting'}), 400

    # Remove user from attendees
    result = mongo.db.meetings.update_one(
        {'_id': ObjectId(meeting_id)},
        {'$pull': {'attendees': ObjectId(user_id)}}
    )

    return jsonify({'message': 'Successfully unregistered attendance'}), 200

@meetings_bp.route('/<meeting_id>/start', methods=['POST'])
@jwt_required()
def start_meeting(meeting_id):
    user_id = get_jwt_identity()
    claims = get_jwt()

    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    # Check if user has permission to start this meeting
    is_host = str(meeting['host_id']) == user_id
    is_super_admin = claims.get('role') == 'super_admin'
    is_camp_leader = claims.get('role') == 'camp_leader' and str(meeting.get('camp_id')) == claims.get('camp_id')

    if not (is_host or is_super_admin or is_camp_leader):
        return jsonify({'error': 'Unauthorized to start this meeting'}), 403

    # Check if meeting is in a startable state
    if meeting['status'] != 'scheduled':
        return jsonify({'error': f'Cannot start a meeting with status: {meeting["status"]}'}), 400

    # Update meeting status to in_progress
    result = mongo.db.meetings.update_one(
        {'_id': ObjectId(meeting_id)},
        {'$set': {'status': 'in_progress'}}
    )

    if result.modified_count:
        # Send notification
        send_meeting_notification(meeting_id, 'started')

        return jsonify({'message': 'Meeting started successfully'}), 200
    else:
        return jsonify({'error': 'Failed to start meeting'}), 500

@meetings_bp.route('/<meeting_id>/end', methods=['POST'])
@jwt_required()
def end_meeting(meeting_id):
    user_id = get_jwt_identity()
    claims = get_jwt()

    meeting = mongo.db.meetings.find_one({'_id': ObjectId(meeting_id)})

    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404

    # Check if user has permission to end this meeting
    is_host = str(meeting['host_id']) == user_id
    is_super_admin = claims.get('role') == 'super_admin'
    is_camp_leader = claims.get('role') == 'camp_leader' and str(meeting.get('camp_id')) == claims.get('camp_id')

    if not (is_host or is_super_admin or is_camp_leader):
        return jsonify({'error': 'Unauthorized to end this meeting'}), 403

    # Check if meeting is in progress
    if meeting['status'] != 'in_progress':
        return jsonify({'error': f'Cannot end a meeting with status: {meeting["status"]}'}), 400

    # Update meeting status to completed
    recording_url = request.json.get('recording_url') if request.is_json else None

    update_data = {'status': 'completed'}
    if recording_url:
        update_data['recording_url'] = recording_url

    result = mongo.db.meetings.update_one(
        {'_id': ObjectId(meeting_id)},
        {'$set': update_data}
    )

    if result.modified_count:
        # Send notification
        send_meeting_notification(meeting_id, 'ended')

        return jsonify({'message': 'Meeting ended successfully'}), 200
    else:
        return jsonify({'error': 'Failed to end meeting'}), 500
