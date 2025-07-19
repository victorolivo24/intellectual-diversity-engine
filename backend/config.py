import os
from dotenv import load_dotenv

# Load environment variables from .env file
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, ".env"))


class Config:
    """Base configuration."""

    SECRET_KEY = os.getenv("SECRET_KEY", "a-very-secret-default-key")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SENTRY_DSN = os.getenv("SENTRY_DSN")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI = "http://127.0.0.1:5000/auth/google/callback"


class DevelopmentConfig(Config):
    """Development configuration."""

    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DEV_DATABASE_URL", "sqlite:///" + os.path.join(basedir, "instance", "dev.db")
    )
    # Allow insecure transport for local OAuth testing
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"


class ProductionConfig(Config):
    """Production configuration."""

    DEBUG = False
    # In production, you would get this from your hosting provider's environment variables
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    GOOGLE_REDIRECT_URI = "https://your-live-app-url.com/auth/google/callback"  # You will change this later


# A dictionary to easily access the config classes
config_by_name = dict(dev=DevelopmentConfig, prod=ProductionConfig)
