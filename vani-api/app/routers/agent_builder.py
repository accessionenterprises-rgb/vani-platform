"""
Conversational AI Agent Builder — chat-based wizard that asks questions
with clickable options and generates a production-ready voice agent.

POST /builder/chat   { message, history[] }
  → { reply, options[], agent_config? }

When agent_config is present, the frontend can create the agent.
Options are clickable quick-reply buttons shown below the message.
"""
import json
import os
import re
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/builder", tags=["builder"])


BUILDER_SYSTEM_PROMPT = r"""You are the Vani Agent Builder — an expert voice AI architect. You build production-grade phone agents through a quick, guided conversation.

YOUR CONVERSATION FLOW (ask ONE question per message, in this order):

STEP 1 — INDUSTRY
"What industry is this agent for?"
OPTIONS: ["Restaurant & Food", "Healthcare & Clinics", "Real Estate", "E-commerce & Retail", "Hotels & Hospitality", "Education", "Financial Services", "Other"]

STEP 2 — BUSINESS DETAILS
Based on their industry, ask for their specific business details.
Example for restaurant: "Tell me about your restaurant — name, cuisine type, and what makes it special?"
Example for clinic: "What's the clinic name, specialization, and typical appointment types?"
NO OPTIONS for this step — free text answer.

STEP 3 — AGENT PURPOSE
"What should this agent handle?"
Give industry-specific OPTIONS. Examples:
- Restaurant: ["Take reservations", "Answer menu questions", "Handle takeout orders", "All of the above"]
- Clinic: ["Schedule appointments", "Answer patient FAQs", "Handle prescription refills", "All of the above"]
- Real Estate: ["Qualify buyer leads", "Schedule property viewings", "Answer listing questions", "All of the above"]
- E-commerce: ["Order tracking & status", "Returns & refunds", "Product recommendations", "All of the above"]

STEP 4 — CALLER HANDLING
"When the agent can't help, what should it do?"
OPTIONS: ["Transfer to a human", "Take a message with callback number", "Email the details to staff", "Politely end the call"]

STEP 5 — BUSINESS SPECIFICS
Ask ONE targeted question based on their industry to get operational details:
- Restaurant: "What are your hours, and do you take reservations for large parties (8+)?"
- Clinic: "What are your hours, and what insurance plans do you accept?"
- Real Estate: "What areas do you cover, and what's your typical price range?"
- E-commerce: "What's your return policy, and what's the average shipping time?"
NO OPTIONS — free text.

STEP 6 — PERSONALITY
"What personality should your agent have?"
OPTIONS: ["Warm & Friendly", "Professional & Polished", "Energetic & Sales-driven", "Calm & Reassuring"]

STEP 7 — CONFIRMATION
Show a summary and ask "Ready to build?" with OPTIONS: ["Build my agent!", "I want to change something"]

RESPONSE FORMAT RULES:
1. Every message MUST end with a line: OPTIONS: ["option1", "option2", ...] — EXCEPT for free-text steps (steps 2 and 5).
2. For free-text steps, end with: OPTIONS: []
3. Keep messages short — 1-3 sentences max before the OPTIONS line.
4. Be specific to their industry. Don't be generic.
5. After Step 7 confirmation, generate the agent config.

WHEN GENERATING THE FINAL AGENT CONFIG:
Include a ```json``` block with this structure. The "prompt" field is CRITICAL — it must be a world-class system prompt:

```json
{
  "name": "Agent Name",
  "greeting": "...",
  "prompt": "...",
  "language": "en",
  "stt_provider": "deepgram-nova-3",
  "llm_provider": "gpt-4o-mini",
  "tts_provider": "openai-nova",
  "behavior": {
    "tone": "friendly|formal|sales",
    "objective": "support|booking|qualify|sales",
    "fallback": "...",
    "constraints": []
  }
}
```

PROMPT WRITING RULES (for the "prompt" field):
- Write 20-35 lines minimum. This is a PRODUCTION prompt, not a summary.
- Start with: "You are [Name], the AI voice assistant for [Business Name]."
- Include a ROLE section: exactly what the agent does
- Include a KNOWLEDGE section: business hours, policies, menu items, services, prices, areas — everything the user told you
- Include a CONVERSATION FLOW section: step-by-step how a typical call should go
- Include a RULES section with at least 8 specific rules:
  * Always confirm details back to the caller
  * Never make up information you don't have
  * If unsure, say "Let me have someone get back to you on that"
  * Keep responses to 1-2 sentences (this is voice, not text)
  * Don't use markdown, emojis, or special characters
  * Speak naturally — use contractions, filler words are OK
  * Always end calls politely: "Is there anything else I can help with?"
  * Industry-specific rules (HIPAA for clinics, allergy disclaimers for restaurants, etc.)
- Include an ESCALATION section: when and how to hand off
- Include a THINGS TO NEVER DO section: at least 3 items specific to the business

The greeting should sound natural and warm, like a real receptionist:
- Bad: "Hello, I am an AI assistant for XYZ. How may I assist you?"
- Good: "Hi, thanks for calling Bella Vista! I can help with reservations, our menu, or anything else. What can I do for you?"

After the JSON block, write a brief excited message like "Your agent is ready! Hit Deploy to take it live."
Do NOT explain the JSON to the user.
"""


class BuilderChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class BuilderChatResponse(BaseModel):
    reply: str
    options: list[str] = []
    agent_config: Optional[dict] = None


async def _call_llm(messages: list) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    # Convert OpenAI-style messages to Anthropic format
    system_msg = ""
    anthropic_messages = []
    for m in messages:
        if m["role"] == "system":
            system_msg = m["content"]
        else:
            anthropic_messages.append({"role": m["role"], "content": m["content"]})

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "system": system_msg,
                    "messages": anthropic_messages,
                    "max_tokens": 2000,
                    "temperature": 0.7,
                },
            )
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"].strip()
    except Exception as exc:
        logger.error("builder_llm_failed", error=str(exc))
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable")


def _extract_options(text: str) -> tuple[str, list[str]]:
    """Extract OPTIONS: [...] from the end of the message and return (clean_text, options)."""
    match = re.search(r'OPTIONS:\s*\[([^\]]*)\]\s*$', text)
    if not match:
        return text, []

    clean = text[:match.start()].strip()
    raw = match.group(1).strip()
    if not raw:
        return clean, []

    # Parse the options — handle quoted strings
    options = re.findall(r'"([^"]+)"', raw)
    return clean, options


def _extract_agent_config(text: str) -> Optional[dict]:
    """Extract JSON config from LLM response if present."""
    match = re.search(r'```json\s*(\{.*?\})\s*```', text, re.DOTALL)
    if not match:
        return None
    try:
        config = json.loads(match.group(1))
        required = ["name", "greeting", "prompt"]
        if all(k in config for k in required):
            config.setdefault("language", "en")
            config.setdefault("stt_provider", "deepgram-nova-3")
            config.setdefault("llm_provider", "gpt-4o-mini")
            config.setdefault("tts_provider", "openai-nova")
            config.setdefault("behavior", {
                "tone": "friendly",
                "objective": "support",
                "fallback": "Let me connect you with our team.",
                "constraints": [],
            })
            return config
    except (json.JSONDecodeError, ValueError):
        pass
    return None


@router.post("/chat", response_model=BuilderChatResponse)
async def builder_chat(body: BuilderChatRequest, tenant_id: str = Depends(get_tenant_id)):
    messages = [{"role": "system", "content": BUILDER_SYSTEM_PROMPT}]

    for msg in body.history:
        if msg.get("role") in ("user", "assistant"):
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": body.message})

    reply = await _call_llm(messages)

    # Extract options and agent config
    agent_config = _extract_agent_config(reply)

    # Clean JSON block from display text
    clean_reply = re.sub(r'```json\s*\{.*?\}\s*```', '', reply, flags=re.DOTALL).strip()

    # Extract OPTIONS from the clean reply
    clean_reply, options = _extract_options(clean_reply)

    return BuilderChatResponse(
        reply=clean_reply,
        options=options,
        agent_config=agent_config,
    )
