from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from security import auth_token
from jose import JWTError
from config.config import settings
from database.database import SessionLocal
from database import models


def get_user_or_ip(request: Request) -> str:
    
    auth_header = request.headers.get("Authorization")

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            payload = auth_token.verify_auth_token(token) 
            user_id = payload.get("id")
            if user_id:
                return f"user:{user_id}"
        except JWTError:
            pass

    return f"ip:{get_remote_address(request)}"

limiter = Limiter(
    key_func=get_user_or_ip,
    storage_uri=settings.REDIS_STORAGE_URI or None,
)