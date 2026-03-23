"""
Public chat widget endpoint — no auth required, uses widget_key for identification.

POST /widget/chat   { widget_key, message, session_id?, visitor_id? }
GET  /widget/config  { widget_key }  → agent greeting, name, widget_config
"""
import json
import os
import uuid
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import get_db

logger = structlog.get_logger()

router = APIRouter(prefix="/widget", tags=["widget"])

MAX_HISTORY = 30
SESSION_TTL = 3600  # 1 hour


# ── LLM (shared with playground) ─────────────────────────────────────────────

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
    if custom_url:
        key = os.getenv("CUSTOM_LLM_API_KEY", os.getenv("OPENAI_API_KEY", ""))
        return custom_url, key, custom_model or model
    m = model.lower()
    for prefix, env in _LLM_ENV_KEYS.items():
        if m.startswith(prefix):
            base = _LLM_BASE_URLS.get(prefix, "https://api.openai.com/v1")
            return base, os.getenv(env, ""), model
    return "https://api.openai.com/v1", os.getenv("OPENAI_API_KEY", ""), "gpt-4o-mini"


async def _call_llm(base_url: str, api_key: str, model: str, messages: list) -> str:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "max_tokens": 500, "temperature": 0.7},
            )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.error("widget_llm_failed", error=str(exc))
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _load_agent_by_widget_key(widget_key: str):
    """Load agent + tenant via widget_key. Returns (agent_row, tenant_id) or raises 403."""
    db = get_db()
    wk = (
        db.table("widget_keys")
        .select("agent_id, tenant_id, active, allowed_origins")
        .eq("widget_key", widget_key)
        .maybe_single()
        .execute()
    )
    if not wk.data or not wk.data["active"]:
        raise HTTPException(status_code=403, detail="Invalid or inactive widget key")

    agent = (
        db.table("agents")
        .select("id, name, prompt, greeting, llm_provider, custom_llm_url, custom_llm_model, widget_config, active, behavior")
        .eq("id", wk.data["agent_id"])
        .eq("tenant_id", wk.data["tenant_id"])
        .maybe_single()
        .execute()
    )
    if not agent.data or not agent.data["active"]:
        raise HTTPException(status_code=404, detail="Agent not found or inactive")

    return agent.data, wk.data["tenant_id"], wk.data.get("allowed_origins") or []


# ── Schemas ──────────────────────────────────────────────────────────────────

class WidgetChatRequest(BaseModel):
    widget_key: str
    message: str
    session_id: Optional[str] = None
    visitor_id: Optional[str] = None


class WidgetChatResponse(BaseModel):
    reply: str
    session_id: str
    messages: list


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/config")
async def widget_config(widget_key: str):
    """Public — returns agent name, greeting, and widget styling config."""
    agent, _, _ = _load_agent_by_widget_key(widget_key)
    wc = agent.get("widget_config") or {}
    return {
        "agent_name": agent["name"],
        "greeting": agent.get("greeting") or "Hi! How can I help you?",
        "theme_color": wc.get("theme_color", "#6366f1"),
        "position": wc.get("position", "bottom-right"),
        "avatar_url": wc.get("avatar_url"),
        "placeholder": wc.get("placeholder", "Type a message..."),
        "powered_by": wc.get("powered_by", True),
    }


@router.post("/chat", response_model=WidgetChatResponse)
async def widget_chat(body: WidgetChatRequest, request: Request):
    """Public chat endpoint — no auth, uses widget_key."""
    agent, tenant_id, allowed_origins = _load_agent_by_widget_key(body.widget_key)

    # Optional CORS origin check
    origin = request.headers.get("origin", "")
    if allowed_origins and origin:
        if not any(o == "*" or origin.startswith(o) for o in allowed_origins):
            raise HTTPException(status_code=403, detail="Origin not allowed")

    db = get_db()
    session_id = body.session_id or str(uuid.uuid4())
    visitor_id = body.visitor_id or "anonymous"

    # Load or create session
    session = (
        db.table("chat_sessions")
        .select("id, messages")
        .eq("agent_id", agent["id"])
        .eq("visitor_id", visitor_id)
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )

    messages = []
    is_new = session.data is None

    if not is_new:
        messages = session.data.get("messages") or []

    # Build system prompt
    wc = agent.get("widget_config") or {}
    system_prompt = agent["prompt"]
    if wc.get("system_suffix"):
        system_prompt += f"\n\n{wc['system_suffix']}"

    system_prompt += (
        "\n\nIMPORTANT: You are a text chatbot on a website. "
        "Keep replies concise (1-3 sentences). Use plain text, no markdown. "
        "Be helpful and conversational."
    )

    # First message — inject greeting
    if not messages:
        greeting = agent.get("greeting") or "Hi! How can I help you?"
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "assistant", "content": greeting},
        ]

    messages.append({"role": "user", "content": body.message})

    # Trim
    if len(messages) > MAX_HISTORY + 1:
        messages = [messages[0]] + messages[-MAX_HISTORY:]

    # Call LLM
    model = agent.get("llm_provider") or "gpt-4o-mini"
    base_url, api_key, resolved_model = _resolve_llm(
        model,
        custom_url=agent.get("custom_llm_url"),
        custom_model=agent.get("custom_llm_model"),
    )
    if not api_key:
        raise HTTPException(status_code=500, detail="AI not configured")

    reply = await _call_llm(base_url, api_key, resolved_model, messages)
    messages.append({"role": "assistant", "content": reply})

    # Persist session
    if is_new:
        db.table("chat_sessions").insert({
            "id": session_id,
            "tenant_id": tenant_id,
            "agent_id": agent["id"],
            "visitor_id": visitor_id,
            "messages": messages,
        }).execute()
    else:
        db.table("chat_sessions").update({
            "messages": messages,
            "updated_at": "now()",
        }).eq("id", session_id).execute()

    return WidgetChatResponse(
        reply=reply,
        session_id=session_id,
        messages=[m for m in messages if m["role"] != "system"],
    )
