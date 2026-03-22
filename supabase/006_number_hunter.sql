-- Number Hunter — tracks memorable Twilio phone numbers across NANP countries
-- Watcher scans daily; admin views available numbers and purchases with one click
-- Safe to re-run (IF NOT EXISTS throughout)

-- ── Found memorable numbers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS number_hunt_results (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  number       text        NOT NULL,
  country      text        NOT NULL,  -- 'US', 'CA', 'PR', 'VI', etc.
  tier         text        NOT NULL,  -- 'S-ten', 'A-double-seq', 'A-seven', etc.
  label        text        NOT NULL,  -- human label e.g. '518x2-1234'
  pattern      text        NOT NULL,  -- raw pattern used in Twilio search
  first_seen   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz NOT NULL DEFAULT now(),
  status       text        NOT NULL DEFAULT 'available',  -- available | purchased | gone
  purchased_at timestamptz,
  CONSTRAINT number_hunt_results_num_country_uq UNIQUE (number, country),
  CONSTRAINT number_hunt_results_status_chk
    CHECK (status IN ('available', 'purchased', 'gone'))
);

CREATE INDEX IF NOT EXISTS nhr_status_idx    ON number_hunt_results(status);
CREATE INDEX IF NOT EXISTS nhr_country_idx   ON number_hunt_results(country);
CREATE INDEX IF NOT EXISTS nhr_tier_idx      ON number_hunt_results(tier);
CREATE INDEX IF NOT EXISTS nhr_last_seen_idx ON number_hunt_results(last_seen DESC);

-- ── Scan run history ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS number_scan_runs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  country      text        NOT NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  total_patterns integer   DEFAULT 0,
  found_count  integer     DEFAULT 0,
  new_count    integer     DEFAULT 0,
  gone_count   integer     DEFAULT 0,
  status       text        NOT NULL DEFAULT 'running',  -- running | completed | failed
  error        text,
  CONSTRAINT number_scan_runs_status_chk
    CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS nsr_country_idx    ON number_scan_runs(country);
CREATE INDEX IF NOT EXISTS nsr_started_at_idx ON number_scan_runs(started_at DESC);
