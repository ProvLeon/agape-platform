from flask import Flask
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager
from flask_cors import CORS

from app.config import app_config
import os

# Initialize extensions
mongo = PyMongo()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    app.config.from_object(app_config)

    # Initialize extensions with app
    mongo.init_app(app, uri=app.config['MONGODB_URI'])
    jwt.init_app(app)
    CORS(app)

    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Create database indexes
    with app.app_context():
        # Users collection indexes
        mongo.db.users.create_index('email', unique=True)
        mongo.db.users.create_index('camp_id')

        # Camps collection indexes
        mongo.db.camps.create_index('name')
        mongo.db.camps.create_index('leader_id')

        # Messages collection indexes
        mongo.db.messages.create_index([('recipient_type', 1), ('recipient_id', 1)])
        mongo.db.messages.create_index('sender_id')
        mongo.db.messages.create_index('created_at')

        # Meetings collection indexes
        mongo.db.meetings.create_index('scheduled_start')
        mongo.db.meetings.create_index('camp_id')
        mongo.db.meetings.create_index('host_id')
        mongo.db.meetings.create_index('status')

        # Prayer requests indexes
        mongo.db.prayer_requests.create_index('user_id')
        mongo.db.prayer_requests.create_index('camp_id')
        mongo.db.prayer_requests.create_index('created_at')

        # Notifications indexes
        mongo.db.notifications.create_index([('user_id', 1), ('is_read', 1)])
        mongo.db.notifications.create_index('created_at')

        # Meeting messages indexes
        mongo.db.meeting_messages.create_index('meeting_id')
        mongo.db.meeting_messages.create_index('timestamp')

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.users import users_bp
    from app.routes.camps import camps_bp
    from app.routes.messages import messages_bp
    from app.routes.meetings import meetings_bp as meetings_blueprint
    from app.routes.prayer_requests import prayer_requests_bp
    from app.routes.meeting_messages import meeting_messages_bp as meeting_chat_blueprint
    from app.routes.health import health_bp

    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(camps_bp, url_prefix='/api/camps')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(meetings_blueprint, url_prefix='/api/meetings')
    app.register_blueprint(meeting_chat_blueprint, url_prefix='/api/meetings/messages')
    app.register_blueprint(prayer_requests_bp, url_prefix='/api/prayer-requests')

    # Initialize SocketIO
    from app.services.socket_service import configure_socket
    socketio = configure_socket(app)

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not found'}, 404

    @app.errorhandler(500)
    def server_error(error):
        return {'error': 'Internal server error'}, 500

    return app
