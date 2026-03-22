-- 008: Platform-level config (admin sets provider keys etc.)
CREATE TABLE IF NOT EXISTS platform_config (
  key   text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed with empty defaults for voice provider keys
INSERT INTO platform_config (key, value) VALUES
  ('deepgram_api_key',   ''),
  ('openai_api_key',     ''),
  ('sarvam_api_key',     ''),
  ('elevenlabs_api_key', ''),
  ('livekit_url',        ''),
  ('livekit_api_key',    ''),
  ('livekit_api_secret', ''),
  ('default_stt',        'deepgram-nova-3'),
  ('default_llm',        'gpt-4o-mini'),
  ('default_tts',        'openai-nova'),
  ('default_language',   'en'),
  ('max_call_duration',  '900'),
  ('max_concurrent_calls', '50')
ON CONFLICT (key) DO NOTHING;
