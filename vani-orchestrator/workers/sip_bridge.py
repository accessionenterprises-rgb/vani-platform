"""
SIP → Agent Bridge

Watches for rooms created by SIP inbound calls (LiveKit dispatch rules
don't auto-dispatch agents for external SIP trunks). When a new SIP room
appears with 0 agent participants, dispatches vani-agent with retry logic.

Runs as an async background task alongside existing workers.
"""
import asyncio
import json

import structlog

from config import settings
from db import get_db
from services import livekit_manager

logger = structlog.get_logger()

# How often to poll for new SIP rooms
POLL_INTERVAL_SEC = 1.5

# Max dispatch attempts before giving up
MAX_ATTEMPTS = 3

# Wait time after dispatch before checking if agent joined
JOIN_WAIT_SEC = 4

# Track rooms we're already handling
_active_rooms: dict[str, int] = {}  # room_name -> attempt count


async def _get_rooms() -> list[dict]:
    """List all active LiveKit rooms via the SDK."""
    try:
        lk = lk_api_client()
        rooms = await lk.room.list_rooms(lk_api.ListRoomsRequest())
        return [
            {"name": r.name, "sid": r.sid, "participants": r.num_participants}
            for r in rooms
        ]
    except Exception:
        # Fallback to CLI
        try:
            out = await livekit_manager._run([
                *livekit_manager._LK_BASE, "room", "list", "--json",
            ])
            return json.loads(out) if out.strip() else []
        except Exception as e:
            logger.error("sip_bridge_room_list_failed", error=str(e))
            return []


def lk_api_client():
    """Create a LiveKit API client."""
    from livekit import api as lk_api
    return lk_api.LiveKitAPI(
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
    )


from livekit import api as lk_api


async def _get_rooms_sdk() -> list[dict]:
    """List rooms via SDK."""
    try:
        client = lk_api.LiveKitAPI(
            settings.livekit_url,
            settings.livekit_api_key,
            settings.livekit_api_secret,
        )
        resp = await client.room.list_rooms(lk_api.ListRoomsRequest())
        await client.aclose()
        return [
            {"name": r.name, "sid": r.sid, "participants": r.num_participants}
            for r in resp.rooms
        ]
    except Exception as e:
        logger.error("sip_bridge_sdk_failed", error=str(e))
        return []


async def _dispatch_to_room(room_name: str) -> bool:
    """Dispatch vani-agent to a room. Returns True if agent joined."""
    try:
        await livekit_manager._run([
            *livekit_manager._LK_BASE, "dispatch", "create",
            "--agent-name", settings.livekit_agent_name,
            "--room", room_name,
        ])
        logger.info("sip_bridge_dispatched", room=room_name)

        # Wait and check if agent joined
        await asyncio.sleep(JOIN_WAIT_SEC)

        rooms = await _get_rooms_sdk()
        for r in rooms:
            if r["name"] == room_name:
                if r["participants"] > 1:
                    return True
                # 1 participant = only the SIP caller, agent didn't join
                return False

        # Room gone — call ended
        return False

    except Exception as e:
        logger.error("sip_bridge_dispatch_failed", room=room_name, error=str(e))
        return False


async def _lookup_agent_for_number(phone_number: str) -> dict | None:
    """Look up which agent is assigned to this phone number."""
    try:
        db = get_db()
        result = (
            db.table("phone_numbers")
            .select("agent_id, agents(*)")
            .eq("number", phone_number)
            .eq("status", "active")
            .maybe_single()
            .execute()
        )
        if result.data and result.data.get("agents"):
            return result.data["agents"]
    except Exception as e:
        logger.error("sip_bridge_agent_lookup_failed", number=phone_number, error=str(e))
    return None


def _is_sip_room(room_name: str) -> bool:
    """Check if a room was created by a SIP call."""
    return room_name.startswith("call") and ("+" in room_name or room_name.count("_") >= 2)


async def sip_bridge() -> None:
    """Main SIP bridge loop — runs forever as a background task."""
    logger.info("sip_bridge_started")

    while True:
        try:
            rooms = await _get_rooms_sdk()

            for room in rooms:
                name = room["name"]
                participants = room["participants"]

                # Skip non-SIP rooms
                if not _is_sip_room(name):
                    continue

                # Skip rooms where agent already joined (participants > 1)
                if participants > 1:
                    _active_rooms.pop(name, None)
                    continue

                # Skip rooms with 0 participants (caller already left)
                if participants == 0:
                    _active_rooms.pop(name, None)
                    continue

                # Room has exactly 1 participant (SIP caller) and no agent
                attempts = _active_rooms.get(name, 0)

                if attempts >= MAX_ATTEMPTS:
                    logger.warning("sip_bridge_max_attempts", room=name)
                    _active_rooms.pop(name, None)
                    continue

                if attempts == 0:
                    logger.info("sip_bridge_new_sip_room", room=name, participants=participants)

                # Dispatch agent
                _active_rooms[name] = attempts + 1
                joined = await _dispatch_to_room(name)

                if joined:
                    logger.info("sip_bridge_agent_joined", room=name, attempt=attempts + 1)
                    _active_rooms.pop(name, None)
                else:
                    logger.warning("sip_bridge_agent_not_joined",
                                   room=name, attempt=attempts + 1)

        except Exception as e:
            logger.error("sip_bridge_error", error=str(e))

        await asyncio.sleep(POLL_INTERVAL_SEC)
