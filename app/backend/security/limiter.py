from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from jose import JWTError
from config.config import settings
from security import auth_token


def get_user_or_ip(request: Request) -> str:
    
    auth_header = request.headers.get("Authorization")

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            token_data = auth_token.verify_auth_token_soft(token)
            if token_data and token_data.id:
                return f"user:{token_data.id}"
        except Exception:
            pass

    return f"ip:{get_remote_address(request)}"

limiter = Limiter(
    key_func=get_user_or_ip,
    storage_uri=settings.REDIS_STORAGE_URI or None,
)