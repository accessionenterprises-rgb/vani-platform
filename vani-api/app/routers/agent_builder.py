"""
Conversational AI Agent Builder — chat-based wizard that asks questions
with clickable options, scrapes the business website, and generates
a production-ready voice agent.

POST /builder/chat   { message, history[] }
  → { reply, options[], agent_config?, scanning? }
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


# ── Website scraper ──────────────────────────────────────────────────────────

async def _scrape_website(url: str) -> Optional[str]:
    """Scrape a website and return cleaned text content (max 3000 chars)."""
    if not url.startswith("http"):
        url = "https://" + url

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; VaniBot/1.0; +https://vani.live)",
            })
        if resp.status_code != 200:
            return None

        html = resp.text

        # Strip scripts, styles, tags
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<nav[^>]*>.*?</nav>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<footer[^>]*>.*?</footer>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<[^>]+>', ' ', html)
        html = re.sub(r'&[a-zA-Z]+;', ' ', html)
        html = re.sub(r'\s+', ' ', html).strip()

        # Truncate
        return html[:3000] if html else None
    except Exception as exc:
        logger.warning("website_scrape_failed", url=url, error=str(exc))
        return None


def _extract_url(text: str) -> Optional[str]:
    """Extract a URL from user message."""
    # Match common URL patterns
    match = re.search(r'(https?://[^\s]+|(?:www\.)[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?)', text)
    if match:
        url = match.group(1)
        # Skip common non-website strings
        if '.' in url and not url.endswith('.') and len(url) > 4:
            return url
    return None


# ── System prompt ────────────────────────────────────────────────────────────

BUILDER_SYSTEM_PROMPT = r"""You are the Vani Agent Builder — an expert voice AI architect. You build production-grade phone agents through a quick, guided conversation.

YOUR CONVERSATION FLOW (ask ONE question per message, in this order):

STEP 1 — INDUSTRY
"What industry is this agent for?"
OPTIONS: ["Restaurant & Food", "Healthcare & Clinics", "Real Estate", "E-commerce & Retail", "Hotels & Hospitality", "Education", "Financial Services", "Other"]

STEP 2 — WEBSITE
"Got a website? Drop the link and I'll pull your business details automatically — or just describe your business."
OPTIONS: []
(Free text — they can paste a URL or describe manually.)

STEP 2B — CONFIRM SCRAPED DATA (only if website was provided)
If WEBSITE_CONTENT is injected into the conversation, analyze it and present a summary:
"Here's what I found from your website:
• Business name: [name]
• Services/Products: [list]
• Hours: [if found]
• Location: [if found]
• Key details: [anything relevant]

Does this look right? Anything to add or fix?"
OPTIONS: ["Looks good!", "I need to correct something"]

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

STEP 5 — PERSONALITY
"What personality should your agent have?"
OPTIONS: ["Warm & Friendly", "Professional & Polished", "Energetic & Sales-driven", "Calm & Reassuring"]

STEP 6 — ANYTHING ELSE
"Any special instructions? (business hours, policies, things to never say, VIP callers, etc.)"
OPTIONS: ["No, let's build it!", "Yes, I have some notes"]

STEP 7 — CONFIRMATION (only if they said "yes" to step 6 or corrected something)
Show a summary and ask "Ready to build?" with OPTIONS: ["Build my agent!", "I want to change something"]

RESPONSE FORMAT RULES:
1. Every message MUST end with a line: OPTIONS: ["option1", "option2", ...] — EXCEPT for free-text steps.
2. For free-text steps, end with: OPTIONS: []
3. Keep messages short — 1-3 sentences max before the OPTIONS line.
4. Be specific to their industry. Don't be generic.
5. When website content is available, USE it — extract business name, services, hours, menu items, prices, locations, policies. Don't ask for info that's already in the website content.
6. After confirmation, generate the agent config.

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
- Include a KNOWLEDGE section: business hours, policies, menu items, services, prices, areas — everything from the website + what the user told you. Be SPECIFIC — include actual menu items, actual services, actual prices if available.
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


# ── Schemas ──────────────────────────────────────────────────────────────────

class BuilderChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class BuilderChatResponse(BaseModel):
    reply: str
    options: list[str] = []
    agent_config: Optional[dict] = None
    scanning: bool = False


# ── LLM ──────────────────────────────────────────────────────────────────────

async def _call_llm(messages: list) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

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


# ── Extractors ───────────────────────────────────────────────────────────────

def _extract_options(text: str) -> tuple[str, list[str]]:
    """Extract OPTIONS: [...] from the end of the message."""
    match = re.search(r'OPTIONS:\s*\[([^\]]*)\]\s*$', text)
    if not match:
        return text, []
    clean = text[:match.start()].strip()
    raw = match.group(1).strip()
    if not raw:
        return clean, []
    options = re.findall(r'"([^"]+)"', raw)
    return clean, options


def _extract_agent_config(text: str) -> Optional[dict]:
    """Extract JSON config from LLM response."""
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


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=BuilderChatResponse)
async def builder_chat(body: BuilderChatRequest, tenant_id: str = Depends(get_tenant_id)):
    user_message = body.message

    # Check if user sent a URL — scrape the website
    url = _extract_url(user_message)
    website_content = None
    if url:
        website_content = await _scrape_website(url)

    # Build message history
    messages = [{"role": "system", "content": BUILDER_SYSTEM_PROMPT}]

    for msg in body.history:
        if msg.get("role") in ("user", "assistant"):
            messages.append({"role": msg["role"], "content": msg["content"]})

    # If we scraped website content, inject it into the user message
    if website_content:
        augmented_message = (
            f"{user_message}\n\n"
            f"[WEBSITE_CONTENT scraped from {url}]:\n"
            f"{website_content}\n"
            f"[END WEBSITE_CONTENT]\n\n"
            f"Use this content to extract business details. Present a summary to confirm with me."
        )
        messages.append({"role": "user", "content": augmented_message})
    else:
        messages.append({"role": "user", "content": user_message})

    reply = await _call_llm(messages)

    # Extract options and agent config
    agent_config = _extract_agent_config(reply)
    clean_reply = re.sub(r'```json\s*\{.*?\}\s*```', '', reply, flags=re.DOTALL).strip()
    clean_reply, options = _extract_options(clean_reply)

    return BuilderChatResponse(
        reply=clean_reply,
        options=options,
        agent_config=agent_config,
    )
