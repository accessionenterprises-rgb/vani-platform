-- Vaani — Phase 2 schema additions
-- Campaigns, agent tools, KB embeddings, concurrency limits, telephony config
-- Safe to re-run (IF NOT EXISTS + ADD COLUMN IF NOT EXISTS)

-- ─── Campaigns ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id        uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'draft',  -- draft|scheduled|running|paused|completed|cancelled
  from_number     text,
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  total_contacts  integer NOT NULL DEFAULT 0,
  called          integer NOT NULL DEFAULT 0,
  answered        integer NOT NULL DEFAULT 0,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_tenant_idx ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(status);

-- ─── Campaign Contacts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tenant_id     text NOT NULL,
  phone         text NOT NULL,
  name          text,
  metadata      jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending',  -- pending|calling|answered|failed|skipped|cancelled
  call_id       uuid REFERENCES calls(id) ON DELETE SET NULL,
  attempted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_contacts_campaign_idx ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_contacts_status_idx ON campaign_contacts(status);

-- ─── Agent Tools (real-time function calling) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_tools (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tenant_id     text NOT NULL,
  name          text NOT NULL,          -- snake_case function name shown to LLM
  description   text NOT NULL,          -- what this tool does
  method        text NOT NULL DEFAULT 'POST',
  url           text NOT NULL,
  headers       jsonb NOT NULL DEFAULT '{}',
  params_schema jsonb NOT NULL DEFAULT '{}',  -- JSON Schema for parameters
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_tools_agent_idx ON agent_tools(agent_id);

-- ─── KB: add embedding column for semantic search ─────────────────────────────
ALTER TABLE agent_kb ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS agent_kb_embedding_idx ON agent_kb
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─── Tenants: telephony config + concurrency limits ───────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telephony_config jsonb NOT NULL DEFAULT '{}';
-- { "twilio_account_sid": "...", "twilio_auth_token": "...",
--   "exotel_api_key": "...", "exotel_api_token": "...", "exotel_sid": "..." }

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_concurrent_calls integer;
-- NULL = use plan default: starter=5, growth=20, enterprise=100

-- ─── Calls: add recording_url to response (column already exists in 001) ──────
-- Column already defined in 001_schema.sql; this is a no-op reminder comment.

-- ─── Outbound queue tracking ──────────────────────────────────────────────────
-- Add campaign_id to calls so we can track which campaign a call belongs to
ALTER TABLE calls ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS campaign_contact_id uuid REFERENCES campaign_contacts(id) ON DELETE SET NULL;
