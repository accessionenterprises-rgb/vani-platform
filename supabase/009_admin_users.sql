-- Admin users table for vani-admin panel (multi-user support)
CREATE TABLE IF NOT EXISTS admin_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name        text,
  role        text NOT NULL DEFAULT 'admin',  -- 'admin' | 'superadmin'
  active      boolean NOT NULL DEFAULT true,
  last_login  timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users(email);
