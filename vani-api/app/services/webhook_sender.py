"""Webhook delivery — signs payload with HMAC-SHA256, retries with backoff."""
import hashlib
import hmac
import json
import time

import httpx
import structlog

from app.db import get_db

logger = structlog.get_logger()

VALID_EVENTS = {
    "call.started",
    "call.completed",
    "call.failed",
    "transcript.ready",
}


async def send_webhook(tenant_id: str, event_type: str, payload: dict) -> bool:
    """
    Deliver a webhook to the tenant's configured URL.

    Returns True if delivery succeeded (2xx), False otherwise.
    Retries up to 3 times with exponential backoff (1s, 2s, 4s).
    """
    if event_type not in VALID_EVENTS:
        logger.warning("webhook_invalid_event", event=event_type, tenant=tenant_id)
        return False

    # Look up tenant's webhook config
    db = get_db()
    config = (
        db.table("webhook_configs")
        .select("url, secret, events, active")
        .eq("tenant_id", tenant_id)
        .eq("active", True)
        .maybe_single()
        .execute()
    )

    if config.data is None:
        # No webhook configured or not active — silently skip
        return False

    row = config.data

    # Check if tenant subscribed to this event type
    subscribed_events = row.get("events") or []
    if event_type not in subscribed_events:
        return False

    url = row["url"]
    secret = row["secret"] or ""

    # Build the signed payload
    timestamp = str(int(time.time()))
    body_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()

    # Signature = HMAC-SHA256(secret, timestamp.body)
    signature_input = f"{timestamp}.".encode() + body_bytes
    signature = hmac.new(
        secret.encode(),
        signature_input,
        hashlib.sha256,
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Vani-Signature": signature,
        "X-Vani-Event": event_type,
        "X-Vani-Timestamp": timestamp,
        "User-Agent": "Vani-Webhooks/1.0",
    }

    # Retry with exponential backoff: 1s, 2s, 4s
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, content=body_bytes, headers=headers)

            if 200 <= resp.status_code < 300:
                logger.info(
                    "webhook_delivered",
                    tenant=tenant_id,
                    event=event_type,
                    status=resp.status_code,
                    attempt=attempt + 1,
                )
                return True

            logger.warning(
                "webhook_non_2xx",
                tenant=tenant_id,
                event=event_type,
                status=resp.status_code,
                attempt=attempt + 1,
            )

        except Exception as exc:
            logger.warning(
                "webhook_delivery_error",
                tenant=tenant_id,
                event=event_type,
                error=str(exc),
                attempt=attempt + 1,
            )

        # Exponential backoff before next retry
        if attempt < max_retries - 1:
            import asyncio
            await asyncio.sleep(2 ** attempt)  # 1s, 2s

    logger.error(
        "webhook_delivery_failed",
        tenant=tenant_id,
        event=event_type,
        url=url,
        max_retries=max_retries,
    )
    return False
