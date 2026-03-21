"""Redis singleton — async client."""
from functools import lru_cache

import redis.asyncio as aioredis

from config import settings


@lru_cache(maxsize=1)
def get_redis() -> aioredis.Redis:
    return aioredis.from_url(settings.redis_url, decode_responses=True)
