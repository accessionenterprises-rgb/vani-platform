"""
Campaign worker — polls running campaigns and places outbound calls.

Features:
  - Time window enforcement (call_window_start / call_window_end / timezone)
  - Retry contacts: picks up status='retry' contacts where next_retry_at <= now()
  - Contact variable injection: {first_name}, {name}, {phone}, {any_csv_column}
  - DNC pre-check handled by outbound_caller worker at dial time
  - Completion: only marks done when no pending OR retry contacts remain
"""
import asyncio
import json
import os
import uuid
from datetime import datetime, timezone, time as dt_time
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import structlog

from db import get_db
from redis_client import get_redis

logger = structlog.get_logger()

OUTBOUND_QUEUE = "vani:queue:outbound"
POLL_INTERVAL  = 5    # seconds between campaign scans
BATCH_SIZE     = 5    # max contacts to queue per poll cycle per campaign


# ─── Helpers ─────────────────────────────────────────────────

def _get_concurrency_limit(plan: str, max_concurrent: Optional[int]) -> int:
    if max_concurrent:
        return max_concurrent
    return {"starter": 5, "growth": 20, "enterprise": 100}.get(plan, 5)


async def _count_inflight(r, tenant_id: str) -> int:
    return (await r.scard(f"inflight:{tenant_id}")) or 0


def _is_within_call_window(campaign: dict) -> bool:
    """
    Return True if current time is within the campaign's configured dialing window.
    If no window is set, always return True.
    """
    window_start = campaign.get("call_window_start")
    window_end   = campaign.get("call_window_end")
    if not window_start or not window_end:
        return True

    tz_name = campaign.get("timezone") or "Asia/Kolkata"
    try:
        tz = ZoneInfo(tz_name)
        now = datetime.now(tz).time()
    except ZoneInfoNotFoundError:
        now = datetime.now(timezone.utc).time()

    def _parse(t) -> dt_time:
        parts = str(t).split(":")
        return dt_time(int(parts[0]), int(parts[1]))

    try:
        return _parse(window_start) <= now <= _parse(window_end)
    except Exception:
        return True


def _inject_variables(text: str, contact: dict) -> str:
    """
    Replace {variable} placeholders in text with contact field values.
    Supported variables:
      {name}       → contact name
      {first_name} → first word of name
      {phone}      → contact phone
      {<key>}      → any key in contact.metadata
    """
    name = contact.get("name") or ""
    first_name = name.split()[0] if name else ""

    variables = {
        "name":       name,
        "first_name": first_name,
        "phone":      contact.get("phone") or "",
    }
    for k, v in (contact.get("metadata") or {}).items():
        if k not in variables:
            variables[k] = str(v) if v is not None else ""

    for key, value in variables.items():
        text = text.replace(f"{{{key}}}", value)
    return text


# ─── DB helpers ──────────────────────────────────────────────

async def _load_running_campaigns() -> list[dict]:
    db = get_db()
    result = (
        db.table("campaigns")
        .select(
            "id, tenant_id, agent_id, from_number, status, "
            "max_attempts, retry_delay_min, call_window_start, call_window_end, timezone"
        )
        .eq("status", "running")
        .execute()
    )
    return result.data or []


async def _fetch_agent_config(agent_id: str) -> Optional[dict]:
    db = get_db()
    result = (
        db.table("agents")
        .select("id, name, greeting, prompt, language, voice, stt_provider, llm_provider, tts_provider, behavior, active")
        .eq("id", agent_id)
        .eq("active", True)
        .maybe_single()
        .execute()
    )
    return result.data


async def _fetch_tenant_config(tenant_id: str) -> dict:
    db = get_db()
    result = (
        db.table("tenants")
        .select("plan, telephony_config, max_concurrent_calls")
        .eq("id", tenant_id)
        .maybe_single()
        .execute()
    )
    return result.data or {"plan": "starter", "telephony_config": {}, "max_concurrent_calls": None}


async def _get_next_contacts(campaign_id: str, tenant_id: str, limit: int) -> list[dict]:
    """Fetch pending contacts first, then retry contacts whose next_retry_at has passed."""
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Priority 1: pending contacts (FIFO)
    pending = (
        db.table("campaign_contacts")
        .select("id, phone, name, metadata, attempts")
        .eq("campaign_id", campaign_id)
        .eq("tenant_id", tenant_id)
        .eq("status", "pending")
        .order("created_at")
        .limit(limit)
        .execute()
    )
    results = pending.data or []

    # Priority 2: retry contacts that are ready
    remaining = limit - len(results)
    if remaining > 0:
        retries = (
            db.table("campaign_contacts")
            .select("id, phone, name, metadata, attempts")
            .eq("campaign_id", campaign_id)
            .eq("tenant_id", tenant_id)
            .eq("status", "retry")
            .lte("next_retry_at", now_iso)
            .order("next_retry_at")
            .limit(remaining)
            .execute()
        )
        results += retries.data or []

    return results


async def _has_remaining_contacts(campaign_id: str) -> bool:
    """Return True if any contacts still need to be dialed (pending or scheduled retry)."""
    db = get_db()
    result = (
        db.table("campaign_contacts")
        .select("id")
        .eq("campaign_id", campaign_id)
        .in_("status", ["pending", "retry"])
        .limit(1)
        .execute()
    )
    return bool(result.data)


# ─── Core ────────────────────────────────────────────────────

async def _process_campaign(campaign: dict, r) -> None:
    campaign_id = str(campaign["id"])
    tenant_id   = campaign["tenant_id"]
    agent_id    = str(campaign["agent_id"])
    from_number = campaign.get("from_number")
    max_attempts    = campaign.get("max_attempts")    or 3
    retry_delay_min = campaign.get("retry_delay_min") or 60

    log = logger.bind(campaign_id=campaign_id, tenant_id=tenant_id)

    # Time window check
    if not _is_within_call_window(campaign):
        log.debug("campaign_outside_call_window")
        return

    # Fetch configs
    tenant_cfg = await _fetch_tenant_config(tenant_id)
    agent_cfg  = await _fetch_agent_config(agent_id)

    if not agent_cfg:
        log.warning("campaign_agent_inactive")
        db = get_db()
        db.table("campaigns").update({"status": "paused"}).eq("id", campaign_id).execute()
        return

    plan     = tenant_cfg.get("plan", "starter")
    max_conc = _get_concurrency_limit(plan, tenant_cfg.get("max_concurrent_calls"))
    inflight = await _count_inflight(r, tenant_id)
    available = max(0, min(BATCH_SIZE, max_conc - inflight))

    if available == 0:
        return  # at concurrency limit, try next cycle

    contacts = await _get_next_contacts(campaign_id, tenant_id, available)

    if not contacts:
        # No contacts ready right now — check if campaign is truly done
        if not await _has_remaining_contacts(campaign_id):
            db = get_db()
            db.table("campaigns").update({"status": "completed"}).eq("id", campaign_id).execute()
            log.info("campaign_completed")
        return

    telephony_config = tenant_cfg.get("telephony_config") or {}
    queue = "vani:queue:outbound:enterprise" if plan == "enterprise" else OUTBOUND_QUEUE

    db = get_db()
    queued = 0

    for contact in contacts:
        call_id = str(uuid.uuid4())
        contact_id = str(contact["id"])

        # Inject contact variables into prompt + greeting
        prompt   = _inject_variables(agent_cfg["prompt"],          contact)
        greeting = _inject_variables(agent_cfg.get("greeting", ""), contact)

        db.table("calls").insert({
            "id":                   call_id,
            "tenant_id":            tenant_id,
            "agent_id":             agent_id,
            "phone":                contact["phone"],
            "direction":            "outbound",
            "status":               "queued",
            "campaign_id":          campaign_id,
            "campaign_contact_id":  contact_id,
            "metadata": {
                "contact_name": contact.get("name"),
                "campaign_id":  campaign_id,
                "attempt":      (contact.get("attempts") or 0) + 1,
            },
        }).execute()

        db.table("campaign_contacts").update({
            "status":       "calling",
            "call_id":      call_id,
            "attempted_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", contact_id).execute()

        job = {
            "call_id":              call_id,
            "tenant_id":            tenant_id,
            "agent_id":             agent_id,
            "to":                   contact["phone"],
            "from_number":          from_number or "",
            "telephony_config":     telephony_config,
            "campaign_id":          campaign_id,
            "campaign_contact_id":  contact_id,
            "retry_config": {
                "max_attempts":    max_attempts,
                "retry_delay_min": retry_delay_min,
            },
            "agent_config": {
                "name":     agent_cfg["name"],
                "greeting": greeting,
                "prompt":   prompt,
                "language": agent_cfg["language"],
                "voice":    agent_cfg["voice"],
                "stt":      agent_cfg["stt_provider"],
                "llm":      agent_cfg["llm_provider"],
                "tts":      agent_cfg["tts_provider"],
                "behavior": agent_cfg["behavior"],
                "contact":  {"name": contact.get("name"), "metadata": contact.get("metadata", {})},
            },
        }
        await r.lpush(queue, json.dumps(job))
        queued += 1
        log.info("contact_queued", call_id=call_id, phone=contact["phone"])

    if queued > 0:
        db.rpc("increment_campaign_called", {"cid": campaign_id, "n": queued}).execute()


async def campaign_worker() -> None:
    """Poll for running campaigns and enqueue outbound calls."""
    r = get_redis()
    logger.info("campaign_worker_started")

    while True:
        try:
            campaigns = await asyncio.get_event_loop().run_in_executor(
                None, lambda: asyncio.run(_load_running_campaigns())
            )
            # Note: _load_running_campaigns is sync (Supabase Python client)
            # wrap in thread executor if needed, or call synchronously:
        except Exception:
            pass

        # Simpler: call synchronously (Supabase client is sync)
        try:
            db = get_db()
            result = (
                db.table("campaigns")
                .select(
                    "id, tenant_id, agent_id, from_number, status, "
                    "max_attempts, retry_delay_min, call_window_start, call_window_end, timezone"
                )
                .eq("status", "running")
                .execute()
            )
            campaigns = result.data or []

            for campaign in campaigns:
                try:
                    await _process_campaign(campaign, r)
                except Exception as e:
                    logger.error("campaign_process_error",
                                 campaign_id=str(campaign.get("id", "")), error=str(e))
        except Exception as e:
            logger.error("campaign_worker_error", error=str(e))

        await asyncio.sleep(POLL_INTERVAL)
