"""
Agora Conversational AI — per-call agent via REST API.

Unlike LiveKit (persistent agent process), Agora creates a fresh agent per call:
  POST /join → Agora spins up agent with our STT/LLM/TTS config → agent joins channel → talks → leaves.

Docs: https://doc.agora.io/doc/conversational-ai/restful-api
"""
import base64
import random
import string
import time

import httpx
import structlog

from config import settings

logger = structlog.get_logger()

AGORA_BASE_URL = "https://api.agora.io/api/conversational-ai-agent/v2/projects"


def _auth_header() -> str:
    """Basic auth: Base64(customer_key:customer_secret)."""
    creds = f"{settings.agora_customer_key}:{settings.agora_customer_secret}"
    return "Basic " + base64.b64encode(creds.encode()).decode()


def _make_channel_name() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"vani-{suffix}"


def _map_asr_provider(stt: str) -> dict:
    """Map Vani STT provider string to Agora ASR config."""
    model = "nova-3" if "nova-3" in stt else "nova-2"
    return {
        "vendor": "deepgram",
        "params": {
            "model": model,
            "api_key": settings.deepgram_api_key,
        },
        "language": "en-US",
    }


def _map_llm_provider(llm: str, prompt: str, greeting: str) -> dict:
    """Map Vani LLM provider string to Agora LLM config."""
    # Groq — OpenAI-compatible API, different base URL
    if llm.startswith("groq-") or llm.startswith("llama") or llm.startswith("mixtral") or llm.startswith("gemma"):
        groq_key = getattr(settings, 'groq_api_key', '') or ''
        groq_model = llm.replace("groq-", "")
        if not groq_model or groq_model == llm:
            groq_model = "llama-3.3-70b-versatile"
        return {
            "url": "https://api.groq.com/openai/v1/chat/completions",
            "api_key": groq_key,
            "params": {"model": groq_model, "max_tokens": 4096, "temperature": 0.7},
            "system_messages": [{"role": "system", "content": prompt}],
            "greeting_message": greeting or "",
        }

    # Gemini — route through OpenAI-compatible proxy (not natively supported by Agora)
    # Fall back to GPT for Agora when Gemini is selected
    if llm.startswith("gemini"):
        model = "gpt-4o-mini"  # Agora can't call Gemini directly
    elif llm.startswith("gpt"):
        model = llm
    else:
        model = "gpt-4o-mini"

    token_param = "max_completion_tokens" if "gpt-5" in model or "gpt-5." in model else "max_tokens"
    return {
        "url": "https://api.openai.com/v1/chat/completions",
        "api_key": settings.openai_api_key,
        "params": {"model": model, token_param: 4096, "temperature": 0.7},
        "system_messages": [{"role": "system", "content": prompt}],
        "greeting_message": greeting or "",
    }


def _map_tts_provider(tts: str, voice: str) -> dict:
    """Map Vani TTS provider string to Agora TTS config."""
    # Don't split UUIDs (e.g. e07c00bc-4134-4eae-9ea4-1a55fb45746b)
    # Only strip provider prefix like "openai-nova" → "nova"
    prefixes = ("openai-", "cartesia-", "sarvam-", "elevenlabs-")
    voice_name = voice
    for prefix in prefixes:
        if voice.startswith(prefix):
            voice_name = voice[len(prefix):]
            break

    if tts == "cartesia":
        return {
            "vendor": "cartesia",
            "params": {
                "api_key": settings.cartesia_api_key,
                "voice_id": voice_name,
                "model_id": "sonic-3",
                "language": "en",
            },
        }
    # Default: OpenAI
    return {
        "vendor": "openai",
        "params": {
            "api_key": settings.openai_api_key,
            "model": "tts-1",
            "voice": voice_name or "nova",
        },
    }


def _build_language(language: str) -> str:
    """Convert language code to BCP-47."""
    lang_map = {
        "en": "en-US",
        "hi": "hi-IN",
        "ta": "ta-IN",
        "te": "te-IN",
        "kn": "kn-IN",
        "ml": "ml-IN",
        "mr": "mr-IN",
        "bn": "bn-IN",
        "gu": "gu-IN",
        "pa": "pa-IN",
    }
    return lang_map.get(language, language if "-" in language else "en-US")


async def join_channel(
    channel_name: str,
    agent_config: dict,
    call_id: str,
) -> dict:
    """
    Call Agora Conversational AI /join — creates a per-call agent.

    Returns: { "agent_id": "...", "channel": "...", "create_ts": ... }
    """
    app_id = settings.agora_app_id
    if not app_id:
        raise RuntimeError("AGORA_APP_ID not configured")

    url = f"{AGORA_BASE_URL}/{app_id}/join"

    stt = agent_config.get("stt", "deepgram-nova-3")
    llm = agent_config.get("llm", "gpt-4o-mini")
    tts = agent_config.get("tts", "openai")
    voice = agent_config.get("voice", "openai-nova")
    prompt = agent_config.get("prompt", "You are a helpful assistant.")
    greeting = agent_config.get("greeting", "")
    language = agent_config.get("language", "en-US")

    # Inject behavior into prompt
    behavior = agent_config.get("behavior") or {}
    if behavior:
        additions = []
        if behavior.get("tone"):
            additions.append(f"Tone: {behavior['tone']}")
        if behavior.get("objective"):
            additions.append(f"Objective: {behavior['objective']}")
        if behavior.get("constraints"):
            additions.append(f"Constraints: {', '.join(behavior['constraints'])}")
        if behavior.get("fallback"):
            additions.append(f"Fallback response: {behavior['fallback']}")
        if additions:
            prompt = prompt + "\n\n" + "\n".join(additions)

    bcp_language = _build_language(language)

    # Build Agora request body
    body = {
        "name": f"vani-{call_id[:8]}",
        "properties": {
            "channel": channel_name,
            "token": "",
            "agent_rtc_uid": "1",
            "remote_rtc_uids": ["0"],
            "enable_string_uid": False,
            "idle_timeout": 30,
            "llm": _map_llm_provider(llm, prompt, greeting),
            "tts": _map_tts_provider(tts, voice),
            "asr": _map_asr_provider(stt),
            "input_modalities": ["text"],
            "output_modalities": ["text", "audio"],
        },
    }

    # Add transcript webhook if orchestrator URL is configured
    orchestrator_url = settings.orchestrator_public_url
    if orchestrator_url:
        body["properties"]["transcript"] = {
            "webhook_url": f"{orchestrator_url}/agora/events",
        }

    log = logger.bind(call_id=call_id, channel=channel_name)
    log.info("agora_join_request", llm=llm, stt=stt, tts=tts)

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url,
            json=body,
            headers={
                "Authorization": _auth_header(),
                "Content-Type": "application/json",
            },
        )

    if resp.status_code not in (200, 201):
        error_body = resp.text
        log.error("agora_join_failed", status=resp.status_code, body=error_body)
        raise RuntimeError(f"Agora /join failed ({resp.status_code}): {error_body}")

    data = resp.json()
    agent_id = data.get("agent_id", "")
    log.info("agora_join_success", agora_agent_id=agent_id)

    return {
        "agent_id": agent_id,
        "channel": channel_name,
        "create_ts": data.get("create_ts", int(time.time())),
    }


async def stop_agent(agent_id: str) -> bool:
    """Stop an Agora conversational AI agent."""
    app_id = settings.agora_app_id
    if not app_id or not agent_id:
        return False

    url = f"{AGORA_BASE_URL}/{app_id}/agents/{agent_id}/stop"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                headers={"Authorization": _auth_header()},
            )
        if resp.status_code in (200, 204):
            logger.info("agora_agent_stopped", agent_id=agent_id)
            return True
        else:
            logger.warning("agora_stop_failed", agent_id=agent_id, status=resp.status_code)
            return False
    except Exception as e:
        logger.error("agora_stop_error", agent_id=agent_id, error=str(e))
        return False


async def query_agent(agent_id: str) -> dict | None:
    """Query status of an Agora conversational AI agent."""
    app_id = settings.agora_app_id
    if not app_id or not agent_id:
        return None

    url = f"{AGORA_BASE_URL}/{app_id}/agents/{agent_id}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                url,
                headers={"Authorization": _auth_header()},
            )
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception as e:
        logger.error("agora_query_error", agent_id=agent_id, error=str(e))
        return None


def make_channel_name() -> str:
    """Public wrapper for channel name generation."""
    return _make_channel_name()
