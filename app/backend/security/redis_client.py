import redis
from config.config import settings

redis_client = redis.from_url(settings.REDIS_STORAGE_URI)

