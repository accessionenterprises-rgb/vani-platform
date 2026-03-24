"""
SIP → Agent Bridge

Watches for rooms created by SIP inbound calls (LiveKit dispatch rules
don't auto-dispatch agents for external SIP trunks). When a new SIP room
appears with 1 participant (caller) and no agent, dispatches vani-agent.

Uses LiveKit Python SDK — no lk CLI dependency.
"""
import asyncio

import structlog
from livekit import api as lk_api

from config import settings

logger = structlog.get_logger()

POLL_INTERVAL_SEC = 1.5
MAX_ATTEMPTS = 3
JOIN_WAIT_SEC = 4

_active_rooms: dict[str, int] = {}


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
    """Dispatch vani-agent to room via SDK. Returns True if agent joined."""
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

    # Wait and verify agent joined
    await asyncio.sleep(JOIN_WAIT_SEC)

    rooms = await _list_rooms()
    for r in rooms:
        if r["name"] == room_name:
            return r["participants"] > 1
    return False


def _is_sip_room(name: str) -> bool:
    return name.startswith("call") and ("+" in name or name.count("_") >= 2)


async def sip_bridge() -> None:
    """Main loop — polls for SIP rooms needing agent dispatch."""
    logger.info("sip_bridge_started")

    while True:
        try:
            rooms = await _list_rooms()

            for room in rooms:
                name = room["name"]
                participants = room["participants"]

                if not _is_sip_room(name):
                    continue

                # Agent already joined
                if participants > 1:
                    _active_rooms.pop(name, None)
                    continue

                # Caller left
                if participants == 0:
                    _active_rooms.pop(name, None)
                    continue

                # 1 participant = SIP caller waiting for agent
                attempts = _active_rooms.get(name, 0)

                if attempts >= MAX_ATTEMPTS:
                    logger.warning("sip_bridge_gave_up", room=name)
                    _active_rooms.pop(name, None)
                    continue

                if attempts == 0:
                    logger.info("sip_bridge_detected", room=name)

                _active_rooms[name] = attempts + 1
                joined = await _dispatch_agent(name)

                if joined:
                    logger.info("sip_bridge_success", room=name, attempt=attempts + 1)
                    _active_rooms.pop(name, None)
                else:
                    logger.warning("sip_bridge_retry", room=name, attempt=attempts + 1)

        except Exception as e:
            logger.error("sip_bridge_error", error=str(e))

        await asyncio.sleep(POLL_INTERVAL_SEC)
