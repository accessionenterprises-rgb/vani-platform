-- 020: Engine selector — multi-engine support (LiveKit + Agora)
-- Safe to re-run (IF NOT EXISTS / idempotent)

-- Add engine column to phone_numbers (per-number routing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phone_numbers' AND column_name = 'engine'
  ) THEN
    ALTER TABLE phone_numbers
      ADD COLUMN engine text NOT NULL DEFAULT 'livekit'
      CHECK (engine IN ('livekit', 'agora'));
  END IF;
END $$;

-- Add default_engine to tenants (tenant-level default)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'default_engine'
  ) THEN
    ALTER TABLE tenants
      ADD COLUMN default_engine text NOT NULL DEFAULT 'livekit'
      CHECK (default_engine IN ('livekit', 'agora'));
  END IF;
END $$;

-- Add engine column to calls (record which engine handled the call)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'engine'
  ) THEN
    ALTER TABLE calls ADD COLUMN engine text DEFAULT 'livekit';
  END IF;
END $$;

-- Add agora_channel column to calls (Agora channel name, analogous to livekit_room)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'agora_channel'
  ) THEN
    ALTER TABLE calls ADD COLUMN agora_channel text;
  END IF;
END $$;

-- Add agora_agent_id to calls (Agora's agent_id from /join response)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'agora_agent_id'
  ) THEN
    ALTER TABLE calls ADD COLUMN agora_agent_id text;
  END IF;
END $$;
