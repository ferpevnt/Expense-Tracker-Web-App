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


    ALLOWED_ORIGINS: list = os.getenv("ALLOWED_ORIGINS").split(",")

    if ALLOWED_ORIGINS is None:
        raise ValueError(
            "ALLOWED_ORIGINS is not set in .env file!\n"
            "Please create .env file with: ALLOWED_ORIGINS=https://..."
        )


    SECRET_KEY: str = os.getenv("SECRET_KEY")

    if SECRET_KEY is None:
        raise ValueError(
            "SECRET_KEY is not set in .env file\n"
            "Please create .env file with: SECRET_KEY='secret key for creating jwt tokens'"
        )


    ALGORITHM: str = os.getenv("ALGORITHM")

    if ALGORITHM is None:
        raise ValueError(
            "ALGORITHM is not set in .env file\n"
            "Please create .env file with: ALGORITHM='algorithm for creating jwt tokens'"
        )

# ===== CREATING SETTINS OBJECT=====
settings = Settings()
