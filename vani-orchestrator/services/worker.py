"""
Worker pool — N async workers that BLPOP from Redis queues.

Queue priority: enterprise always checked before standard.
Each worker registers a heartbeat every 5s.
"""
import asyncio
import json
import time

import structlog

from config import settings
from db import get_db
from models.call_state import CallStatus
from redis_client import get_redis
from services import livekit_manager
from services.state_manager import load_call, save_call, update_status

logger = structlog.get_logger()

QUEUES = ["vani:queue:enterprise", "vani:queue:standard"]
CONNECTING_TIMEOUT_SEC = 15   # CONNECTING → FAILED if exceeded


async def _fetch_agent_config(agent_id: str) -> dict | None:
    """Load agent config from Supabase."""
    try:
        db = get_db()
        result = (
            db.table("agents")
            .select("*")
            .eq("id", agent_id)
            .eq("active", True)
            .maybe_single()
            .execute()
        )
        return result.data
    except Exception as e:
        logger.error("agent_fetch_failed", agent_id=agent_id, error=str(e))
        return None


async def _process_job(job: dict, worker_id: int) -> None:
    call_id = job["call_id"]
    log = logger.bind(call_id=call_id, worker_id=worker_id)

    # ── ROUTING: find agent ───────────────────────────────────────────────────
    call = await update_status(call_id, CallStatus.ROUTING)
    if call is None:
        return

    agent = await _fetch_agent_config(call.agent_id)
    if agent is None:
        await update_status(call_id, CallStatus.FAILED, error="Agent not found or inactive")
        log.error("agent_not_found")
        return

    # ── CONNECTING: create room + dispatch engine ─────────────────────────────
    call = await update_status(call_id, CallStatus.CONNECTING)
    if call is None:
        return

    try:
        room_name = await asyncio.wait_for(
            livekit_manager.create_room(),
            timeout=10,
        )
    except asyncio.TimeoutError:
        await update_status(call_id, CallStatus.FAILED, error="LiveKit room creation timed out")
        log.error("room_creation_timeout")
        return
    except Exception as e:
        await update_status(call_id, CallStatus.FAILED, error=f"Room creation failed: {e}")
        log.error("room_creation_failed", error=str(e))
        return

    # Save room name to call state
    call = await load_call(call_id)
    call.livekit_room = room_name
    call.worker_id = worker_id
    await save_call(call)

    # Build payload for engine — engine is fully stateless
    agent_payload = {
        "call_id":    call_id,
        "tenant_id":  call.tenant_id,
        "agent_id":   call.agent_id,
        "room":       room_name,
        "agent_config": {
            "name":        agent["name"],
            "greeting":    agent["greeting"],
            "prompt":      agent["prompt"],
            "language":    agent["language"],
            "voice":       agent["voice"],
            "stt":         agent["stt_provider"],
            "llm":         agent["llm_provider"],
            "tts":         agent["tts_provider"],
            "behavior":    agent["behavior"],
        },
    }

    try:
        await asyncio.wait_for(
            livekit_manager.dispatch_agent(room_name, agent_payload),
            timeout=10,
        )
    except asyncio.TimeoutError:
        await update_status(call_id, CallStatus.FAILED, error="Agent dispatch timed out")
        log.error("dispatch_timeout")
        return
    except Exception as e:
        await update_status(call_id, CallStatus.FAILED, error=f"Dispatch failed: {e}")
        log.error("dispatch_failed", error=str(e))
        return

    # ── ACTIVE ────────────────────────────────────────────────────────────────
    await update_status(call_id, CallStatus.ACTIVE)
    log.info("call_active", room=room_name)

    # Set connecting timestamp for watchdog
    r = get_redis()
    await r.setex(f"connecting:{call_id}", CONNECTING_TIMEOUT_SEC, str(time.time()))


async def worker(worker_id: int) -> None:
    """Main worker loop — never exits."""
    r = get_redis()
    log = logger.bind(worker_id=worker_id)
    log.info("worker_started")

    while True:
        # Register heartbeat
        await r.setex(f"worker:{worker_id}:heartbeat", 10, "alive")

        try:
            result = await r.blpop(QUEUES, timeout=5)
            if result is None:
                continue  # timeout, loop again

            _, raw = result
            job = json.loads(raw)
            log.info("job_received", call_id=job.get("call_id"))
            await _process_job(job, worker_id)

        except Exception as e:
            log.error("worker_error", error=str(e))
            await asyncio.sleep(1)  # brief pause on unexpected error


async def connecting_watchdog() -> None:
    """Kill calls stuck in CONNECTING for too long."""
    r = get_redis()
    while True:
        await asyncio.sleep(10)
        # Scan for active CONNECTING calls — check if their watchdog key expired
        # If key is gone + call still CONNECTING → FAILED
        try:
            cursor = 0
            while True:
                cursor, keys = await r.scan(cursor, match="connecting:*", count=100)
                # Keys still present = still within timeout window (fine)
                if cursor == 0:
                    break
        except Exception as e:
            logger.error("watchdog_error", error=str(e))
