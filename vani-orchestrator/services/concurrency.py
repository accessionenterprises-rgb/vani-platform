"""
Per-tenant concurrent call limit enforcement.

Uses a Redis SET per tenant: inflight:{tenant_id}
SADD on call start, SREM on call end, TTL=3600 (self-heals crashed workers).
SCARD = current inflight count.
"""
import structlog

from redis_client import get_redis

logger = structlog.get_logger()

PLAN_LIMITS = {
    "starter":    5,
    "growth":    20,
    "enterprise": 100,
}
DEFAULT_LIMIT = 5
INFLIGHT_TTL  = 3600  # 1h — self-healing TTL


async def check_and_reserve(tenant_id: str, call_id: str, plan: str, max_concurrent: int | None) -> bool:
    """
    Try to reserve a concurrency slot.
    Returns True if allowed, False if at limit.
    Side effect: adds call_id to inflight set (with TTL on the key).
    """
    r = get_redis()
    limit = max_concurrent or PLAN_LIMITS.get(plan, DEFAULT_LIMIT)

    # Atomic check+add: use a Lua script to prevent race conditions
    lua_script = """
    local key = KEYS[1]
    local call_id = ARGV[1]
    local limit = tonumber(ARGV[2])
    local ttl = tonumber(ARGV[3])
    local current = redis.call('SCARD', key)
    if current >= limit then
        return 0
    end
    redis.call('SADD', key, call_id)
    redis.call('EXPIRE', key, ttl)
    return 1
    """
    result = await r.eval(lua_script, 1, f"inflight:{tenant_id}", call_id, str(limit), str(INFLIGHT_TTL))
    allowed = bool(result)

    if not allowed:
        logger.warning("concurrency_limit_reached",
                       tenant_id=tenant_id, call_id=call_id, limit=limit,
                       plan=plan)
    return allowed


async def release(tenant_id: str, call_id: str) -> None:
    """Release a concurrency slot when call ends."""
    r = get_redis()
    await r.srem(f"inflight:{tenant_id}", call_id)


async def get_inflight_count(tenant_id: str) -> int:
    r = get_redis()
    return await r.scard(f"inflight:{tenant_id}") or 0


async def get_limit(plan: str, max_concurrent: int | None) -> int:
    return max_concurrent or PLAN_LIMITS.get(plan, DEFAULT_LIMIT)
