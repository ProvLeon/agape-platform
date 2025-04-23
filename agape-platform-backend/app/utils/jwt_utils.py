from flask_jwt_extended import create_access_token
from datetime import datetime, timezone, timedelta

def create_socket_token(user_id, role, camp_id=None):
    """Create a special token for socket authentication with short expiry"""
    additional_claims = {
        'role': role,
    }

    if camp_id:
        additional_claims['camp_id'] = camp_id

    # Create token with shorter expiry (2 hours)
    token = create_access_token(
        identity=user_id,
        additional_claims=additional_claims,
        expires_delta=timedelta(hours=2)
    )
    return token
