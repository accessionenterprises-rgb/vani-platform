-- Vaani — Full Database Schema
-- Run once in Supabase SQL editor
-- All statements use IF NOT EXISTS — safe to re-run

-- Enable pgvector for long-term memory
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Tenants ─────────────────────────────────────────────────────────────────
-- tenant_id = supabase auth user UUID
CREATE TABLE IF NOT EXISTS tenants (
  id          text PRIMARY KEY,          -- auth user UUID
  name        text NOT NULL,
  email       text UNIQUE NOT NULL,
  plan        text NOT NULL DEFAULT 'starter',  -- starter | growth | enterprise
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Agents ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           text NOT NULL,
  greeting       text NOT NULL DEFAULT 'Hello, how can I help you today?',
  prompt         text NOT NULL,
  language       text NOT NULL DEFAULT 'en',          -- en | hi | multi | auto
  voice          text NOT NULL DEFAULT 'openai-nova',
  stt_provider   text NOT NULL DEFAULT 'deepgram-nova-3',
  llm_provider   text NOT NULL DEFAULT 'gpt-4o-mini',
  tts_provider   text NOT NULL DEFAULT 'openai-nova',
  behavior       jsonb NOT NULL DEFAULT '{}',
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agents_tenant_idx ON agents(tenant_id);

-- ─── Agent Knowledge Base ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_kb (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tenant_id   text NOT NULL,
  filename    text NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_kb_agent_idx ON agent_kb(agent_id);

-- ─── Phone Numbers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_numbers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id    uuid REFERENCES agents(id) ON DELETE SET NULL,
  number      text UNIQUE NOT NULL,
  provider    text NOT NULL DEFAULT 'twilio',        -- twilio | exotel
  sip_uri     text,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_numbers_tenant_idx ON phone_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS phone_numbers_number_idx ON phone_numbers(number);

-- ─── Calls ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id        uuid REFERENCES agents(id) ON DELETE SET NULL,
  phone           text,
  direction       text NOT NULL DEFAULT 'inbound',   -- inbound | outbound
  status          text NOT NULL DEFAULT 'incoming',  -- incoming|routing|connecting|active|ending|completed|failed
  duration_sec    integer,
  transcript      text,
  summary         text,
  sentiment       text,                              -- positive|neutral|negative
  recording_url   text,
  livekit_room    text,
  metadata        jsonb NOT NULL DEFAULT '{}',
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calls_tenant_idx ON calls(tenant_id);
CREATE INDEX IF NOT EXISTS calls_agent_idx ON calls(agent_id);
CREATE INDEX IF NOT EXISTS calls_status_idx ON calls(status);
CREATE INDEX IF NOT EXISTS calls_created_idx ON calls(created_at DESC);

-- ─── Long-Term Call Memory (per phone number) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS call_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  phone       text NOT NULL,
  summary     text NOT NULL,
  entities    jsonb NOT NULL DEFAULT '{}',
  embedding   vector(1536),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_memory_phone_idx ON call_memory(tenant_id, phone);

-- ─── Webhooks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url         text NOT NULL,
  events      text[] NOT NULL DEFAULT '{}',          -- call.started, call.ended, call.analyzed
  secret      text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── API Keys ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  key_hash    text UNIQUE NOT NULL,
  last_used   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys(key_hash);
