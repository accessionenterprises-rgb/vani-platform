-- Vani — Billing Tables
-- Run in Supabase SQL editor
-- All statements use IF NOT EXISTS — safe to re-run

-- ─── Plans ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text UNIQUE NOT NULL,         -- starter | growth | business
  price_monthly       numeric(10,2) NOT NULL DEFAULT 0,
  included_minutes    int NOT NULL DEFAULT 100,
  per_minute_overage  numeric(10,4) NOT NULL DEFAULT 0.10,
  features            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── Invoices ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start  timestamptz NOT NULL,
  period_end    timestamptz NOT NULL,
  total_amount  numeric(10,4) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'draft',      -- draft | pending | paid | failed
  line_items    jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_tenant_idx ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS invoices_period_idx ON invoices(tenant_id, period_end DESC);

-- ─── Default Plans ──────────────────────────────────────────────────────────
INSERT INTO plans (name, price_monthly, included_minutes, per_minute_overage, features)
VALUES
  ('starter',  0,    100,  0.10, '{"agents": 1, "kb_docs": 5, "support": "community"}'),
  ('growth',   49,   1000, 0.05, '{"agents": 5, "kb_docs": 50, "support": "email", "analytics": true, "campaigns": true}'),
  ('business', 199,  5000, 0.03, '{"agents": 25, "kb_docs": 500, "support": "priority", "analytics": true, "campaigns": true, "api_access": true, "custom_voices": true}')
ON CONFLICT (name) DO NOTHING;
