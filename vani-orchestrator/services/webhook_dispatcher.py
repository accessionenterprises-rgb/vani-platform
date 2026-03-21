"""
Async, retry-safe webhook dispatcher.

Fires events to all tenant webhook URLs.
Uses HMAC-SHA256 signature: X-Vaani-Signature header.
Retries: 3 attempts with exponential backoff (1s, 3s, 9s).
Never raises — failures are logged only.
"""
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone

import httpx
import structlog

from db import get_db

logger = structlog.get_logger()

RETRY_DELAYS = [1, 3, 9]   # seconds between retries
TIMEOUT_SEC  = 10


def _sign(payload_bytes: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()


def _load_tenant_webhooks(tenant_id: str, event_type: str) -> list[dict]:
    """Load active webhooks for tenant that subscribe to this event."""
    try:
        db = get_db()
        result = (
            db.table("webhooks")
            .select("id, url, secret, events")
            .eq("tenant_id", tenant_id)
            .eq("active", True)
            .execute()
        )
        return [w for w in (result.data or []) if event_type in (w.get("events") or [])]
    except Exception as exc:
        logger.error("webhook_load_failed", tenant_id=tenant_id, error=str(exc))
        return []


async def _fire_one(url: str, secret: str, event_type: str, payload: dict) -> bool:
    """POST to a single webhook URL. Returns True on success."""
    body = json.dumps({
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    }).encode()

    headers = {
        "Content-Type": "application/json",
        "X-Vaani-Event": event_type,
        "X-Vaani-Timestamp": str(int(time.time())),
        "X-Vaani-Signature": _sign(body, secret) if secret else "unsigned",
    }

    for attempt, delay in enumerate(RETRY_DELAYS, 1):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SEC) as client:
                r = await client.post(url, content=body, headers=headers)
            if r.status_code < 300:
                return True
            logger.warning("webhook_bad_status",
                           url=url, status=r.status_code, attempt=attempt)
        except Exception as exc:
            logger.warning("webhook_request_failed",
                           url=url, attempt=attempt, error=str(exc))

        if attempt < len(RETRY_DELAYS):
            import asyncio
            await asyncio.sleep(delay)

    logger.error("webhook_all_retries_failed", url=url, event=event_type)
    return False


async def dispatch_event(tenant_id: str, event_type: str, payload: dict) -> None:
    """
    Fire event to all tenant webhooks. Non-blocking — failures are swallowed.
    Call this from anywhere without awaiting the result if desired:
        asyncio.create_task(dispatch_event(...))
    """
    import asyncio
    webhooks = _load_tenant_webhooks(tenant_id, event_type)
    if not webhooks:
        return

    tasks = [
        _fire_one(w["url"], w.get("secret", ""), event_type, payload)
        for w in webhooks
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    succeeded = sum(1 for r in results if r is True)
    logger.info("webhooks_dispatched",
                event=event_type, total=len(webhooks), succeeded=succeeded)
