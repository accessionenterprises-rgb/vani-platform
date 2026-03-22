-- 007: Add active flag to tenants (admin can disable tenants)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Index for fast filtering of active tenants
CREATE INDEX IF NOT EXISTS tenants_active_idx ON tenants(active);
