import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    APP_NAME: str = "Personal Outreach Engine"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./outreach.db")
    GMAIL_USER: str = os.getenv("GMAIL_USER", "anandpraroop@gmail.com")
    GMAIL_APP_PASSWORD: str = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")
    GOOGLE_CLIENT_SECRETS_FILE: str = os.getenv("GOOGLE_CLIENT_SECRETS_FILE", "All for One GCP.json")
    IMAP_HOST: str = "imap.gmail.com"
    IMAP_PORT: int = 993
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 465
    PORT: int = int(os.getenv("PORT", "8437"))

    # X / Twitter OAuth 2.0 Settings
    X_CLIENT_ID: str = os.getenv("X_CLIENT_ID", "")
    X_CLIENT_SECRET: str = os.getenv("X_CLIENT_SECRET", "")
    X_REDIRECT_URI: str = os.getenv("X_REDIRECT_URI", "http://localhost:8437/api/auth/x/callback")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
