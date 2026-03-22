-- Team members per tenant
CREATE TABLE IF NOT EXISTS team_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        text NOT NULL,
  name         text NOT NULL DEFAULT '',
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member','viewer')),
  status       text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended')),
  invite_token text,
  invited_at   timestamptz NOT NULL DEFAULT now(),
  joined_at    timestamptz,
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS team_members_tenant_idx ON team_members(tenant_id);
