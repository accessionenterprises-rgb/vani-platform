-- Migration 005: pgvector semantic memory RPC + provider columns on calls
-- Run in Supabase SQL editor

-- ── Provider columns on calls ──────────────────────────────────────────────────
-- Enables fast GROUP BY queries for provider latency analytics.
-- Post-processor fills these after every call ends.

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS llm_provider text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stt_provider text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tts_provider text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS calls_llm_provider_idx ON calls(tenant_id, llm_provider)
  WHERE llm_provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS calls_tts_provider_idx ON calls(tenant_id, tts_provider)
  WHERE tts_provider IS NOT NULL;


-- ── pgvector: match_call_memory ────────────────────────────────────────────────
-- Semantic retrieval for long-term memory — returns top-N summaries nearest
-- to the query embedding, scoped to this tenant + phone number.
--
-- Usage:
--   SELECT * FROM match_call_memory(
--     query_embedding := '<vector>',
--     p_tenant_id     := 'tenant-id',
--     p_phone         := '+91XXXXXXXXXX',
--     match_count     := 3
--   );

CREATE OR REPLACE FUNCTION match_call_memory(
    query_embedding vector(1536),
    p_tenant_id     text,
    p_phone         text,
    match_count     int DEFAULT 3
)
RETURNS TABLE (
    id          uuid,
    summary     text,
    entities    jsonb,
    created_at  timestamptz,
    similarity  float
)
LANGUAGE sql STABLE AS $$
    SELECT
        id,
        summary,
        entities,
        created_at,
        1 - (embedding <=> query_embedding) AS similarity
    FROM call_memory
    WHERE tenant_id = p_tenant_id
      AND phone     = p_phone
      AND embedding IS NOT NULL
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;
