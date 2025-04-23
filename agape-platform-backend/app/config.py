import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration."""
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'default-dev-key')
    MONGODB_URI = os.getenv('MONGODB_URI')
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 24  # 24 hours
    UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    # Stricter security settings
    JWT_COOKIE_SECURE = True

# Select config based on environment
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

app_config = config[os.getenv('ENVIRONMENT', 'default')]
