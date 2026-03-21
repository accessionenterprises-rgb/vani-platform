"""
Background post-processing worker.

After every call ends, runs:
  1. LLM analysis (sentiment, intent, resolved, summary, tags)
  2. Structured data extraction (extraction_schema from agent config)
  3. Call goal check (success_criteria from agent config)
  4. Per-call cost calculation (provider × duration)
  5. Latency profile save
  6. Saves all results to Supabase calls table
  7. Fires call.analyzed webhook

Queue: vani:postprocess_queue  LPUSH/BLPOP
Job:   { call_id, tenant_id, transcript, phone, agent_id,
         duration_sec, stt_provider, llm_provider, tts_provider,
         direction, latency_profile }
"""
import asyncio
import json

import httpx
import structlog

from config import settings
from db import get_db
from redis_client import get_redis
from services.webhook_dispatcher import dispatch_event

logger = structlog.get_logger()

QUEUE = "vani:postprocess_queue"
ANALYSIS_TIMEOUT = 30


# ── Cost table (USD per minute) ───────────────────────────────────────────────

_STT_COST = {
    "deepgram-nova-3":  0.0059,
    "deepgram-nova-2":  0.0043,
    "google":           0.009,
    "azure":            0.01,
}
_LLM_COST = {
    "gpt-4o-mini":           0.003,
    "gpt-4o":                0.03,
    "gemini-flash-lite":     0.0003,
    "gemini-2.0-flash":      0.0005,
    "gemini-flash-lite":     0.0003,
    "claude-haiku-4-5-20251001": 0.004,
    "groq":                  0.001,
    "llama":                 0.001,
    "mistral":               0.002,
    "deepseek":              0.001,
}
_TTS_COST = {
    "openai-nova":      0.015,
    "openai-shimmer":   0.015,
    "openai-alloy":     0.015,
    "sarvam":           0.003,
    "elevenlabs":       0.01,
    "google-wavenet":   0.008,
    "cartesia":         0.005,
}
_TELEPHONY_COST = {
    "inbound":  0.0085,
    "outbound": 0.013,
}


def _compute_cost(duration_sec: int, stt: str, llm: str, tts: str, direction: str) -> dict:
    mins = duration_sec / 60.0 if duration_sec else 0

    def _match(table, key):
        if not key:
            return 0.0
        k = key.lower()
        # Exact match first
        if k in table:
            return table[k]
        # Prefix match
        for prefix, cost in table.items():
            if k.startswith(prefix):
                return cost
        return 0.0

    stt_cost  = _match(_STT_COST, stt) * mins
    llm_cost  = _match(_LLM_COST, llm) * mins
    tts_cost  = _match(_TTS_COST, tts) * mins
    tel_cost  = _TELEPHONY_COST.get(direction, 0.0085) * mins
    total     = stt_cost + llm_cost + tts_cost + tel_cost

    return {
        "total_usd":   round(total, 6),
        "stt_usd":     round(stt_cost, 6),
        "llm_usd":     round(llm_cost, 6),
        "tts_usd":     round(tts_cost, 6),
        "telephony_usd": round(tel_cost, 6),
        "duration_min":  round(mins, 3),
    }


# ── Long-term memory ──────────────────────────────────────────────────────────

async def _get_embedding(text: str) -> list | None:
    """Generate text-embedding-3-small vector for semantic memory search."""
    if not getattr(settings, "openai_api_key", None):
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={"model": "text-embedding-3-small", "input": text[:8000]},
            )
        r.raise_for_status()
        return r.json()["data"][0]["embedding"]
    except Exception as exc:
        logger.warning("embedding_generation_failed", error=str(exc))
        return None


async def _save_long_term_memory(phone: str, tenant_id: str, summary: str, entities: dict) -> None:
    """Persist call summary + embedding to per-phone long-term memory for future calls."""
    if not phone or not tenant_id or not summary:
        return
    try:
        embedding = await _get_embedding(summary)
        row: dict = {
            "tenant_id": tenant_id,
            "phone":     phone,
            "summary":   summary,
            "entities":  {k: v for k, v in entities.items() if v is not None},
        }
        if embedding:
            row["embedding"] = embedding
        db = get_db()
        db.table("call_memory").insert(row).execute()
        logger.info("long_term_memory_saved", phone=phone[:6] + "***", has_embedding=bool(embedding))
    except Exception as exc:
        logger.warning("long_term_memory_save_failed", error=str(exc))


# ── LLM call helper ───────────────────────────────────────────────────────────

async def _llm_call(prompt: str, max_tokens: int = 400) -> dict | None:
    if not getattr(settings, "openai_api_key", None):
        return None
    try:
        async with httpx.AsyncClient(timeout=ANALYSIS_TIMEOUT) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "max_tokens": max_tokens,
                },
            )
        r.raise_for_status()
        raw = r.json()["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as exc:
        logger.warning("llm_call_failed", error=str(exc))
        return None


# ── Analysis prompts ──────────────────────────────────────────────────────────

_ANALYSIS_PROMPT = """Analyze this voice call transcript and return JSON only.

Transcript:
{transcript}

Return this exact JSON (no markdown, no explanation):
{{
  "sentiment": "positive" | "neutral" | "negative",
  "intent": "booking" | "support" | "inquiry" | "complaint" | "other",
  "resolved": true | false,
  "summary": "1-2 sentence summary of the call",
  "escalated": true | false,
  "topics": ["topic1", "topic2"]
}}"""


def _make_extraction_prompt(transcript: str, schema: list) -> str:
    fields_desc = "\n".join(
        f'- "{f["field"]}" ({f.get("type", "text")}): {f.get("description", "")}'
        for f in schema
    )
    return f"""Extract the following fields from this voice call transcript.
Return JSON only — no markdown, no explanation.

Fields to extract:
{fields_desc}

Transcript:
{transcript[:3000]}

Return JSON with exactly these keys. Use null for fields not found."""


def _make_goal_prompt(transcript: str, success_criteria: str) -> str:
    return f"""Evaluate whether this call achieved its goal based on the success criteria.
Return JSON only — no markdown.

Success criteria: {success_criteria}

Transcript:
{transcript[:3000]}

Return: {{"goal_achieved": true | false, "reason": "brief explanation"}}"""


# ── Main processing ───────────────────────────────────────────────────────────

async def _process_job(job: dict) -> None:
    call_id      = job.get("call_id")
    tenant_id    = job.get("tenant_id")
    transcript   = job.get("transcript", "")
    agent_id     = job.get("agent_id")
    duration_sec = job.get("duration_sec") or 0
    stt_provider = job.get("stt_provider", "")
    llm_provider = job.get("llm_provider", "")
    tts_provider = job.get("tts_provider", "")
    direction    = job.get("direction", "inbound")
    latency_profile = job.get("latency_profile")

    log = logger.bind(call_id=call_id)
    log.info("post_processing_start")

    # 1. Sentiment / intent / summary analysis
    analysis = None
    if transcript.strip():
        analysis = await _llm_call(_ANALYSIS_PROMPT.format(transcript=transcript[:4000]))

    # 2. Structured extraction + goal check (requires agent config)
    extracted = {}
    goal_result = {}
    if agent_id and transcript.strip():
        db = get_db()
        agent = (
            db.table("agents")
            .select("extraction_schema, success_criteria")
            .eq("id", agent_id)
            .maybe_single()
            .execute()
        )
        if agent.data:
            schema = agent.data.get("extraction_schema") or []
            criteria = agent.data.get("success_criteria")

            if schema:
                extracted = await _llm_call(
                    _make_extraction_prompt(transcript, schema), max_tokens=300
                ) or {}
                log.info("extraction_done", fields=list(extracted.keys()))

            if criteria:
                goal_result = await _llm_call(
                    _make_goal_prompt(transcript, criteria), max_tokens=100
                ) or {}
                log.info("goal_check_done", achieved=goal_result.get("goal_achieved"))

    # 3. Cost calculation
    cost = _compute_cost(duration_sec, stt_provider, llm_provider, tts_provider, direction)
    log.info("cost_computed", total_usd=cost["total_usd"])

    # 4. Build metadata update
    metadata: dict = {}
    if analysis:
        metadata.update({
            "intent":    analysis.get("intent"),
            "resolved":  analysis.get("resolved", False),
            "escalated": analysis.get("escalated", False),
            "topics":    analysis.get("topics", []),
        })
    if extracted:
        metadata["extracted"] = extracted
    if goal_result:
        metadata["goal_achieved"] = goal_result.get("goal_achieved")
        metadata["goal_reason"]   = goal_result.get("reason")
    metadata["cost"] = cost
    if latency_profile:
        metadata["latency_profile"] = latency_profile

    # 5. Persist to Supabase
    try:
        db = get_db()
        update: dict = {"metadata": metadata}
        if analysis:
            update["sentiment"] = analysis.get("sentiment")
            update["summary"]   = analysis.get("summary")
        # Persist provider columns for fast analytics GROUP BY
        if stt_provider:
            update["stt_provider"] = stt_provider
        if llm_provider:
            update["llm_provider"] = llm_provider
        if tts_provider:
            update["tts_provider"] = tts_provider
        db.table("calls").update(update).eq("id", call_id).execute()
        log.info("post_processing_done",
                 sentiment=analysis.get("sentiment") if analysis else None,
                 extracted_fields=len(extracted),
                 cost_usd=cost["total_usd"])
    except Exception as exc:
        logger.error("post_processing_save_failed", call_id=call_id, error=str(exc))

    # 6. Fire call.analyzed webhook
    if tenant_id:
        await dispatch_event(
            tenant_id=tenant_id,
            event_type="call.analyzed",
            payload={
                "call_id":       call_id,
                "sentiment":     analysis.get("sentiment") if analysis else None,
                "intent":        analysis.get("intent") if analysis else None,
                "summary":       analysis.get("summary") if analysis else None,
                "resolved":      analysis.get("resolved") if analysis else None,
                "goal_achieved": goal_result.get("goal_achieved"),
                "cost_usd":      cost["total_usd"],
            },
        )

    # 7. Save long-term memory (non-blocking — best-effort)
    phone = job.get("phone", "")
    if phone and tenant_id and analysis and analysis.get("summary"):
        await _save_long_term_memory(
            phone=phone,
            tenant_id=tenant_id,
            summary=analysis["summary"],
            entities={
                "intent":   analysis.get("intent"),
                "resolved": analysis.get("resolved"),
                "sentiment": analysis.get("sentiment"),
                **(extracted or {}),
            },
        )


async def post_processor(worker_id: int = 0) -> None:
    """Post-processor loop — runs forever, processes analysis jobs."""
    r = get_redis()
    log = logger.bind(pp_worker=worker_id)
    log.info("post_processor_started")

    while True:
        try:
            result = await r.blpop(QUEUE, timeout=5)
            if result is None:
                continue
            _, raw = result
            job = json.loads(raw)
            await _process_job(job)
        except Exception as exc:
            log.error("post_processor_error", error=str(exc))
            await asyncio.sleep(1)
