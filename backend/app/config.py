import os
import logging
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
logger = logging.getLogger(__name__)


class Settings:
    APP_NAME = "WaterWise AI"
    APP_VERSION = "1.0.0"
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    DEBUG = os.getenv("DEBUG", "true").lower() == "true"
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./waterwise.db")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    API_PREFIX = "/api"
    AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "").strip()
    if not AUTH_SECRET_KEY:
        if ENVIRONMENT.lower() == "production":
            raise RuntimeError("AUTH_SECRET_KEY must be configured in production.")
        AUTH_SECRET_KEY = secrets.token_urlsafe(48)
        logger.warning("AUTH_SECRET_KEY is unset; generated an ephemeral development key. Existing sessions will expire on restart.")


settings = Settings()
