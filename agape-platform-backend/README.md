# Agape Platform Backend

A robust backend API for the Agape Ministries platform, providing communication tools, meeting management, and spiritual growth features for ministry organization.

## Overview

The Agape Platform backend is built with Flask and MongoDB, offering a comprehensive API for ministry organizations to manage camps (groups), prayer requests, meetings, and communications. It includes real-time capabilities through WebSockets for instant messaging and meeting interactions.

## Features

- **Authentication System** - JWT-based authentication with role-based access control
- **User Management** - Profile management with spiritual gifts and camp assignments
- **Communication Hub** - Ministry-wide, camp-specific and direct messaging
- **Meeting System** - Schedule, manage, and host virtual meetings
- **Real-time Interactions** - WebSocket support for live chat and meeting participation
- **Prayer Request Management** - Submit, track, and respond to prayer needs
- **Camp Organization** - Create and manage ministry groups with dedicated leadership

## Technology Stack

- **Framework**: Flask
- **Database**: MongoDB
- **Authentication**: Flask-JWT-Extended
- **Real-time Communication**: Flask-SocketIO
- **API Documentation**: Included in project documentation

## Getting Started

### Prerequisites

- Python 3.8+
- MongoDB
- Virtual environment (recommended)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-organization/agape-platform.git
cd agape-platform/agape-platform-backend
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file with the following variables:
```
JWT_SECRET_KEY=your-secret-key
MONGODB_URI=mongodb://localhost:27017/agape
ENVIRONMENT=development
```

5. Run the application:
```bash
python run.py
```

The API will be available at `http://localhost:5000/api/`.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate user and get token
- `GET /api/auth/me` - Get current user info
- `PUT /api/auth/change-password` - Update password
- `POST /api/auth/socket-token` - Get token for WebSocket authentication

### Users
- `GET /api/users/` - List users (admin only)
- `GET /api/users/<user_id>` - Get user details
- `POST /api/users/` - Create user (admin only)
- `PUT /api/users/<user_id>` - Update user info
- `DELETE /api/users/<user_id>` - Deactivate user (admin only)

### Camps
- `GET /api/camps/` - List camps
- `GET /api/camps/<camp_id>` - Get camp details
- `POST /api/camps/` - Create camp (admin only)
- `PUT /api/camps/<camp_id>` - Update camp
- `DELETE /api/camps/<camp_id>` - Delete camp (admin only)
- `GET /api/camps/<camp_id>/members` - List camp members

### Meetings
- `GET /api/meetings/` - List meetings
- `GET /api/meetings/<meeting_id>` - Get meeting details
- `POST /api/meetings/` - Create meeting
- `PUT /api/meetings/<meeting_id>` - Update meeting
- `DELETE /api/meetings/<meeting_id>` - Cancel meeting
- `POST /api/meetings/<meeting_id>/attend` - Join meeting
- `POST /api/meetings/<meeting_id>/leave` - Leave meeting
- `POST /api/meetings/<meeting_id>/start` - Start meeting
- `POST /api/meetings/<meeting_id>/end` - End meeting

### Messages
- `GET /api/messages/` - List messages
- `GET /api/messages/<message_id>` - Get message details
- `POST /api/messages/` - Create message
- `DELETE /api/messages/<message_id>` - Delete message
- `POST /api/messages/<message_id>/read` - Mark message as read
- `POST /api/messages/attachment` - Upload message attachment

### Prayer Requests
- `GET /api/prayer-requests/` - List prayer requests
- `GET /api/prayer-requests/<request_id>` - Get prayer request details
- `POST /api/prayer-requests/` - Create prayer request
- `PUT /api/prayer-requests/<request_id>` - Update prayer request
- `DELETE /api/prayer-requests/<request_id>` - Archive prayer request
- `POST /api/prayer-requests/<request_id>/pray` - Indicate praying for request
- `POST /api/prayer-requests/<request_id>/unpray` - Remove praying indication
- `POST /api/prayer-requests/<request_id>/testimony` - Add testimony to answered prayer

### Meeting Messages
- `GET /api/meetings/messages/<meeting_id>/messages` - Get messages for a meeting
- `POST /api/meetings/messages/<meeting_id>/messages` - Send message in a meeting

## WebSocket API

The platform includes a WebSocket interface for real-time features. For detailed documentation, see [socket_api_documentation.md](socket_api_documentation.md).

## Database Schema

For information about the MongoDB collections and their structure, refer to [schema.md](schema.md).

## Development

### Project Structure

```
agape-platform-backend/
├── app/
│   ├── models/         # Data models
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   ├── utils/          # Helper functions
│   ├── __init__.py     # Application factory
│   └── config.py       # Configuration
├── uploads/            # Storage for uploaded files
├── run.py              # Application entry point
└── requirements.txt    # Dependencies
```

### Testing

Run tests with:

```bash
pytest
```

## Deployment

For production deployment, set the following environment variables:

```
ENVIRONMENT=production
JWT_SECRET_KEY=strong-random-key
MONGODB_URI=your-production-mongodb-uri
```

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

For support or inquiries, please contact [your-email@example.com](mailto:your-email@example.com).
