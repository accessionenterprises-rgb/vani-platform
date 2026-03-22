-- Scan schedules — configure recurring number hunter scans
-- Frequency: hourly | daily | weekly | monthly
-- Supports per-country and per-tier (pattern group) filtering
-- Safe to re-run (IF NOT EXISTS throughout)

CREATE TABLE IF NOT EXISTS number_scan_schedules (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL DEFAULT 'My Schedule',
  is_active     boolean     NOT NULL DEFAULT true,
  frequency     text        NOT NULL,         -- 'hourly' | 'daily' | 'weekly' | 'monthly'
  hour_of_day   smallint    DEFAULT 2,        -- 0-23, for daily / weekly / monthly
  day_of_week   smallint,                     -- 0=Mon…6=Sun, for weekly only
  day_of_month  smallint,                     -- 1-31, for monthly only
  countries     text[],                       -- NULL = all 15 NANP countries
  service       text        NOT NULL DEFAULT 'twilio',
  tiers         text[],                       -- NULL = all tiers
  last_run_at   timestamptz,
  next_run_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nss_frequency_chk
    CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly'))
);

CREATE INDEX IF NOT EXISTS nss_active_next_idx ON number_scan_schedules(is_active, next_run_at);
