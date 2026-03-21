"""
Playground text chat — browser-based agent testing without a phone call.

POST /playground/chat
  body: { agent_id, message, session_id? }
  Returns: { reply, session_id, messages }

Conversation history is kept in Redis for 30 minutes per session_id.
Uses the same LLM provider configured on the agent.
"""
import json
import os
import uuid
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/playground", tags=["playground"])

SESSION_TTL = 1800  # 30 min
MAX_HISTORY = 20    # messages kept per session


# ── Lazy Redis import (orchestrator has Redis; API may not in all deployments) ──

def _get_redis():
    try:
        import redis as sync_redis
        url = os.getenv("REDIS_URL", "redis://localhost:6379")
        return sync_redis.from_url(url, decode_responses=True)
    except Exception:
        return None


# ── LLM call (OpenAI-compatible) ─────────────────────────────────────────────

_LLM_BASE_URLS = {
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "groq":   "https://api.groq.com/openai/v1",
    "mistral": "https://api.mistral.ai/v1",
    "deepseek": "https://api.deepseek.com/v1",
}

_LLM_ENV_KEYS = {
    "gpt":      "OPENAI_API_KEY",
    "o1":       "OPENAI_API_KEY",
    "o3":       "OPENAI_API_KEY",
    "gemini":   "GOOGLE_AI_API_KEY",
    "claude":   "ANTHROPIC_API_KEY",
    "groq":     "GROQ_API_KEY",
    "llama":    "GROQ_API_KEY",
    "mistral":  "MISTRAL_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
}


def _resolve_llm(model: str, custom_url: Optional[str] = None, custom_model: Optional[str] = None):
    """Return (base_url, api_key, model) for the given model string."""
    if custom_url:
        key = os.getenv("CUSTOM_LLM_API_KEY", os.getenv("OPENAI_API_KEY", ""))
        return custom_url, key, custom_model or model

    m = model.lower()
    for prefix, env in _LLM_ENV_KEYS.items():
        if m.startswith(prefix):
            base = _LLM_BASE_URLS.get(prefix, "https://api.openai.com/v1")
            key = os.getenv(env, "")
            return base, key, model

    return "https://api.openai.com/v1", os.getenv("OPENAI_API_KEY", ""), "gpt-4o-mini"


async def _call_llm(base_url: str, api_key: str, model: str, messages: list) -> str:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "max_tokens": 400, "temperature": 0.7},
            )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.error("playground_llm_failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}")


# ── Schemas ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    agent_id: str
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    messages: list


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()

    # Load agent
    agent = (
        db.table("agents")
        .select("id, name, prompt, greeting, language, llm_provider, custom_llm_url, custom_llm_model, active")
        .eq("id", body.agent_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if agent.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent.data.get("active"):
        raise HTTPException(status_code=400, detail="Agent is inactive")

    a = agent.data
    session_id = body.session_id or str(uuid.uuid4())

    # Load/update conversation history
    r = _get_redis()
    history_key = f"playground:{tenant_id}:{session_id}"
    messages: list = []

    if r:
        raw = r.get(history_key)
        if raw:
            try:
                messages = json.loads(raw)
            except Exception:
                messages = []

    # Build system prompt
    system_prompt = (
        f"{a['prompt']}\n\n"
        "IMPORTANT: You are in a TEXT playground session. Respond conversationally, as if on a voice call. "
        "Keep replies brief (1-3 sentences). No markdown."
    )

    # Inject greeting as first assistant turn if fresh session
    if not messages:
        greeting = a.get("greeting") or "Hello, how can I help you today?"
        messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "assistant", "content": greeting})

    messages.append({"role": "user", "content": body.message})

    # Trim history to prevent token bloat
    if len(messages) > MAX_HISTORY + 1:  # +1 for system
        messages = [messages[0]] + messages[-(MAX_HISTORY):]

    # Call LLM
    model = a.get("llm_provider") or "gpt-4o-mini"
    base_url, api_key, resolved_model = _resolve_llm(
        model,
        custom_url=a.get("custom_llm_url"),
        custom_model=a.get("custom_llm_model"),
    )
    if not api_key:
        raise HTTPException(status_code=500, detail="No API key configured for this LLM provider")

    reply = await _call_llm(base_url, api_key, resolved_model, messages)

    messages.append({"role": "assistant", "content": reply})

    # Persist to Redis
    if r:
        r.setex(history_key, SESSION_TTL, json.dumps(messages))

    return ChatResponse(
        reply=reply,
        session_id=session_id,
        messages=[m for m in messages if m["role"] != "system"],  # strip system from response
    )


@router.delete("/chat/{session_id}", status_code=204)
async def clear_session(session_id: str, tenant_id: str = Depends(get_tenant_id)):
    """Clear a playground chat session."""
    r = _get_redis()
    if r:
        r.delete(f"playground:{tenant_id}:{session_id}")
