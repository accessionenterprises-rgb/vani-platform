# Vani — Things To Do

## Engine Integration
- [ ] **Realtime STS mode** — When tenant selects GPT-4o Mini RT or GPT-4o Realtime, bypass STT+LLM+TTS pipeline and use OpenAI Realtime API (single WebSocket, audio-in → audio-out). STT/TTS steps should be hidden/disabled in agent builder when realtime LLM is selected.
- [ ] **Sarvam STT (Saaras v2)** — Add Sarvam STT provider in engine alongside Deepgram. Best Hindi/Hinglish accuracy at ₹0.10/min.
- [ ] **Whisper STT** — Add OpenAI Whisper as STT option in engine.
- [ ] **Gemini 3.0 Flash** — Integrate as LLM option in engine when API is available.

## Multilingual
- [ ] **Dynamic language switching** — Deepgram STT detects language per utterance → engine checks language tag → routes to appropriate TTS (Sarvam for Hindi, OpenAI for English). Agent form gets a "multilingual" toggle with language → voice mapping.
- [ ] **Per-language voice mapping** — Allow tenants to set different TTS voices per language (e.g. Hindi = Sarvam Priya, English = OpenAI Nova).

## Voice
- [ ] **Custom voice training** — Fine-tune open-source TTS model (XTTS/Fish Speech) on custom voice data. Host on GPU (RunPod/Modal). Break-even at ~15K min/month vs API pricing.
- [ ] **ElevenLabs integration** — Voice cloning + premium voice library. Add as TTS provider option.

## Telephony
- [ ] **Exotel integration** — India telephony at ₹0.80/min vs Twilio ₹2.50/min. Add adapter in orchestrator telephony/ folder alongside Twilio.
- [ ] **Plivo as fallback** — Alternative India telephony provider.

## Cost Optimization
- [ ] **Optimal India stack** — Exotel + Sarvam STT + Gemini 3.0 Flash + Sarvam TTS = ~₹1.48/min total CPM.
- [ ] **Self-hosted TTS** — At 50+ tenants, migrate to self-hosted TTS on GPU. Flat ₹3,500/mo regardless of volume.
