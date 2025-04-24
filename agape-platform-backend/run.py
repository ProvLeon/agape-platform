import eventlet
eventlet.monkey_patch() # <-- MUST BE CALLED FIRST!

from app import create_app
from app.services.socket_service import socketio
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Create the Flask app instance AFTER monkey patching
app = create_app()

# This block is only executed when running the script directly (e.g., python run.py)
# Gunicorn finds the 'app' variable directly and doesn't run this __main__ block.
if __name__ == '__main__':
    try:
        # When running directly with eventlet, often better to disable Flask debug mode
        # Use host='0.0.0.0' to make it accessible on your network during development
        socketio.run(app, host='0.0.0.0', port=5000, debug=False)
    except Exception as e:
        logging.error(f"Failed to start server: {str(e)}")
