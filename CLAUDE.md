# Vani — AI Voice Agent Platform

## What is Vani
Vani is a multi-tenant B2B voice AI platform (vani.live) where businesses create AI phone agents for inbound/outbound calls. Retell AI competitor — built with LiveKit Cloud, Twilio, Supabase, and Claude/GPT.

## Architecture

### Monorepo Structure
```
Vani/
├── vani-api/          # FastAPI backend (Python 3.12, Railway)
├── vani-dashboard/    # React 19 + Vite frontend (Vercel)
├── vani-engine/       # LiveKit voice engine (Python, Railway)
├── vani-orchestrator/ # Call orchestration + worker pool (Python, Railway)
├── vani-admin/        # Admin panel (React + Vite, Vercel)
└── supabase/          # SQL migrations (001–017)
```

### Production URLs
- **Dashboard**: dashboard.vani.live (Vercel — vani-platform.vercel.app)
- **API**: api.vani.live (Railway — lucid-forgiveness-production-9d89.up.railway.app)
- **Orchestrator**: orchestrator.vani.live (Railway — vani-platform-production.up.railway.app)
- **Engine**: engine.vani.live (Railway — luminous-trust-production-4480.up.railway.app)
- **Admin**: admin.vani.live (Vercel)
- **Website**: vani.live (Hostinger)
- **Redis**: redis://default:tSTuTnqUUmsWTfFPsCsyQluRNPXgFuCw@redis.railway.internal:6379

### Tech Stack
- **API**: FastAPI, Python 3.12, uv, Docker → Railway
- **Dashboard**: React 19, React Router 7, Vite, Tailwind → Vercel
- **Voice Engine**: LiveKit Agents SDK, Deepgram STT, OpenAI TTS
- **Telephony**: Twilio (SIP trunking, number purchase, browser dialer)
- **DB**: Supabase (Postgres + pgvector for memory embeddings)
- **AI**: OpenAI GPT-4o-mini (conversation), Claude Haiku (number scoring), OpenAI text-embedding-3-small (memory)
- **Queue**: Redis (job queues for call routing)

## LiveKit Cloud
- **Project**: vani-voice-s42m8zzi
- **Region**: ap-south (India)
- **Agent ID**: CA_ayaKf2rdjmoN (vani-agent)
- **API Key**: APIUN3hK4QjQcAn
- **API Secret**: wjZ58sv9eB9QpEJAoUoSVGtQCY1iLe7SMIGyxp1HRKW
- **STT**: Deepgram Nova-3 (livekit-plugins-deepgram)
- **LLM**: OpenAI GPT-4o-mini
- **TTS**: OpenAI Nova voice
- **Secrets set in LiveKit Cloud**: DEEPGRAM_API_KEY, GOOGLE_API_KEY, OPENAI_API_KEY, VANI_LANGUAGE, VANI_AGENT_NAME

### Engine Deploy Command
```bash
cd vani-engine && ~/bin/lk agent deploy --url wss://vani-voice-s42m8zzi.livekit.cloud --api-key APIUN3hK4QjQcAn --api-secret wjZ58sv9eB9QpEJAoUoSVGtQCY1iLe7SMIGyxp1HRKW
```

### Test Locally
```bash
cd /Users/sriven/Desktop/Vani && vani-engine/.venv/bin/python test-server.py
open http://localhost:3456
```

## Twilio
- **Account SID**: Set on Railway as TWILIO_ACCOUNT_SID
- **Auth Token**: Set on Railway as TWILIO_AUTH_TOKEN
- **Active Number**: +19209209967 (920-920-9967, Claverack NY)
- **Number Pricing**: $2/month per number (matching Retell)

---

## vani-api (FastAPI)

### Key Files
- `main.py` — FastAPI app, CORS, router mounts
- `app/config.py` — Pydantic Settings (env vars from .env.local)
- `app/routers/` — all API routes

### Environment Variables (Railway)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`
- `TWILIO_CALLER_ID` (default: +19209209967)
- `ANTHROPIC_API_KEY` (for AI memorability scoring)
- `ADMIN_SECRET` (default: vani-admin-change-me)
- `PORT` (default: 8000)

### CORS (Production)
Allowed: vani.live, app.vani.live, dashboard.vani.live, admin.vani.live

### Routers & Routes

#### auth.py
- `POST /auth/signup` — create user (bypasses email confirm via admin API)
- `POST /auth/login` — authenticate → { access_token, refresh_token, tenant_id }
- `GET /auth/me` — current user info

#### agents.py
- `GET /agents` — list agents
- `GET /agents/{id}` — get agent
- `POST /agents` — create agent (name, greeting, prompt, language, voice, behavior, stack, extraction_schema, escalation)
- `PATCH /agents/{id}` — update agent
- `DELETE /agents/{id}` — delete agent
- `GET /agents/{id}/versions` — version history
- `POST /agents/{id}/restore/{version_id}` — restore version

Agent schemas:
```
BehaviorConfig: tone, objective, constraints[], fallback
StackConfig: stt="deepgram-nova-3", llm="gpt-4o-mini", tts="openai-nova"
EscalationConfig: enabled, transfer_number, trigger, whisper, cool_off_sec, announce_transfer
```

#### calls.py
- `GET /calls` — list calls (paginated)
- `GET /calls/{id}` — call details
- `GET /calls/{id}/transcript` — get transcript
- `POST /calls/{id}/stop` — cancel call
- `GET /calls/{id}/monitor-token` — supervisor monitor token
- `POST /calls/{id}/qa` — AI quality assurance

Call statuses: incoming → routing → connecting → active → ending → completed | failed

#### outbound.py
- `POST /calls/outbound` — trigger single outbound call
- Queues: `vani:queue:outbound` (standard), `vani:queue:outbound:enterprise` (priority)

#### campaigns.py
- `POST /campaigns` — create campaign (name, agent_id, from_number, scheduled_at, max_attempts, retry_delay_min, call_window, timezone)
- `GET /campaigns` — list
- `GET /campaigns/{id}` — get + stats
- `POST /campaigns/{id}/contacts` — bulk upload (CSV/JSON)
- `GET /campaigns/{id}/contacts` — list contacts + status
- `POST /campaigns/{id}/start` — kick off
- `POST /campaigns/{id}/pause` — pause
- `POST /campaigns/{id}/cancel` — cancel

#### numbers.py
- `GET /numbers` — list tenant's numbers
- `POST /numbers` — add number (existing/SIP)
- `PATCH /numbers/{id}` — update (agent assignment)
- `DELETE /numbers/{id}` — delete
- `GET /numbers/available` — search Twilio inventory
- `POST /numbers/buy` — purchase (agent_id is OPTIONAL)
- `POST /numbers/sync` — sync Twilio inventory

#### dialer.py
- `GET /dialer/token` — Twilio Access Token for Voice JS SDK (identity=tenant_id, ttl=3600s)
- `POST /dialer/voice` — PUBLIC TwiML callback (Twilio calls this when browser dials)

#### number_hunter.py
Finds memorable Twilio numbers across all 15 NANP countries.

Patterns: S-ten, P-suffix-quad (****AAAA), P-seq5/6/7, A-double-seq (xyzxyz+SEQ4), A-seven (xyz+7×digit), A-mirror, A-double-rev, B-segments (AAA-BBB-CCCC), B-fivefive, B-double-block, B-alternating, B-aab/aba/abb, B-abc-triple, TF-double-*

Routes:
- `GET /hunter/results` — fetch found numbers
- `POST /hunter/scan` — trigger scan for country
- `POST /hunter/purchase` — buy a number

Scheduler: 2h after startup then every 24h. AI scoring via Claude Haiku after each scan.

#### kb.py
- `GET /agents/{agent_id}/kb` — list KB documents
- `POST /agents/{agent_id}/kb` — upload file (txt/pdf/csv/md)
- `DELETE /agents/{agent_id}/kb/{doc_id}` — delete
- `POST /agents/{agent_id}/kb/url` — add from URL scraping

#### tools.py (function calling)
- `GET /agents/{agent_id}/tools` — list tools
- `POST /agents/{agent_id}/tools` — create tool
- `PATCH /agents/{agent_id}/tools/{id}` — update
- `DELETE /agents/{agent_id}/tools/{id}` — delete

Tool schema: { name, description, method (GET/POST/PATCH/DELETE), url, headers, params_schema }

#### analytics.py
- `GET /analytics/overview` — KPIs (total calls, completed, failed, avg duration, sentiment)
- `GET /analytics/calls` — call volume over time
- `GET /analytics/agents` — per-agent performance
- `GET /analytics/latency` — avg duration / turn count
- `GET /analytics/providers` — STT/LLM/TTS breakdown
- `GET /analytics/intents` — intent classification

#### webhooks.py
- CRUD: `GET/POST/PATCH/DELETE /webhooks`
- Events: call.started, call.ended, call.analyzed

#### products.py
- CRUD for agent products (kiosk showcase catalog)

#### team.py
- `GET /team` — list members
- `POST /team/invite` — invite
- `PATCH /team/{id}` — update role
- `DELETE /team/{id}` — remove

#### admin.py
- `POST /admin/auth` — admin login → JWT (HS256, 12h TTL)
- All /admin/* routes require Bearer token
- Roles: admin, superadmin
- Bootstrap: set ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD env vars

#### api_keys.py
- CRUD for tenant API keys

#### dnc.py (Do-Not-Call)
- list, add, remove, check, import DNC numbers

### Dockerfile — CRITICAL
**Hardcoded pip install list.** pyproject.toml is NOT read at build time. If you add a new Python dependency, you MUST add it to the `RUN uv pip install` line in the Dockerfile.

Current packages:
```
fastapi, uvicorn[standard], supabase, pydantic, pydantic-settings,
python-multipart, pypdf, python-dotenv, structlog, httpx,
python-jose[cryptography], bcrypt, twilio
```

---

## vani-dashboard (React 19)

### Pages
AgentsPage, AgentFormPage, AnalyticsPage, CallsPage, CallDetailPage, CampaignsPage, CampaignDetailPage, ChannelsPage, DashboardPage, DialerPage, FlowBuilderPage, IntegrationsPage, KioskPage, LoginPage, NumberHunterPage, NumbersPage, PlaygroundPage, SettingsPage, TemplatesPage, WebhooksPage

### Key Dependencies
react 19, react-router-dom 7, livekit-client, @twilio/voice-sdk

### API Client (src/api/client.js)
- BASE: https://api.vani.live
- Auth token stored in localStorage as `vani_token`, tenant as `vani_tenant`
- 401 → clears localStorage, redirects to /login
- Full CRUD for: agents, calls, campaigns, numbers, webhooks, tools, kb, analytics, team, DNC, products, API keys, dialer, number hunter, playground

### Deploy
```bash
cd vani-dashboard && npx vercel --prod
```

---

## vani-engine (LiveKit Voice Agent)

### Key Files
- `src/agent.py` — main agent logic
- `src/tools/executor.py` — tool execution during calls
- `livekit.toml` — project config
- Has its own CLAUDE.md → points to AGENTS.md

### Agent Features
- KB retrieval injected into system prompt
- Tool calling (real-time function calls during conversation)
- Multi-LLM: Claude, GPT-4o, GPT-4o-mini, Llama/Groq, Mistral, custom endpoint
- Cartesia TTS (ultra-low-latency option)
- Escalation tool: transfer_to_human fires ESCALATION event
- Latency tracking per turn
- MAX_CALL_DURATION = 900s (15 min)
- Custom LLM endpoint: OpenAI-compatible base_url override

### Tool Executor
- TOOL_TIMEOUT = 8s
- Injects `_vani: { call_id, tenant_id }` into every tool call payload
- GET/DELETE → params, POST/PATCH → JSON body
- Product tools: __show_product / __clear_product (LiveKit data channel)

### Deploy
```bash
cd vani-engine && ~/bin/lk agent deploy --url wss://vani-voice-s42m8zzi.livekit.cloud --api-key APIUN3hK4QjQcAn --api-secret wjZ58sv9eB9QpEJAoUoSVGtQCY1iLe7SMIGyxp1HRKW
```

---

## vani-orchestrator

### Key Files
- `main.py` — FastAPI app, worker pool startup
- `config.py` — settings
- `routes/` — inbound, internal, kiosk, exotel, outbound_twiml, transfer
- `services/` — business logic
- `workers/` — call processing workers
- `telephony/` — provider adapters

### Environment Variables
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `LIVEKIT_AGENT_NAME` (default: vani-agent)
- `REDIS_URL` (default: redis://localhost:6379)
- `WORKER_COUNT` (default: 2), `POST_PROCESSOR_COUNT` (default: 1), `OUTBOUND_WORKER_COUNT` (default: 1)
- `OPENAI_API_KEY` (post-processing LLM analysis)
- `ORCHESTRATOR_PUBLIC_URL` (default: https://orchestrator.vani.live)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `PORT` (default: 8001)

### Startup Tasks
- N worker() tasks (BLPOP from Redis queues)
- connecting_watchdog() (CONNECTING → FAILED after 15s timeout)
- N post_processor() tasks
- N outbound_caller() tasks
- campaign_worker()

### Redis Queues
- `vani:queue:enterprise` (priority)
- `vani:queue:standard`
- `vani:queue:outbound`
- `vani:queue:outbound:enterprise`
- `vani:postprocess_queue`

### Routes

#### inbound.py (Twilio)
- `POST /telephony/inbound` — Twilio voice webhook
- Twilio signature verification (HMAC-SHA1)
- Rate limit: 10 calls/min per number, 60s window
- Idempotency check (Twilio retries)
- Returns TwiML: hold (55s pause), busy, rate-limited

#### exotel.py (India)
- `POST /telephony/inbound/exotel` — Exotel webhook
- Returns ExoML (similar to TwiML)

#### kiosk.py
- `POST /kiosk/session` — create LiveKit room for kiosk browser
- Returns: room_name, token, livekit_url, call_id

#### internal.py (Engine → Orchestrator)
- `POST /internal/events` — engine lifecycle events
- Events: CALL_STARTED, USER_SPOKE, AI_RESPONDED, INTERRUPTION, ESCALATION, CALL_ENDED
- No auth (internal network only)

### Call State Machine
```
INCOMING → ROUTING → CONNECTING → ACTIVE → ENDING → COMPLETED
                                                   → FAILED
                                         → POST_PROCESSING → COMPLETED
```
Enforced via CallStatus enum + TRANSITIONS dict.

### Health
- `GET /health` → { ok: true, service: "vani-orchestrator", version: "2.0.0", workers: N }

---

## vani-admin

### Structure
App.jsx, api/, components/, context/, pages/

### Deploy
```bash
cd vani-admin && npx vercel --prod
```

---

## Supabase Schema

### 001_schema.sql (Core)
- **tenants**: id, name, email (UNIQUE), plan (starter|growth|enterprise), created_at
- **agents**: id (uuid), tenant_id, name, greeting, prompt, language (en|hi|multi|auto), voice, stt_provider, llm_provider, tts_provider, behavior (jsonb), active, created_at
- **agent_kb**: id, agent_id, tenant_id, filename, content, created_at
- **phone_numbers**: id, tenant_id, agent_id, number (UNIQUE), provider (twilio|exotel), sip_uri, status, created_at
- **calls**: id, tenant_id, agent_id, phone, direction (inbound|outbound), status, duration_sec, transcript, summary, sentiment (positive|neutral|negative), recording_url, livekit_room, metadata (jsonb), started_at, ended_at, created_at
- **call_memory**: id, tenant_id, phone, summary, entities (jsonb), embedding (vector 1536), created_at
- **webhooks**: id, tenant_id, url, events (text[]), secret, active, created_at
- **api_keys**: id, tenant_id, name, key_hash (UNIQUE), last_used, created_at

### 002_campaigns_tools.sql
- **campaigns**: id, tenant_id, agent_id, name, status, from_number, scheduled_at, completed_at, total_contacts, called, answered, metadata, created_at
- **campaign_contacts**: id, campaign_id, tenant_id, phone, name, metadata, status, call_id, attempted_at, created_at
- **agent_tools**: id, agent_id, tenant_id, name, description, method, url, headers, params_schema, active, created_at
- Adds: agent_kb.embedding (vector 1536), tenants.telephony_config (jsonb), tenants.max_concurrent_calls, calls.campaign_id, calls.campaign_contact_id

### 003_products.sql
- **agent_products**: id, agent_id, name, description, image_url, keywords (text[]), sort_order, active, created_at

### 003_retry_dnc.sql
- DNC + retry config tables

### 004_agent_versions_extraction.sql
- Agent version history + extraction schema

### 005_pgvector_memory_providers.sql
- pgvector RPC: match_call_memory (semantic search)
- Provider columns on calls

### 006_number_hunter.sql
- **number_hunt_results**: id, number, country, tier, label, pattern, first_seen, last_seen, status (available|purchased|gone), purchased_at, ai_score (smallint), ai_reason
- **number_scan_runs**: id, country, started_at, completed_at, total_patterns, found_count, new_count, gone_count, status (running|completed|failed), error

### 007–009
- admin_tenant_active, scan_schedules, platform_config, admin_users

### 017_team_members.sql
- Team member management

---

## Fairshift → Vani Kiosk Integration
- Tenants manage products in Fairshift dashboard
- Flow: Kiosk browser (expo.fairshift.co/kiosk) → POST /api/expo/kiosk/session (Fairshift API) → Fairshift calls Vani orchestrator POST /kiosk/session → engine reads metadata.products → Products injected into agent prompt + LiveKit data channel tools
- Fairshift env vars: VANI_ORCHESTRATOR_URL, VANI_API_KEY, VANI_DEFAULT_AGENT_ID
- Fairshift migration: 018_expo_products.sql (expo_products table + vani_agent_id on expo_settings)

---

## Number Inventory
- US: 185 memorable numbers found (v1:163 + v2:+4 + v3:+17 TF + v4:+1)
- Canada: 63 numbers found
- Gap scripts: twilio-gaps-us.js (US gaps), twilio-canada-explicit.js
- Tiers: S (3× area code), A (bookend AAAA, double-seq), B (segments, alternating)
- CA confirmed: NO xyzxyz**** numbers exist in Twilio

---

## Railway (Infrastructure)

### Services
| Service | Railway URL | Builder | Replicas | Health Check |
|---------|------------|---------|----------|-------------|
| **vani-api** | lucid-forgiveness-production-9d89.up.railway.app | Dockerfile | 1 | `/health` (30s) |
| **vani-orchestrator** | vani-platform-production.up.railway.app | Nixpacks | 2 | `/health` (30s) |
| **vani-engine** | luminous-trust-production-4480.up.railway.app | Dockerfile | 2 | `/health` (30s) |
| **Redis** | redis.railway.internal:6379 | Railway plugin | — | — |

### vani-api — railway.json
```json
{
  "build": { "builder": "DOCKERFILE" },
  "deploy": {
    "startCommand": "sh -c 'uvicorn main:app --host 0.0.0.0 --port $PORT'",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```
Dockerfile uses python:3.12-slim + uv. **Dependencies hardcoded in `RUN uv pip install`** — pyproject.toml is NOT read at build time.

### vani-orchestrator — railway.toml
- Builder: nixpacks
- Replicas: 2 (zero-downtime + HA)
- Restart: always
- Worker scaling: worker_count (5-10/replica), post_processor_count (2-3), outbound_worker_count (2-3)

### vani-engine — railway.toml
- Builder: dockerfile
- Replicas: 2 (horizontal scaling safe — stateless, Redis-backed queue)
- Restart: always
- Multi-stage Dockerfile: ghcr.io/astral-sh/uv:python3.13-bookworm-slim, gcc/g++ for native extensions
- Pre-downloads ML models at build time (`uv run src/agent.py download-files`)
- Runs as non-privileged user (UID 10001)
- Dependencies installed via `uv sync --locked` (reads uv.lock)

### Railway Env Vars by Service

**vani-api:**
SUPABASE_URL, SUPABASE_SERVICE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID, TWILIO_CALLER_ID, ANTHROPIC_API_KEY, ADMIN_SECRET, PORT=8000

**vani-orchestrator:**
SUPABASE_URL, SUPABASE_SERVICE_KEY, REDIS_URL (Railway plugin), LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, ORCHESTRATOR_PUBLIC_URL, OPENAI_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, ENVIRONMENT=production, PORT=8001

**vani-engine:**
LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, ORCHESTRATOR_URL, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, HEALTH_PORT=8080, DEEPGRAM_API_KEY (optional), SARVAM_API_KEY, CARTESIA_API_KEY, ELEVENLABS_API_KEY, GROQ_API_KEY, CUSTOM_LLM_API_KEY (all optional)

### Redis Queues
- `vani:queue:enterprise` — priority inbound/outbound
- `vani:queue:standard` — standard calls
- `vani:queue:outbound` / `vani:queue:outbound:enterprise` — outbound dialing
- `vani:postprocess_queue` — post-call analysis

---

## Git
- Repo: github.com/accessionenterprises-rgb/vani-platform
- All services push to `main` branch
- Railway auto-deploys on push to main

## Deploy Commands
```bash
# API (Railway — auto-deploys on push to main)
cd vani-api && git push origin main

# Dashboard (Vercel)
cd vani-dashboard && npx vercel --prod

# Admin (Vercel)
cd vani-admin && npx vercel --prod

# Engine (LiveKit Cloud)
cd vani-engine && ~/bin/lk agent deploy --url wss://vani-voice-s42m8zzi.livekit.cloud --api-key APIUN3hK4QjQcAn --api-secret wjZ58sv9eB9QpEJAoUoSVGtQCY1iLe7SMIGyxp1HRKW
```

---

## Critical Rules
1. **Dockerfile dependency list is manual** — pyproject.toml is NOT read at build time. Always update the `RUN uv pip install` line when adding packages.
2. **agent_id is optional** when buying phone numbers — can assign later.
3. **Phone number pricing**: $2/month per number.
4. **All domains are .live** — never write .com or .ai for Vani URLs.
5. **CORS in production** only allows *.vani.live origins.
6. **Tool timeout**: 8 seconds max during live calls.
7. **Call state transitions enforced** — see CallStatus enum in orchestrator.
8. **Internal events endpoint has NO auth** — internal network only.
9. **macOS SSL issue**: Python 3.13 + aiohttp needs `SSL_CERT_FILE=$(certifi.where())`. Multiprocessing `spawn` times out on macOS — use cloud agent for prod testing.
10. **Deepgram STT gotchas**: `utterance_end_ms` doesn't exist (use `endpointing_ms`), `session.start()` is non-blocking (block with `disconnected.wait()`).
11. **LiveKit agent joins room BEFORE user** in race condition — check `room.remoteParticipants` in Connected event.
12. **Browser autoplay** — must call `room.startAudio()` after connect.

## Build Phases
- Phase 3: Full streaming pipeline (filler, barge-in, turn manager)
- Phase 4: Dashboard (all pages) — DONE
- Phase 5: Post-processing, long-term memory, webhooks
- Phase 6: Exotel + Sarvam AI swap (India production)
