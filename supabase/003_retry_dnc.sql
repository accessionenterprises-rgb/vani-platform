-- ============================================================
-- Migration 003 — Retry logic, DNC, AMD voicemail tracking
-- ============================================================

-- ── Campaign-level retry + scheduling config ─────────────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS max_attempts      integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS retry_delay_min   integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS call_window_start time,
  ADD COLUMN IF NOT EXISTS call_window_end   time,
  ADD COLUMN IF NOT EXISTS timezone          text DEFAULT 'Asia/Kolkata';

-- ── Per-contact retry tracking ───────────────────────────────
ALTER TABLE campaign_contacts
  ADD COLUMN IF NOT EXISTS attempts       integer     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at  timestamptz,
  ADD COLUMN IF NOT EXISTS last_outcome   text;
-- Note: contact status now supports: pending | calling | completed | failed | retry | dnc | voicemail | skipped
-- (no enum — status is text, no migration needed for values)

-- ── DNC (Do-Not-Call) numbers ────────────────────────────────
CREATE TABLE IF NOT EXISTS dnc_numbers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  text        NOT NULL,
  phone      text        NOT NULL,
  reason     text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_dnc_tenant_phone ON dnc_numbers(tenant_id, phone);

-- ── RLS (if enabled) ─────────────────────────────────────────
-- ALTER TABLE dnc_numbers ENABLE ROW LEVEL SECURITY;
