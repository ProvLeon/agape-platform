from flask import Blueprint, jsonify
from flask_pymongo import PyMongo
from app import mongo

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    status = {
        'status': 'up',
        'message': 'Service is up and running'
    }

    # Check MongoDB connection
    try:
        # This will trigger a server ping
        mongo.db.command('ping')
        status['mongodb'] = 'connected'
    except Exception as e:
        status['mongodb'] = f'error: {str(e)}'
        status['status'] = 'degraded'

    return jsonify(status)
