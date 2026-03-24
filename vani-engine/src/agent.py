"""Vani Engine — production voice pipeline.

Phase 5 additions:
  - KB retrieval: inject relevant KB content into system prompt
  - Tool calling: real-time function calls during conversation
  - More LLMs: Claude, GPT-4o, Llama/Groq, Mistral, custom endpoint
  - Cartesia TTS: ultra-low-latency option
  - Concurrency release: notify orchestrator on end
  - Latency tracking: per-turn STT→agent response time
  - Custom LLM endpoint: OpenAI-compatible base_url override
  - Escalation tool: transfer_to_human fires ESCALATION event
"""
import asyncio
import json
import os
import time
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    cli,
)
from livekit.plugins import deepgram, openai

import circuit_breaker
from call_limits import CallLimits
from filler import FillerSystem
from kb_retriever import KBRetriever
from tools.executor import (
    execute_tool,
    load_agent_tools,
    load_agent_products,
    build_livekit_tools,
    build_product_tools,
)

load_dotenv(".env.local")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

server = AgentServer()

_DEFAULT_INSTRUCTIONS = (
    "You are a helpful voice AI assistant. Keep responses short and conversational. "
    "No markdown, no emojis, no asterisks. Speak naturally."
)

ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:8001")
MAX_CALL_DURATION = 900


async def _lookup_agent_by_phone(called_number: str) -> dict:
    """Look up agent config from Supabase by the called phone number."""
    if not SUPABASE_URL or not SUPABASE_KEY or not called_number:
        return {}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            # phone_numbers → agent → full config
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/phone_numbers",
                params={
                    "select": "tenant_id,agent_id,agents(id,name,greeting,prompt,language,voice,stt_provider,llm_provider,tts_provider,behavior,active)",
                    "number": f"eq.{called_number}",
                    "status": "eq.active",
                    "limit": "1",
                },
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                },
            )
            resp.raise_for_status()
            rows = resp.json()
            if not rows:
                print(f">>> No phone_number mapping for {called_number}", flush=True)
                return {}
            row = rows[0]
            agent = row.get("agents") or {}
            if not agent.get("active"):
                print(f">>> Agent inactive for {called_number}", flush=True)
                return {}
            print(f">>> Loaded agent '{agent.get('name')}' for {called_number}", flush=True)
            return {
                "agent_config": {
                    "name": agent.get("name", ""),
                    "greeting": agent.get("greeting", ""),
                    "prompt": agent.get("prompt", ""),
                    "language": agent.get("language", "en"),
                    "voice": agent.get("voice", "nova"),
                    "stt": agent.get("stt_provider", "deepgram-nova-3"),
                    "llm": agent.get("llm_provider", "gpt-4o-mini"),
                    "tts": agent.get("tts_provider", "openai-nova"),
                    "behavior": agent.get("behavior") or {},
                },
                "agent_id": agent.get("id", ""),
                "tenant_id": row.get("tenant_id", ""),
            }
    except Exception as e:
        print(f">>> Phone lookup failed: {e}", flush=True)
        return {}


def _parse_metadata(raw):
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


async def _notify_orchestrator(call_id, event_type, data=None):
    if not call_id or call_id == "unknown":
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(f"{ORCHESTRATOR_URL}/internal/events",
                              json={"type": event_type, "call_id": call_id, "data": data or {}})
    except Exception as exc:
        print(f">>> orchestrator notify failed ({event_type}): {exc}", flush=True)


def _detect_language(lang_code):
    if not lang_code:
        return None
    if lang_code.startswith("hi"):
        return "hi"
    if lang_code.startswith("en"):
        return "en"
    return None


async def _get_embedding_for_memory(text: str) -> list | None:
    """Generate text-embedding-3-small for semantic memory retrieval."""
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key or not text:
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {openai_key}"},
                json={"model": "text-embedding-3-small", "input": text[:4000]},
            )
        r.raise_for_status()
        return r.json()["data"][0]["embedding"]
    except Exception:
        return None


def _format_memories(memories: list) -> str:
    if not memories:
        return ""
    lines = ["## Caller History (use this to personalize the conversation)"]
    for m in memories:
        date     = m.get("created_at", "")[:10]
        summary  = m.get("summary", "").strip()
        entities = m.get("entities") or {}
        line = f"- [{date}] {summary}"
        if entities:
            facts = ", ".join(
                f"{k}: {v}" for k, v in list(entities.items())[:4]
                if v is not None
            )
            if facts:
                line += f" | Known: {facts}"
        lines.append(line)
    return "\n".join(lines)


async def _fetch_caller_memory(phone: str, tenant_id: str, query_hint: str = "") -> str:
    """Fetch top-3 call summaries for this phone number.

    If OpenAI key is available: semantic search via match_call_memory RPC.
    Fallback: recency-ordered REST query.
    """
    if not phone or not tenant_id or not SUPABASE_URL or not SUPABASE_KEY:
        return ""

    # ── Semantic path ─────────────────────────────────────────────────────────
    # Use a generic "customer history" query since we have no user message yet
    query_text = query_hint or f"past calls with customer {phone[-4:]}"
    embedding = await _get_embedding_for_memory(query_text)
    if embedding:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.post(
                    f"{SUPABASE_URL}/rest/v1/rpc/match_call_memory",
                    headers={
                        "apikey":         SUPABASE_KEY,
                        "Authorization":  f"Bearer {SUPABASE_KEY}",
                        "Content-Type":   "application/json",
                    },
                    json={
                        "query_embedding": embedding,
                        "p_tenant_id":     tenant_id,
                        "p_phone":         phone,
                        "match_count":     3,
                    },
                )
            if resp.status_code == 200:
                memories = resp.json()
                result = _format_memories(memories)
                if result:
                    return result
                # Fall through to recency path if no semantic results
        except Exception as exc:
            print(f">>> semantic memory fetch failed: {exc}", flush=True)

    # ── Recency fallback ──────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/call_memory",
                headers={
                    "apikey":        SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                },
                params={
                    "tenant_id": f"eq.{tenant_id}",
                    "phone":     f"eq.{phone}",
                    "order":     "created_at.desc",
                    "limit":     "3",
                    "select":    "summary,entities,created_at",
                },
            )
        if resp.status_code == 200:
            return _format_memories(resp.json())
    except Exception as exc:
        print(f">>> memory fetch failed: {exc}", flush=True)
    return ""


def _build_llm(llm_model: str, custom_llm_url: str = None, custom_llm_model: str = None):
    """Build LLM provider from model string. Custom URL takes precedence."""
    # Custom OpenAI-compatible endpoint: no circuit breaker (user owns it)
    if custom_llm_url:
        custom_key = os.getenv("CUSTOM_LLM_API_KEY", os.getenv("OPENAI_API_KEY", ""))
        resolved_model = custom_llm_model or llm_model or "custom"
        print(f">>> Using custom LLM: {custom_llm_url} model={resolved_model}", flush=True)
        return openai.LLM(model=resolved_model, base_url=custom_llm_url, api_key=custom_key)

    # Circuit breaker: auto-fallback if primary provider is OPEN
    resolved = circuit_breaker.resolve(llm_model)
    if resolved != llm_model:
        llm_model = resolved
    model = llm_model.lower()

    if model.startswith("gpt-") or model.startswith("o1") or model.startswith("o3"):
        return openai.LLM(model=llm_model)

    if model.startswith("gemini"):
        from livekit.plugins import google
        return google.LLM(model=llm_model)

    if model.startswith("claude"):
        try:
            from livekit.plugins import anthropic
            return anthropic.LLM(model=llm_model)
        except ImportError:
            print(">>> livekit-plugins-anthropic not installed, falling back to GPT-4o-mini", flush=True)
            return openai.LLM(model="gpt-4o-mini")

    if model.startswith("llama") or model.startswith("groq"):
        groq_key = os.getenv("GROQ_API_KEY", "")
        groq_model = model.replace("groq-", "").replace("llama-", "llama-")
        if groq_key:
            return openai.LLM(
                model=groq_model or "llama-3.3-70b-versatile",
                base_url="https://api.groq.com/openai/v1",
                api_key=groq_key,
            )

    if model.startswith("mistral") or model.startswith("open-mistral"):
        mistral_key = os.getenv("MISTRAL_API_KEY", "")
        if mistral_key:
            return openai.LLM(
                model=llm_model,
                base_url="https://api.mistral.ai/v1",
                api_key=mistral_key,
            )

    if model.startswith("deepseek"):
        ds_key = os.getenv("DEEPSEEK_API_KEY", "")
        if ds_key:
            return openai.LLM(
                model=llm_model,
                base_url="https://api.deepseek.com/v1",
                api_key=ds_key,
            )

    # Default fallback
    return openai.LLM(model="gpt-4o-mini")


def _build_tts(tts_provider: str, voice: str, language: str):
    """Build TTS provider from config string."""
    # Circuit breaker: auto-fallback if primary TTS provider is OPEN
    tts_provider = circuit_breaker.resolve(tts_provider)

    valid_openai_voices = ("alloy", "echo", "fable", "onyx", "nova", "shimmer")
    tts_voice = voice if voice in valid_openai_voices else "nova"

    if tts_provider.startswith("cartesia"):
        try:
            from providers.tts.cartesia import get_cartesia_tts
            cartesia_key = os.getenv("CARTESIA_API_KEY", "")
            if cartesia_key:
                model = "sonic-2-2025-03-07" if language in ("hi", "multi") else "sonic-2"
                return get_cartesia_tts(language=language, model=model)
            else:
                print(">>> CARTESIA_API_KEY not set, falling back to OpenAI TTS", flush=True)
        except Exception as e:
            print(f">>> Cartesia init failed: {e}", flush=True)

    if tts_provider.startswith("sarvam"):
        try:
            from providers.tts.sarvam import SarvamTTS
            sarvam_key = os.getenv("SARVAM_API_KEY", "")
            if sarvam_key:
                return SarvamTTS(api_key=sarvam_key, voice=voice or "priya", language=language)
            print(">>> SARVAM_API_KEY not set, falling back to OpenAI TTS", flush=True)
        except Exception as e:
            print(f">>> Sarvam init failed: {e}", flush=True)

    if tts_provider.startswith("elevenlabs"):
        try:
            from livekit.plugins import elevenlabs
            el_key = os.getenv("ELEVENLABS_API_KEY", "")
            el_voice = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
            if el_key:
                return elevenlabs.TTS(api_key=el_key, voice_id=el_voice)
        except ImportError:
            pass

    # Default: OpenAI TTS
    return openai.TTS(voice=tts_voice)


def _build_product_prompt(products: list[dict]) -> str:
    """Inject product catalog into system prompt."""
    if not products:
        return ""
    lines = [
        "## Product Catalog",
        "When you start discussing any product below, immediately call __show_product.",
        "Call __clear_product when moving away from a product topic.",
        "",
    ]
    for p in products:
        line = f"- **{p['name']}**: {p.get('description', '')}"
        if p.get("keywords"):
            line += f" (trigger words: {', '.join(p['keywords'])})"
        lines.append(line)
    return "\n".join(lines)


class VaaniAssistant(Agent):
    def __init__(self, instructions, greeting, tools_config=None, call_context=None, room=None, products=None):
        super().__init__(instructions=instructions)
        self._greeting     = greeting
        self._tools_config = tools_config or []
        self._call_context = call_context or {}
        self._room         = room
        self._products     = {p["name"].lower(): p for p in (products or [])}

    async def on_enter(self):
        await self.session.say(self._greeting)

    async def _publish_data(self, payload: dict):
        """Send a data channel message to the kiosk UI."""
        if not self._room:
            return
        try:
            await self._room.local_participant.publish_data(
                json.dumps(payload).encode(),
                reliable=True,
            )
        except Exception as exc:
            print(f">>> data channel publish failed: {exc}", flush=True)

    def _find_product(self, name: str) -> dict | None:
        key = name.lower().strip()
        if key in self._products:
            return self._products[key]
        for k, p in self._products.items():
            if key in k or k in key:
                return p
        return None

    async def on_function_call(self, function_name: str, arguments: dict):
        """Called by LiveKit when LLM invokes a tool."""

        # ── Built-in kiosk product tools ──────────────────────────────────────
        if function_name == "__show_product":
            product = self._find_product(arguments.get("product_name", ""))
            if product:
                await self._publish_data({"type": "show_product", "product": product})
                print(f">>> KIOSK show_product: {product['name']}", flush=True)
                return f"Displaying {product['name']} on screen."
            return f"Product '{arguments.get('product_name')}' not found."

        if function_name == "__clear_product":
            await self._publish_data({"type": "clear_product"})
            print(">>> KIOSK clear_product", flush=True)
            return "Product display cleared."

        # Special handling: escalation/transfer tool
        if function_name == "transfer_to_human":
            call_id = self._call_context.get("call_id", "")
            transfer_number = arguments.get("transfer_number") or self._call_context.get("escalation_transfer_number", "")
            whisper_text = arguments.get("whisper_text") or self._call_context.get("escalation_whisper", "")
            agent_name   = self._call_context.get("agent_name", "Vaani")
            print(f">>> ESCALATION triggered for call {call_id} → {transfer_number}", flush=True)
            asyncio.create_task(_notify_orchestrator(call_id, "ESCALATION", {
                "transfer_number": transfer_number,
                "whisper_text": whisper_text,
                "agent_name": agent_name,
            }))
            return "I'm transferring you now. Please hold while I connect you to a team member."

        tool = next((t for t in self._tools_config if t["name"] == function_name), None)
        if not tool:
            return f"Unknown tool: {function_name}"

        result = await execute_tool(
            tool,
            arguments,
            call_id=self._call_context.get("call_id", ""),
            tenant_id=self._call_context.get("tenant_id", ""),
            call_context=self._call_context,
        )
        print(f">>> TOOL CALL: {function_name}({arguments}) → {result[:100]}", flush=True)
        return result


@server.rtc_session(agent_name="vani-agent")
async def vani_agent(ctx: JobContext):
    await ctx.connect()
    started_at = time.time()

    metadata = _parse_metadata(getattr(ctx.job, "metadata", None))

    # If no metadata (direct SIP dispatch), look up agent by called number
    if not metadata.get("agent_config"):
        # Find the SIP participant to get the called number
        for p in ctx.room.remote_participants.values():
            attrs = p.attributes or {}
            called_number = attrs.get("sip.trunkPhoneNumber", "")
            caller_number = attrs.get("sip.phoneNumber", "")
            if called_number:
                print(f">>> SIP call: {caller_number} → {called_number}", flush=True)
                db_config = await _lookup_agent_by_phone(called_number)
                if db_config:
                    metadata.update(db_config)
                    metadata["phone"] = caller_number
                    metadata["direction"] = "inbound"
                break

    cfg       = metadata.get("agent_config", {})
    call_id   = metadata.get("call_id", "unknown")
    agent_id  = metadata.get("agent_id", "")
    tenant_id = metadata.get("tenant_id", "")
    direction = metadata.get("direction", "inbound")

    instructions     = cfg.get("prompt") or os.getenv("VAANI_AGENT_INSTRUCTIONS", _DEFAULT_INSTRUCTIONS)
    greeting         = cfg.get("greeting") or os.getenv("VAANI_GREETING", "Hello, I'm Vaani. How can I help you?")
    language         = cfg.get("language") or os.getenv("VAANI_LANGUAGE", "en")
    voice            = cfg.get("voice", "nova")
    llm_model        = cfg.get("llm", "gpt-4o-mini")
    stt_model        = cfg.get("stt", "deepgram-nova-3").replace("deepgram-", "")
    tts_provider     = cfg.get("tts", "openai")
    custom_llm_url   = cfg.get("custom_llm_url") or None
    custom_llm_model = cfg.get("custom_llm_model") or None

    # Escalation config
    escalation_cfg     = cfg.get("escalation_config") or {}
    escalation_enabled = escalation_cfg.get("enabled", False)
    transfer_number    = escalation_cfg.get("transfer_number", "")
    escalation_trigger = escalation_cfg.get("trigger", "user asks for human")
    escalation_whisper = escalation_cfg.get("whisper", "Caller is being transferred.")

    deepgram_model = stt_model if stt_model.startswith("nova") else "nova-3"
    dg_language = "multi" if language == "multi" else (language or "en")

    # ── Load KB + Tools + Products + Long-Term Memory ────────────────────────
    kb_context     = ""
    tools_config   = []
    products       = []
    memory_context = ""
    if agent_id:
        retriever = KBRetriever(agent_id)
        phone_number = metadata.get("phone", "")

        # Parallelize all I/O — these are independent DB/API calls
        async def _load_kb():
            await retriever.load()
            return await retriever.get_context(max_chars=4000)

        async def _load_products():
            injected = metadata.get("products")
            if isinstance(injected, list) and injected:
                return injected
            return await load_agent_products(agent_id)

        async def _load_memory():
            if phone_number and tenant_id:
                return await _fetch_caller_memory(phone_number, tenant_id)
            return ""

        kb_context, tools_config, products, memory_context = await asyncio.gather(
            _load_kb(),
            load_agent_tools(agent_id),
            _load_products(),
            _load_memory(),
        )
        if memory_context:
            print(f">>> memory loaded for {phone_number[:6]}***", flush=True)
    else:
        phone_number = metadata.get("phone", "")

    # Add escalation tool if configured
    if escalation_enabled and transfer_number:
        escalation_tool = {
            "name": "transfer_to_human",
            "description": f"Transfer the call to a human agent. Use this when: {escalation_trigger}",
            "parameters": {
                "type": "object",
                "properties": {
                    "transfer_number": {
                        "type": "string",
                        "description": "The phone number to transfer to",
                        "default": transfer_number,
                    },
                    "whisper_text": {
                        "type": "string",
                        "description": "Brief context for the human agent",
                    },
                },
                "required": [],
            },
        }
        tools_config = [escalation_tool] + tools_config

    # Build full system prompt with KB
    full_instructions = instructions
    if kb_context:
        full_instructions = (
            f"{instructions}\n\n"
            f"## Knowledge Base\nUse the following information to answer questions:\n\n{kb_context}"
        )
    if escalation_enabled and transfer_number:
        full_instructions += f"\n\nEscalation: {escalation_trigger} → use transfer_to_human tool."
    if products:
        full_instructions += "\n\n" + _build_product_prompt(products)
    if memory_context:
        full_instructions += "\n\n" + memory_context

    # ── Build providers ───────────────────────────────────────────────────────
    llm = _build_llm(llm_model, custom_llm_url=custom_llm_url, custom_llm_model=custom_llm_model)
    tts = _build_tts(tts_provider, voice, dg_language)

    # ── LLM tools: external + built-in product tools ──────────────────────────
    lk_tools = build_livekit_tools(tools_config) + build_product_tools(products)

    session = AgentSession(
        stt=deepgram.STT(
            model=deepgram_model,
            language=dg_language,
            smart_format=True,
            filler_words=False,
            endpointing_ms=25,
        ),
        llm=llm,
        tts=tts,
        preemptive_generation=True,
    )

    filler = FillerSystem(session, language=language, delay_ms=100)
    limits = CallLimits(session, language=language)
    transcript_lines = []
    language_locked = [language in ("en", "hi")]

    # ── Latency tracking ─────────────────────────────────────────────────────
    last_user_ts = [0.0]      # timestamp of last user_speech_committed
    turn_latencies = []       # list of ms from user_speech_committed → agent_speech_started

    @session.on("user_speech_committed")
    def on_user_speech(msg):
        last_user_ts[0] = time.monotonic()
        text = getattr(msg, "transcript", None) or str(msg)
        if text:
            ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
            transcript_lines.append(f"[{ts}] User: {text}")
        if not language_locked[0]:
            detected = _detect_language(getattr(msg, "language", None))
            if detected:
                filler.set_language(detected)
                limits.set_language(detected)
                language_locked[0] = True
        filler.on_user_speech()
        limits.on_user_speech()

    @session.on("agent_speech_started")
    def on_agent_started(_):
        if last_user_ts[0] > 0:
            latency_ms = int((time.monotonic() - last_user_ts[0]) * 1000)
            turn_latencies.append(latency_ms)
            last_user_ts[0] = 0.0  # reset until next user turn
        filler.on_agent_started()

    @session.on("agent_speech_committed")
    def on_agent_speech(msg):
        text = getattr(msg, "text", None) or str(msg)
        if text:
            ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
            transcript_lines.append(f"[{ts}] Agent: {text}")
        filler.on_agent_stopped()
        limits.on_agent_stopped()

    call_context = {
        "call_id": call_id,
        "tenant_id": tenant_id,
        "agent_id": agent_id,
        "direction": direction,
        "phone": metadata.get("phone", ""),
        "agent_name": cfg.get("name", "Vaani"),
        "escalation_transfer_number": transfer_number,
        "escalation_whisper": escalation_whisper,
    }

    try:
        await session.start(
            agent=VaaniAssistant(
                instructions=full_instructions,
                greeting=greeting,
                tools_config=tools_config,
                call_context=call_context,
                room=ctx.room,
                products=products,
            ),
            room=ctx.room,
            record=False,
        )
        # Circuit breaker: session started successfully — providers are healthy
        circuit_breaker.record_success(llm_model)
        circuit_breaker.record_success(tts_provider)
        print(f">>> SESSION STARTED | call_id={call_id} | llm={llm_model}"
              f"{' (custom)' if custom_llm_url else ''} | tts={tts_provider}"
              f" | tools={len(tools_config)} | products={len(products)} | kb={'yes' if kb_context else 'no'}"
              f" | memory={'yes' if memory_context else 'no'}"
              f" | escalation={'yes' if escalation_enabled else 'no'}", flush=True)
        await _notify_orchestrator(call_id, "CALL_STARTED")
    except Exception as exc:
        # Circuit breaker: record provider failures on session start error
        circuit_breaker.record_failure(llm_model)
        circuit_breaker.record_failure(tts_provider)
        import traceback; traceback.print_exc()
        print(f">>> SESSION START FAILED: {exc}", flush=True)
        await _notify_orchestrator(call_id, "CALL_ENDED", {"error": str(exc)})
        return

    disconnected = asyncio.Event()
    ctx.room.on("disconnected", lambda *_: disconnected.set())
    try:
        await asyncio.wait_for(disconnected.wait(), timeout=MAX_CALL_DURATION)
    except asyncio.TimeoutError:
        print(f">>> CALL TIMEOUT | call_id={call_id}", flush=True)

    duration_sec = int(time.time() - started_at)
    print(f">>> SESSION ENDED | call_id={call_id} | turns={limits.turn_count} | duration={duration_sec}s", flush=True)

    # Build latency profile
    latency_profile = None
    if turn_latencies:
        sorted_lats = sorted(turn_latencies)
        n = len(sorted_lats)
        latency_profile = {
            "avg_ms":   int(sum(sorted_lats) / n),
            "p50_ms":   sorted_lats[n // 2],
            "p95_ms":   sorted_lats[int(n * 0.95)] if n >= 20 else sorted_lats[-1],
            "min_ms":   sorted_lats[0],
            "max_ms":   sorted_lats[-1],
            "samples":  n,
        }

    # Resolve actual providers used
    stt_provider_str = cfg.get("stt", "deepgram-nova-3")
    llm_provider_str = cfg.get("llm", "gpt-4o-mini")
    tts_provider_str = cfg.get("tts", "openai-nova")

    await _notify_orchestrator(call_id, "CALL_ENDED", {
        "duration_sec":    duration_sec,
        "transcript":      "\n".join(transcript_lines),
        "turn_count":      limits.turn_count,
        "tenant_id":       tenant_id,
        "stt_provider":    stt_provider_str,
        "llm_provider":    llm_provider_str,
        "tts_provider":    tts_provider_str,
        "direction":       direction,
        "latency_profile": latency_profile,
    })


def _start_health_server() -> None:
    """Minimal HTTP health check server for Railway / load-balancer probes."""
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class _Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = b'{"ok":true,"service":"vani-engine"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):  # silence access logs
            pass

    port = int(os.getenv("HEALTH_PORT", "8080"))
    srv  = HTTPServer(("0.0.0.0", port), _Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    print(f">>> Health server listening on :{port}/", flush=True)


if __name__ == "__main__":
    _start_health_server()
    cli.run_app(server)
