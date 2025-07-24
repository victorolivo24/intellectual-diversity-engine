import os
from dotenv import load_dotenv

# Load environment variables from .env file
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, ".env"))


class Config:
    """Base configuration class. Contains settings common to all environments."""

    # Secret key for signing sessions and tokens
    SECRET_KEY = os.getenv("SECRET_KEY", "a-very-secret-default-key")

    # Disable a feature of Flask-SQLAlchemy that is often unnecessary
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Load all secret keys from the environment
    SENTRY_DSN = os.getenv("SENTRY_DSN")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")


class DevelopmentConfig(Config):
    """Development-specific configuration."""

    DEBUG = True

    # Use a simple local SQLite database for development
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DEV_DATABASE_URL", "sqlite:///" + os.path.join(basedir, "instance", "dev.db")
    )

    # The redirect URI for local testing
    GOOGLE_REDIRECT_URI = "http://127.0.0.1:5000/auth/google/callback"

    @staticmethod
    def init_app(app):
        # This method is called when the app is created.
        # It's a clean way to set environment variables needed only for development.
        print("--- RUNNING IN DEVELOPMENT MODE ---")
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"


class ProductionConfig(Config):
    """Production-specific configuration."""

    DEBUG = False

    # In production, the DATABASE_URL will be provided by the hosting service (e.g., AWS RDS)
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")

    # In production, this must be the live, HTTPS URL
    # We load it from an environment variable for flexibility.
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")


# A dictionary to easily access the config classes
config_by_name = dict(dev=DevelopmentConfig, prod=ProductionConfig)
