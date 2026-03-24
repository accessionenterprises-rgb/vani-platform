-- Provider latency metrics — stores per-call latency data by provider
-- Used to show real measured latency in the dashboard AI Stack page

CREATE TABLE IF NOT EXISTS provider_latency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  stt_provider text,
  llm_provider text,
  tts_provider text,
  avg_ms int,
  p50_ms int,
  p95_ms int,
  min_ms int,
  max_ms int,
  samples int DEFAULT 0,
  duration_sec int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_latency_tenant_idx ON provider_latency(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS provider_latency_providers_idx ON provider_latency(stt_provider, llm_provider, tts_provider);
