-- Migration 004: Agent versioning + extraction schema + custom LLM
-- Run in Supabase SQL editor

-- ── Add new columns to agents ─────────────────────────────────────────────────

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS extraction_schema  jsonb     DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS success_criteria   text      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_llm_url     text      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_llm_model   text      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalation_config  jsonb     DEFAULT '{}';

-- escalation_config shape:
--   { "enabled": bool, "transfer_number": "+91...", "trigger": "user asks for human",
--     "whisper": "Caller is asking for support. Context: {summary}" }

-- extraction_schema shape (array of field descriptors):
--   [{ "field": "customer_name", "type": "text", "description": "Name of the caller" },
--    { "field": "issue_resolved", "type": "boolean" },
--    { "field": "product_mentioned", "type": "text" }]

-- ── Agent versions table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_versions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tenant_id   text        NOT NULL,
  version_num integer     NOT NULL,
  snapshot    jsonb       NOT NULL,     -- full agent row at time of save
  note        text,                     -- optional change note
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_versions_agent_id ON agent_versions(agent_id, version_num DESC);

-- ── RPC: auto-increment version number ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION next_agent_version(p_agent_id uuid)
RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(MAX(version_num), 0) + 1
  FROM agent_versions
  WHERE agent_id = p_agent_id;
$$;
