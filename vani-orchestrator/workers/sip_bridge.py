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


async def _dispatch_agent(room_name: str) -> bool:
    client = _make_client()
    try:
        await client.agent_dispatch.create_dispatch(
            lk_api.CreateAgentDispatchRequest(
                agent_name=settings.livekit_agent_name,
                room=room_name,
            )
        )
        logger.info("sip_bridge_dispatched", room=room_name)
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


async def _create_call_record(room_name: str, phone: str) -> str | None:
    try:
        from datetime import datetime, timezone
        db = get_db()

        # Get first active phone number's agent
        pn = db.table("phone_numbers").select("agent_id, tenant_id").eq("status", "active").limit(1).execute()
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


async def sip_bridge() -> None:
    logger.info("sip_bridge_started")

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
                    logger.info("sip_bridge_detected", room=name)
                    phone = _extract_phone(name)
                    call_id = await _create_call_record(name, phone)
                    if call_id:
                        _room_calls[name] = {
                            "call_id": call_id,
                            "started_at": time.time(),
                            "phone": phone,
                        }

                _active_rooms[name] = attempts + 1
                joined = await _dispatch_agent(name)

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
