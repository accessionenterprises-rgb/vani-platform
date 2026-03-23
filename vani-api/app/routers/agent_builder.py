"""
Conversational AI Agent Builder — chat-based wizard that asks questions
one at a time and generates a production-ready voice agent config.

POST /builder/chat   { message, history[] }
  → { reply, agent_config? }

When agent_config is present, the frontend can create the agent.
"""
import json
import os
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/builder", tags=["builder"])


BUILDER_SYSTEM_PROMPT = """You are an AI Agent Builder assistant for Vani, a voice AI platform. Your job is to have a friendly, concise conversation with the user to gather everything needed to create their AI voice agent.

ASK THESE QUESTIONS ONE AT A TIME (do NOT dump all questions at once):

1. **What type of business/use case?** (e.g., restaurant, clinic, real estate, e-commerce, hotel, custom)
2. **What should the agent's name be?** (suggest one based on their business)
3. **What's the main goal?** (book appointments, handle support, qualify leads, take orders, etc.)
4. **What tone should it use?** (friendly, formal, sales-oriented)
5. **What's the greeting?** (first thing callers hear — suggest one, let them customize)
6. **Any specific instructions?** (business hours, menu items, policies, things to never say, escalation rules)
7. **What language?** (English, Hindi, or Multilingual)

RULES:
- Ask ONE question at a time. Wait for the answer before moving on.
- Be conversational and brief (1-3 sentences per message).
- Suggest smart defaults based on their business type.
- After gathering enough info (usually 4-6 exchanges), generate the final config.
- When you have everything, respond with your final message AND include a JSON block wrapped in ```json``` fences containing the agent config.

The JSON config MUST have this exact structure:
```json
{
  "name": "Agent Name",
  "greeting": "The greeting message",
  "prompt": "Full system prompt for the agent...",
  "language": "en",
  "stt_provider": "deepgram-nova-3",
  "llm_provider": "gpt-4o-mini",
  "tts_provider": "openai-nova",
  "behavior": {
    "tone": "friendly",
    "objective": "support",
    "fallback": "Let me connect you with our team.",
    "constraints": []
  }
}
```

For the "prompt" field, write a detailed, production-ready system prompt (8-15 lines) that covers:
- Who the agent is and their role
- What they should do (list 4-6 specific responsibilities)
- How they should handle edge cases
- When to escalate to a human
- Any business-specific rules the user mentioned

For "objective", use one of: "support", "booking", "qualify", "sales"
For "tone", use one of: "friendly", "formal", "sales"
For "language", use: "en", "hi", or "multi"

NEVER include the JSON config until you've asked at least 3-4 questions and have enough context.
Do NOT explain the JSON to the user — just include it naturally at the end of your final message like "Here's your agent, ready to deploy!"
"""


class BuilderChatRequest(BaseModel):
    message: str
    history: list[dict] = []  # [{ role, content }]


class BuilderChatResponse(BaseModel):
    reply: str
    agent_config: Optional[dict] = None


async def _call_llm(messages: list) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": messages,
                    "max_tokens": 800,
                    "temperature": 0.7,
                },
            )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.error("builder_llm_failed", error=str(exc))
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable")


def _extract_agent_config(text: str) -> Optional[dict]:
    """Extract JSON config from LLM response if present."""
    import re
    match = re.search(r'```json\s*(\{.*?\})\s*```', text, re.DOTALL)
    if not match:
        return None
    try:
        config = json.loads(match.group(1))
        # Validate required fields
        required = ["name", "greeting", "prompt"]
        if all(k in config for k in required):
            # Ensure defaults
            config.setdefault("language", "en")
            config.setdefault("stt_provider", "deepgram-nova-3")
            config.setdefault("llm_provider", "gpt-4o-mini")
            config.setdefault("tts_provider", "openai-nova")
            config.setdefault("behavior", {"tone": "friendly", "objective": "support", "fallback": "Let me connect you with our team.", "constraints": []})
            return config
    except (json.JSONDecodeError, ValueError):
        pass
    return None


@router.post("/chat", response_model=BuilderChatResponse)
async def builder_chat(body: BuilderChatRequest, tenant_id: str = Depends(get_tenant_id)):
    # Build message history
    messages = [{"role": "system", "content": BUILDER_SYSTEM_PROMPT}]

    for msg in body.history:
        if msg.get("role") in ("user", "assistant"):
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": body.message})

    reply = await _call_llm(messages)

    # Check if the reply contains a final agent config
    agent_config = _extract_agent_config(reply)

    # Clean the JSON block from the reply text for display
    import re
    clean_reply = re.sub(r'```json\s*\{.*?\}\s*```', '', reply, flags=re.DOTALL).strip()

    return BuilderChatResponse(
        reply=clean_reply,
        agent_config=agent_config,
    )
