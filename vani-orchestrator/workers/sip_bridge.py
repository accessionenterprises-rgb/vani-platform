"""
SIP → Agent Bridge

Watches for rooms created by SIP inbound calls. When a new SIP room
appears with 1 participant (caller) and no agent, dispatches vani-agent.
Also logs calls to Supabase for dashboard visibility.
"""
import asyncio
import time

import structlog
from livekit import api as lk_api

from config import settings
from db import get_db

logger = structlog.get_logger()

POLL_INTERVAL_SEC = 0.5
MAX_ATTEMPTS = 3
JOIN_WAIT_SEC = 4

_active_rooms: dict[str, int] = {}
_room_calls: dict[str, dict] = {}


def _extract_phone(room_name: str) -> str:
    parts = room_name.split("_")
    for p in parts:
        if p.startswith("+") and len(p) > 5:
            return p
    return ""


def _make_client() -> lk_api.LiveKitAPI:
    return lk_api.LiveKitAPI(
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
    )


async def _list_rooms() -> list[dict]:
    client = _make_client()
    try:
        resp = await client.room.list_rooms(lk_api.ListRoomsRequest())
        return [
            {"name": r.name, "sid": r.sid, "participants": r.num_participants}
            for r in resp.rooms
        ]
    except Exception as e:
        logger.error("sip_bridge_list_failed", error=str(e))
        return []
    finally:
        await client.aclose()


async def _lookup_agent_config(called_number: str) -> dict:
    """Look up agent config from DB by phone number. Returns full metadata for dispatch."""
    try:
        db = get_db()
        _agent_select = "tenant_id,agent_id,agents(id,name,greeting,prompt,language,voice,stt_provider,llm_provider,tts_provider,behavior,active)"

        pn = None
        if called_number:
            pn = db.table("phone_numbers").select(_agent_select).eq("number", called_number).eq("status", "active").limit(1).execute()

        if not pn or not pn.data:
            # Fallback — try all active numbers for this SIP trunk
            pn = db.table("phone_numbers").select(_agent_select).eq("status", "active").in_("number", ["+19209209967", "+12064158862", "+12402128622"]).limit(1).execute()

        if not pn.data:
            return {}

        row = pn.data[0]
        agent = row.get("agents") or {}
        if not agent.get("active"):
            return {}

        return {
            "agent_config": {
                "name": agent.get("name", ""),
                "greeting": agent.get("greeting", ""),
                "prompt": agent.get("prompt", ""),
                "language": agent.get("language", "en"),
                "voice": agent.get("voice", "nova"),
                "stt": agent.get("stt_provider", "deepgram-nova-3"),
                "llm": agent.get("llm_provider", "gpt-4o-mini"),
                "tts": agent.get("tts_provider", "openai"),
                "behavior": agent.get("behavior") or {},
            },
            "agent_id": str(agent.get("id", "")),
            "tenant_id": row.get("tenant_id", ""),
        }
    except Exception as e:
        logger.error("sip_bridge_agent_lookup_failed", error=str(e))
        return {}


async def _dispatch_agent(room_name: str, called_number: str = "") -> bool:
    """Dispatch agent with full config metadata — no Supabase needed on engine side."""
    import json

    # Look up agent config from DB — always try, even without called_number
    metadata = await _lookup_agent_config(called_number or "")
    if metadata:
        logger.info("sip_bridge_agent_loaded", agent=metadata.get("agent_config", {}).get("name", "?"))
    else:
        logger.warning("sip_bridge_no_agent_config", called_number=called_number)

    client = _make_client()
    try:
        await client.agent_dispatch.create_dispatch(
            lk_api.CreateAgentDispatchRequest(
                agent_name=settings.livekit_agent_name,
                room=room_name,
                metadata=json.dumps(metadata) if metadata else "",
            )
        )
        logger.info("sip_bridge_dispatched", room=room_name, has_metadata=bool(metadata))
    except Exception as e:
        logger.error("sip_bridge_dispatch_failed", room=room_name, error=str(e))
        await client.aclose()
        return False

    await client.aclose()
    await asyncio.sleep(JOIN_WAIT_SEC)

    rooms = await _list_rooms()
    for r in rooms:
        if r["name"] == room_name:
            return r["participants"] > 1
    return False


def _is_sip_room(name: str) -> bool:
    return name.startswith("call") and ("+" in name or name.count("_") >= 2)


async def _get_called_number(room_name: str) -> str | None:
    """Get the called number (sip.trunkPhoneNumber) from the SIP participant."""
    client = _make_client()
    try:
        resp = await client.room.list_participants(lk_api.ListParticipantsRequest(room=room_name))
        for p in resp.participants:
            trunk_num = p.attributes.get("sip.trunkPhoneNumber")
            if trunk_num:
                return trunk_num
    except Exception as e:
        logger.warning("sip_bridge_get_called_number_failed", error=str(e))
    finally:
        await client.aclose()
    return None


async def _create_call_record(room_name: str, phone: str) -> str | None:
    try:
        from datetime import datetime, timezone
        db = get_db()

        # Get the number that was called (from SIP participant attributes)
        called_number = await _get_called_number(room_name)

        # Look up agent/tenant from the called number
        if called_number:
            pn = db.table("phone_numbers").select("agent_id, tenant_id").eq("number", called_number).eq("status", "active").limit(1).execute()
        else:
            # Fallback — get from known SIP numbers
            pn = db.table("phone_numbers").select("agent_id, tenant_id").in_("number", ["+19209209967", "+12064158862"]).eq("status", "active").limit(1).execute()
        agent_id = pn.data[0]["agent_id"] if pn.data else None
        tenant_id = pn.data[0]["tenant_id"] if pn.data else None

        result = db.table("calls").insert({
            "phone": phone,
            "agent_id": agent_id,
            "tenant_id": tenant_id,
            "status": "active",
            "direction": "inbound",
            "livekit_room": room_name,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        call_id = result.data[0]["id"] if result.data else None
        logger.info("sip_bridge_call_created", call_id=call_id, phone=phone)
        return call_id
    except Exception as e:
        logger.error("sip_bridge_call_create_failed", error=str(e), phone=phone)
        return None


async def _end_call_record(room_name: str):
    info = _room_calls.pop(room_name, None)
    if not info or not info.get("call_id"):
        return
    try:
        from datetime import datetime, timezone
        db = get_db()
        duration = int(time.time() - info["started_at"])
        db.table("calls").update({
            "status": "completed",
            "duration_sec": duration,
            "ended_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", info["call_id"]).execute()
        logger.info("sip_bridge_call_ended", call_id=info["call_id"], duration=duration)
    except Exception as e:
        logger.warning("sip_bridge_call_end_failed", error=str(e))


async def _cleanup_stale_calls():
    """Mark any calls stuck as 'active' for >10 min as completed (orphaned by restart)."""
    try:
        from datetime import datetime, timezone, timedelta
        db = get_db()
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        result = db.table("calls").update({
            "status": "completed",
            "ended_at": datetime.now(timezone.utc).isoformat(),
        }).eq("status", "active").lt("started_at", cutoff).execute()
        count = len(result.data) if result.data else 0
        if count > 0:
            logger.info("sip_bridge_cleaned_stale_calls", count=count)
    except Exception as e:
        logger.warning("sip_bridge_cleanup_failed", error=str(e))


async def sip_bridge() -> None:
    logger.info("sip_bridge_started")

    # Clean up any orphaned active calls from previous restart
    await _cleanup_stale_calls()

    while True:
        try:
            rooms = await _list_rooms()

            if rooms:
                logger.info("sip_bridge_poll", room_count=len(rooms),
                            rooms=[{"name": r["name"], "p": r["participants"]} for r in rooms])

            for room in rooms:
                name = room["name"]
                participants = room["participants"]

                if not _is_sip_room(name):
                    continue

                if participants > 1:
                    _active_rooms.pop(name, None)
                    continue

                if participants == 0:
                    _active_rooms.pop(name, None)
                    if name in _room_calls:
                        await _end_call_record(name)
                    continue

                attempts = _active_rooms.get(name, 0)

                if attempts >= MAX_ATTEMPTS:
                    logger.warning("sip_bridge_gave_up", room=name)
                    _active_rooms.pop(name, None)
                    if name in _room_calls:
                        await _end_call_record(name)
                    continue

                if attempts == 0:
                    # Skip if already tracked (prevents duplicates from multiple replicas)
                    if name in _room_calls:
                        continue
                    logger.info("sip_bridge_detected", room=name)
                    phone = _extract_phone(name)
                    called_number = await _get_called_number(name) or ""
                    call_id = await _create_call_record(name, phone)
                    _room_calls[name] = {
                        "call_id": call_id,
                        "started_at": time.time(),
                        "phone": phone,
                        "called_number": called_number,
                    }

                _active_rooms[name] = attempts + 1
                called = _room_calls.get(name, {}).get("called_number", "")
                joined = await _dispatch_agent(name, called_number=called)

                if joined:
                    logger.info("sip_bridge_success", room=name, attempt=attempts + 1)
                    _active_rooms.pop(name, None)
                else:
                    logger.warning("sip_bridge_retry", room=name, attempt=attempts + 1)

            # Clean up ended calls
            active_room_names = {r["name"] for r in rooms}
            for room_name in list(_room_calls.keys()):
                if room_name not in active_room_names:
                    await _end_call_record(room_name)

        except Exception as e:
            logger.error("sip_bridge_error", error=str(e))

        await asyncio.sleep(POLL_INTERVAL_SEC)
