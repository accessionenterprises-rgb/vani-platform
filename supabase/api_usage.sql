-- API usage metering table
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for billing queries (per tenant, per day)
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant_ts ON api_usage (tenant_id, timestamp DESC);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_path ON api_usage (path, timestamp DESC);

-- Auto-delete old usage data after 90 days (optional — run via pg_cron)
-- SELECT cron.schedule('cleanup_api_usage', '0 3 * * *', $$DELETE FROM api_usage WHERE timestamp < now() - interval '90 days'$$);
