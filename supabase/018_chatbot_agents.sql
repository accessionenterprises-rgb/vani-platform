-- 018: Chatbot agent support
-- Adds agent_type column and widget_config for chat widget agents

ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_type text NOT NULL DEFAULT 'voice'
  CHECK (agent_type IN ('voice', 'chatbot'));

ALTER TABLE agents ADD COLUMN IF NOT EXISTS widget_config jsonb DEFAULT '{}'::jsonb;

-- Widget keys for public chat endpoints (one per agent)
CREATE TABLE IF NOT EXISTS widget_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  widget_key text NOT NULL UNIQUE,
  allowed_origins text[] DEFAULT '{}',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_id)
);

CREATE INDEX IF NOT EXISTS widget_keys_key_idx ON widget_keys(widget_key);

-- Chat sessions for widget (persistent, not Redis)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  messages jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_agent_idx ON chat_sessions(agent_id, visitor_id);
CREATE INDEX IF NOT EXISTS chat_sessions_updated_idx ON chat_sessions(updated_at DESC);
