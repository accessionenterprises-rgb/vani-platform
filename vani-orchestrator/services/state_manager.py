"""Call state — Redis (fast) + Supabase (persistent)."""
import json
from typing import Optional

import structlog

from db import get_db
from models.call_state import CallState, CallStatus
from redis_client import get_redis

logger = structlog.get_logger()

# Redis TTL: 2 hours per call
CALL_TTL = 7200


async def save_call(call: CallState) -> None:
    r = get_redis()
    await r.setex(f"call:{call.call_id}", CALL_TTL, json.dumps(call.to_dict()))

    # Persist to Supabase async-style (best-effort, don't fail on DB error)
    try:
        db = get_db()
        db.table("calls").upsert({
            "id":           call.call_id,
            "tenant_id":    call.tenant_id,
            "agent_id":     call.agent_id,
            "phone":        call.phone,
            "status":       call.status.value,
            "livekit_room": call.livekit_room,
            "direction":    "inbound",
        }).execute()
    except Exception as e:
        logger.warning("supabase_save_failed", call_id=call.call_id, error=str(e))


async def load_call(call_id: str) -> Optional[CallState]:
    r = get_redis()
    raw = await r.get(f"call:{call_id}")
    if raw is None:
        return None
    return CallState.from_dict(json.loads(raw))


async def update_status(call_id: str, new_status: CallStatus, error: str | None = None) -> Optional[CallState]:
    call = await load_call(call_id)
    if call is None:
        logger.error("call_not_found", call_id=call_id)
        return None
    try:
        call.update_status(new_status, error)
    except ValueError as e:
        logger.error("invalid_transition", call_id=call_id, error=str(e))
        return None
    await save_call(call)
    logger.info("call_status_updated", call_id=call_id, status=new_status.value)
    return call


async def set_idempotency_key(sid: str, call_id: str) -> bool:
    """Returns True if key was set (new call), False if already exists."""
    r = get_redis()
    result = await r.set(f"call:sid:{sid}", call_id, nx=True, ex=CALL_TTL)
    return result is not None


async def get_call_id_by_sid(sid: str) -> Optional[str]:
    r = get_redis()
    return await r.get(f"call:sid:{sid}")
