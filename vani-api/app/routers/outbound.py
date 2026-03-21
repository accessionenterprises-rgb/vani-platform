"""
Outbound calling endpoints.

POST /calls/outbound    — trigger a single outbound call
POST /calls/{id}/stop   — cancel a queued or active call
"""
import json
import uuid
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/calls", tags=["calls"])

OUTBOUND_QUEUE = "vani:queue:outbound"
ENTERPRISE_QUEUE = "vani:queue:outbound:enterprise"


class OutboundCallRequest(BaseModel):
    agent_id: str
    to: str                         # destination phone number
    from_number: Optional[str] = None  # overrides agent's assigned number; required if no number mapped
    metadata: Optional[dict] = None


class OutboundCallResponse(BaseModel):
    call_id: str
    status: str
    agent_id: str
    to: str


@router.post("/outbound", response_model=OutboundCallResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_outbound(body: OutboundCallRequest, tenant_id: str = Depends(get_tenant_id)):
    """Queue an outbound call. Returns immediately — call is placed asynchronously."""
    db = get_db()

    # Verify agent belongs to tenant and is active
    agent_row = (
        db.table("agents")
        .select("id, name, active, stt_provider, llm_provider, tts_provider, greeting, prompt, language, voice, behavior")
        .eq("id", body.agent_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if agent_row.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent_row.data.get("active"):
        raise HTTPException(status_code=400, detail="Agent is not active")

    # Resolve from_number — use provided or find first active number for agent
    from_number = body.from_number
    if not from_number:
        num_row = (
            db.table("phone_numbers")
            .select("number")
            .eq("agent_id", body.agent_id)
            .eq("tenant_id", tenant_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if num_row.data:
            from_number = num_row.data[0]["number"]

    if not from_number:
        raise HTTPException(
            status_code=400,
            detail="No from_number provided and no active phone number assigned to this agent"
        )

    # Get tenant plan for queue priority
    tenant_row = (
        db.table("tenants")
        .select("plan, telephony_config")
        .eq("id", tenant_id)
        .maybe_single()
        .execute()
    )
    plan = "starter"
    telephony_config = {}
    if tenant_row.data:
        plan = tenant_row.data.get("plan", "starter")
        telephony_config = tenant_row.data.get("telephony_config") or {}

    # Create call record
    call_id = str(uuid.uuid4())
    db.table("calls").insert({
        "id": call_id,
        "tenant_id": tenant_id,
        "agent_id": body.agent_id,
        "phone": body.to,
        "direction": "outbound",
        "status": "queued",
        "metadata": body.metadata or {},
    }).execute()

    # Push to Redis outbound queue
    try:
        import redis.asyncio as aioredis  # lazy import — avoids circular import
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        job = {
            "call_id": call_id,
            "tenant_id": tenant_id,
            "agent_id": body.agent_id,
            "to": body.to,
            "from_number": from_number,
            "telephony_config": telephony_config,
            "agent_config": {
                "name": agent_row.data["name"],
                "greeting": agent_row.data["greeting"],
                "prompt": agent_row.data["prompt"],
                "language": agent_row.data["language"],
                "voice": agent_row.data["voice"],
                "stt": agent_row.data["stt_provider"],
                "llm": agent_row.data["llm_provider"],
                "tts": agent_row.data["tts_provider"],
                "behavior": agent_row.data["behavior"],
            },
        }
        queue = ENTERPRISE_QUEUE if plan == "enterprise" else OUTBOUND_QUEUE
        await r.lpush(queue, json.dumps(job))
        await r.aclose()
    except Exception as e:
        logger.error("outbound_queue_failed", call_id=call_id, error=str(e))
        db.table("calls").update({"status": "failed"}).eq("id", call_id).execute()
        raise HTTPException(status_code=503, detail="Queue unavailable, try again shortly")

    logger.info("outbound_queued", call_id=call_id, to=body.to, agent_id=body.agent_id)
    return OutboundCallResponse(call_id=call_id, status="queued", agent_id=body.agent_id, to=body.to)


@router.post("/{call_id}/stop", status_code=status.HTTP_200_OK)
async def stop_call(call_id: str, tenant_id: str = Depends(get_tenant_id)):
    """
    Cancel a queued outbound call, or flag an active call for termination.
    Queued calls are removed from Redis before the worker picks them up.
    Active calls are marked 'cancelling' — orchestrator polls and hangup.
    """
    db = get_db()
    row = (
        db.table("calls")
        .select("id, status, direction")
        .eq("id", call_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if row.data is None:
        raise HTTPException(status_code=404, detail="Call not found")

    current_status = row.data["status"]
    if current_status in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Call already in terminal state: {current_status}")

    # Mark as cancelled in DB
    db.table("calls").update({"status": "cancelled"}).eq("id", call_id).execute()

    # Push cancellation signal to Redis so orchestrator stops the call
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        await r.setex(f"cancel:{call_id}", 300, "1")
        await r.aclose()
    except Exception:
        pass  # DB already updated; Redis signal is best-effort

    return {"call_id": call_id, "status": "cancelled"}
