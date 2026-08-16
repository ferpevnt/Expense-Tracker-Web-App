import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent

env_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:

    DATABASE_URL: str = os.getenv("DATABASE_URL")
    if DATABASE_URL is None:
        raise ValueError(
            "DATABASE_URL is not set in .env file!\n"
            "Please create .env file with: DATABASE_URL=postgresql://..."
        )

    ALLOWED_ORIGINS: list = os.getenv("ALLOWED_ORIGINS")
    if ALLOWED_ORIGINS is None or ALLOWED_ORIGINS == "":
        raise ValueError(
            "ALLOWED_ORIGINS is not set in .env file!\n"
            "Please create .env file with: ALLOWED_ORIGINS=http://localhost:5500,..."
        )
    ALLOWED_ORIGINS = ALLOWED_ORIGINS.split(",")

    SECRET_KEY: str = os.getenv("SECRET_KEY")
    if SECRET_KEY is None:
        raise ValueError(
            "SECRET_KEY is not set in .env file\n"
            "Please create .env file with: SECRET_KEY=your_secret_key_here"
        )

    ALGORITHM: str = os.getenv("ALGORITHM") 
    if ALGORITHM is None:
        raise ValueError(
            "ALGORITHM is not set in .env file\n"
            "Please create .env file with: ALGORITHM=your_algorithm"
        )

    ACCESS_TOKEN_EXPIRE_MINUTES: str = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")
    if ACCESS_TOKEN_EXPIRE_MINUTES is None:
        raise ValueError(
            "ACCESS_TOKEN_EXPIRE_MINUTES is not set in .env file\n"
            "Please create .env fike with: ACCESS_TOKEN_EXPIRE_MINUTES=minutes"
        )

settings = Settings()