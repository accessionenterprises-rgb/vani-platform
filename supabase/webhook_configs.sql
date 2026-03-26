-- Webhook configuration — one row per tenant
CREATE TABLE IF NOT EXISTS webhook_configs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   text NOT NULL,
    url         text NOT NULL,
    secret      text NOT NULL,
    events      text[] NOT NULL DEFAULT ARRAY[
        'call.started',
        'call.completed',
        'call.failed',
        'transcript.ready'
    ],
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz,

    CONSTRAINT webhook_configs_tenant_unique UNIQUE (tenant_id)
);

-- Index for fast lookup by tenant
CREATE INDEX IF NOT EXISTS idx_webhook_configs_tenant
    ON webhook_configs (tenant_id);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_webhook_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_webhook_configs_updated_at ON webhook_configs;
CREATE TRIGGER trg_webhook_configs_updated_at
    BEFORE UPDATE ON webhook_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_configs_updated_at();

-- RLS
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
