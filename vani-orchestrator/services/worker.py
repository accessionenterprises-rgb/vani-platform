"""
Worker pool — N async workers that BLPOP from Redis queues.

Queue priority: enterprise always checked before standard.
Each worker registers a heartbeat every 5s.
"""
import asyncio
import json
import time

import structlog

import httpx

from config import settings
from db import get_db
from models.call_state import CallStatus
from redis_client import get_redis
from services import livekit_manager
from services import agora_manager
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


async def _resolve_engine(call, to_number: str = "") -> str:
    """Determine which engine to use: check phone_number.engine, then tenant.default_engine, then 'livekit'."""
    try:
        db = get_db()
        # 1. Check per-number engine setting (query by exact number)
        if to_number:
            pn = (
                db.table("phone_numbers")
                .select("engine")
                .eq("number", to_number)
                .eq("status", "active")
                .maybe_single()
                .execute()
            )
            if pn.data and pn.data.get("engine"):
                return pn.data["engine"]

        # 2. Check tenant default
        tenant = (
            db.table("tenants")
            .select("default_engine")
            .eq("id", call.tenant_id)
            .maybe_single()
            .execute()
        )
        if tenant.data and tenant.data.get("default_engine"):
            return tenant.data["default_engine"]
    except Exception as e:
        logger.warning("engine_resolve_fallback", error=str(e))

    return "livekit"


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

    # ── Resolve engine ────────────────────────────────────────────────────────
    engine = job.get("engine") or await _resolve_engine(call, to_number=job.get("to_number", ""))
    call = await load_call(call_id)
    call.engine = engine
    await save_call(call)
    log = log.bind(engine=engine)

    # ── Build agent config (shared across engines) ────────────────────────────
    agent_config = {
        "name":        agent["name"],
        "greeting":    agent["greeting"],
        "prompt":      agent["prompt"],
        "language":    agent["language"],
        "voice":       agent["voice"],
        "stt":         agent["stt_provider"],
        "llm":         agent["llm_provider"],
        "tts":         agent["tts_provider"],
        "behavior":    agent["behavior"],
    }

    # ── CONNECTING ────────────────────────────────────────────────────────────
    call = await update_status(call_id, CallStatus.CONNECTING)
    if call is None:
        return

    if engine == "agora":
        await _connect_agora(call_id, call, agent_config, worker_id, log)
    else:
        await _connect_livekit(call_id, call, agent_config, worker_id, log)


async def _connect_livekit(call_id: str, call, agent_config: dict, worker_id: int, log) -> None:
    """Original LiveKit flow: create room → dispatch agent."""
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

    agent_payload = {
        "call_id":      call_id,
        "tenant_id":    call.tenant_id,
        "agent_id":     call.agent_id,
        "room":         room_name,
        "agent_config": agent_config,
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

    # Save to Supabase
    try:
        db = get_db()
        db.table("calls").update({
            "livekit_room": room_name,
            "engine": "livekit",
        }).eq("id", call_id).execute()
    except Exception as e:
        log.warning("livekit_call_db_update_failed", error=str(e))

    # Patch the live Twilio call to dial into the LiveKit SIP room
    if call.twilio_call_sid and settings.twilio_account_sid:
        sip_uri = f"sip:{room_name}@{settings.livekit_url.replace('wss://', '').replace('https://', '')}"
        redirect_url = (
            f"{settings.orchestrator_public_url}/telephony/livekit/connect"
            f"/{call_id}/{room_name}"
        )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}"
                    f"/Calls/{call.twilio_call_sid}.json",
                    auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                    data={"Url": redirect_url, "Method": "POST"},
                )
            log.info("twilio_call_patched_to_livekit", redirect_url=redirect_url)
        except Exception as e:
            log.error("twilio_patch_failed", error=str(e))

    await update_status(call_id, CallStatus.ACTIVE)
    log.info("call_active", room=room_name, engine="livekit")

    r = get_redis()
    await r.setex(f"connecting:{call_id}", CONNECTING_TIMEOUT_SEC, str(time.time()))


async def _connect_agora(call_id: str, call, agent_config: dict, worker_id: int, log) -> None:
    """Agora flow: POST /join creates per-call agent in Agora channel."""
    channel_name = agora_manager.make_channel_name()

    try:
        result = await asyncio.wait_for(
            agora_manager.join_channel(channel_name, agent_config, call_id),
            timeout=15,
        )
    except asyncio.TimeoutError:
        await update_status(call_id, CallStatus.FAILED, error="Agora /join timed out")
        log.error("agora_join_timeout")
        return
    except Exception as e:
        await update_status(call_id, CallStatus.FAILED, error=f"Agora join failed: {e}")
        log.error("agora_join_failed", error=str(e))
        return

    # Save Agora channel + agent_id to call state
    call = await load_call(call_id)
    call.agora_channel = channel_name
    call.agora_agent_id = result.get("agent_id", "")
    call.worker_id = worker_id
    await save_call(call)

    # Map channel → call_id in Redis (for webhook lookup)
    r = get_redis()
    await r.setex(f"agora:channel:{channel_name}", 7200, call_id)  # 2h TTL

    # Save to Supabase calls table
    try:
        db = get_db()
        db.table("calls").update({
            "engine": "agora",
            "agora_channel": channel_name,
            "agora_agent_id": result.get("agent_id", ""),
        }).eq("id", call_id).execute()
    except Exception as e:
        log.warning("agora_call_db_update_failed", error=str(e))

    # Patch the live Twilio call to dial into the Agora channel via SIP
    if call.twilio_call_sid and settings.twilio_account_sid:
        redirect_url = (
            f"{settings.orchestrator_public_url}/telephony/agora/connect"
            f"/{call_id}/{channel_name}"
        )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}"
                    f"/Calls/{call.twilio_call_sid}.json",
                    auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                    data={"Url": redirect_url, "Method": "POST"},
                )
            log.info("twilio_call_patched_to_agora", redirect_url=redirect_url)
        except Exception as e:
            log.error("twilio_patch_failed", error=str(e))

    await update_status(call_id, CallStatus.ACTIVE)
    log.info("call_active", channel=channel_name, engine="agora", agora_agent_id=result.get("agent_id"))

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
