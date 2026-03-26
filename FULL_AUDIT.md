# Vani Voice AI — Full System Audit & History

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CALLER (Phone)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ PSTN call
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TWILIO (+19209209967)                        │
│  Receives call → hits voice webhook URL                         │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST to webhook
                             ▼
         ┌───────────────────┴───────────────────┐
         │                                       │
    PATH A (current)                        PATH B (broken)
         │                                       │
         ▼                                       ▼
┌─────────────────────┐              ┌──────────────────────┐
│ orchestrator.vani.live│              │  api.vani.live       │
│ /telephony/inbound   │              │  /telephony/twiml    │
│                      │              │                      │
│ Returns Media Stream │              │ Returns SIP dial:    │
│ TwiML:               │              │ <Dial><Sip>          │
│ <Connect><Stream     │              │   sip:number@        │
│   url=wss://.../>    │              │   vaani-voice.sip.   │
│ </Connect>           │              │   livekit.cloud      │
└──────────┬───────────┘              │ </Sip></Dial>        │
           │                          └──────────┬───────────┘
           │ WebSocket audio                     │ SIP
           ▼                                     ▼
┌─────────────────────┐              ┌──────────────────────┐
│ MEDIA STREAM HANDLER│              │   LIVEKIT CLOUD      │
│ (orchestrator)       │              │   SIP Trunk          │
│                      │              │   Creates room:      │
│ Python pipeline:     │              │   call_+91xxx_xxx    │
│ ┌──────────────┐     │              │                      │
│ │ Deepgram STT │◄────│── mulaw 8k  │   SIP Bridge polls → │
│ │ (WebSocket)  │     │              │   dispatches agent   │
│ └──────┬───────┘     │              └──────────┬───────────┘
│        │ text        │                         │
│        ▼             │                         ▼
│ ┌──────────────┐     │              ┌──────────────────────┐
│ │ LLM (Groq/   │     │              │  VANI ENGINE         │
│ │  OpenAI)     │     │              │  (LiveKit Cloud)     │
│ └──────┬───────┘     │              │                      │
│        │ text        │              │  LiveKit Agents SDK  │
│        ▼             │              │  ┌────────────────┐  │
│ ┌──────────────┐     │              │  │ Deepgram STT   │  │
│ │ TTS (OpenAI/ │     │              │  │ LLM (OpenAI/   │  │
│ │  ElevenLabs/ │     │              │  │   Groq/Gemini) │  │
│ │  Cartesia)   │     │              │  │ TTS (OpenAI/   │  │
│ └──────┬───────┘     │              │  │   Cartesia/EL) │  │
│        │ audio       │              │  └────────────────┘  │
│        ▼             │              │                      │
│ Resample 24k→8k     │              │  Native Opus codec   │
│ + enhance + mulaw   │              │  → SIP G.711 8kHz    │
│ → send to Twilio WS │              │                      │
└─────────────────────┘              └──────────────────────┘
```

## The Two Paths Explained

### PATH A: Media Stream (WORKING)
- Twilio webhook → `orchestrator.vani.live/telephony/inbound`
- Engine setting = "agora" (but doesn't use Agora's /join API)
- Orchestrator stores agent config in Redis
- Returns TwiML: `<Connect><Stream url="wss://orchestrator/media/stream/{call_id}"/></Connect>`
- Twilio opens WebSocket, streams raw mulaw 8kHz audio
- Orchestrator Python code handles STT→LLM→TTS
- Audio: TTS outputs 24kHz PCM → resampled to 8kHz → mulaw → back to Twilio

**Pros:**
- Works reliably
- Agent config loaded from DB every call
- Groq LLM support
- ElevenLabs/OpenAI/Cartesia/Sarvam TTS support
- Transcripts saved

**Cons:**
- Audio quality is muffled (24kHz→8kHz resampling via audioop.ratecv)
- All processing on single Railway server (no distributed compute)
- Latency: network to Groq + network to TTS + resampling overhead

### PATH B: LiveKit SIP (BROKEN)
- Twilio webhook → `api.vani.live/telephony/twiml`
- Returns TwiML: `<Dial><Sip>sip:number@vaani-voice.sip.livekit.cloud</Sip></Dial>`
- Twilio SIP client dials into LiveKit
- LiveKit creates room, SIP bridge dispatches agent
- Vani engine (on LiveKit Cloud) handles STT→LLM→TTS natively

**Why it's broken:**
- SIP bridge dispatches agent but metadata not reaching engine
- Engine falls back to default prompt ("Hi I'm Vaani")
- Even with SUPABASE keys on LiveKit Cloud, phone number lookup fails
  (sip.trunkPhoneNumber attribute not available from SIP participant)
- Twilio SIP dial sometimes fails with 0 duration
- LiveKit room creation was using `lk` CLI (not on container) — fixed to Python SDK
- Multiple deployment issues with Railway root directory

### PATH C: Agora Native /join (CODED BUT NOT TESTED)
- Orchestrator worker creates Agora agent via REST API
- Patches Twilio call to dial Agora SIP bridge
- Agora handles STT→LLM→TTS natively
- Better audio quality (Agora manages codecs)
- NOT the path that "engine=agora" currently takes (it takes media stream instead)

---

## Audio Quality: Why It's Muffled

The media stream path does this:
```
TTS generates audio at 24,000 Hz (24kHz) sample rate
  → audioop.ratecv() downsamples to 8,000 Hz (8kHz)
  → audioop.lin2ulaw() converts PCM to mulaw encoding
  → Sent to Twilio as mulaw chunks
  → Twilio plays to caller
```

`audioop.ratecv()` is a basic linear resampler from Python's standard library.
It does NOT:
- Apply anti-aliasing filter (frequencies above 4kHz alias into audible range → hissing)
- Preserve speech formants (voice characteristics get distorted)
- Handle the Nyquist frequency properly

**Result:** Speech sounds muffled, whispery, with artifacts. Like talking through a pillow.

**What Retell/competitors do differently:**
- Use professional DSP libraries (scipy, libsamplerate) for resampling
- OR request TTS at 8kHz directly (Cartesia supports native 8kHz)
- OR use speech-to-speech models (OpenAI Realtime) that output at the right sample rate
- Apply audio enhancement (EQ, compression, normalization) after resampling

**What we added:** `_enhance_for_telephone()` function:
- High-shelf boost at 2.5kHz (+3dB) for clarity
- Soft compression (threshold -12dB, ratio 3:1) for consistent volume
- Normalization to maximize signal
- This helps but doesn't fix the fundamental resampling issue

**Real fix options:**
1. Use scipy.signal.resample() or libsamplerate — much better resampling
2. Request TTS at 8kHz natively (Cartesia supports this, but credits exhausted)
3. Switch to OpenAI Realtime API (speech-to-speech, no separate TTS)
4. Fix LiveKit path — LiveKit's internal codec handling is much better

---

## Latency Breakdown

For a typical turn on the media stream path:

```
User finishes speaking
  → Deepgram endpointing detection:  ~500ms (VAD determines end of speech)
  → Deepgram STT transcription:      ~200ms (streaming, final result)
  → Network to Groq (US):            ~150ms
  → Groq LLM inference:              ~100ms (Groq's LPU is fast)
  → Network back from Groq:          ~150ms
  → Network to OpenAI/ElevenLabs TTS:~150ms
  → TTS generation:                  ~300-500ms
  → Network back from TTS:           ~150ms
  → Resampling + mulaw conversion:   ~10ms
  → Network to Twilio:               ~50ms
  ─────────────────────────────────────────
  TOTAL:                              ~1.8-2.5 seconds
```

**Biggest bottlenecks:**
1. Deepgram endpointing (500ms) — waiting to confirm user stopped talking
2. TTS generation (300-500ms) — generating speech audio
3. Network round trips (600ms+) — India to US and back, multiple hops

**With gpt-4o-mini it was 3-5s because:**
- OpenAI LLM inference: ~800-1500ms (vs Groq's ~100ms)
- Total: 2.5-4.5 seconds

**Groq brought it down to ~1.5-2s** — confirmed in logs (user_said → agent_said = ~1s)

---

## Complete Timeline of Attempts & Fixes

### Hour 1-2: Building the Flutter App
- Built vani_app (Flutter) with all screens
- Login, home dashboard, calls, KB, settings, onboarding, dialer, playground
- Installed on Android device
- UI was basic — user wanted premium redesign
- Redesigned multiple times (dark → light → minimal)

### Hour 3-4: Exotel Discussion
- Analyzed Exotel commercial proposals (AgentStream + SIP)
- AgentStream: 20p/min inbound, WebSocket audio, 16kHz support
- SIP: Unlimited channels, ₹11,799-58,409
- Key issue: landline numbers only (spam perception in India)
- Workaround: Mumbai company registration for mobile DIDs
- Legal risk of holding numbers for tenants

### Hour 5-6: Audio Quality & Prompting
- Analyzed Retell's interface for comparison
- Identified voice quality gap: LiveKit SIP → G.711 8kHz bottleneck
- Built audio preprocessing (low-pass filter, compression, normalization)
- Deployed to LiveKit engine — CRASHED on session teardown
- Disabled audio preprocessing

### Hour 7-8: Prompt Engineering
- Analyzed real call transcripts — found issues:
  - Re-greeting on "hello"
  - Corporate jargon ("various industries", "streamline")
  - Too-long responses
  - Not giving real pricing
- Rewrote Mira's prompt multiple times
- Added voice rules as system prompt prefix
- Rules too aggressive → agent went silent
- Stripped back to minimal rules
- Fillers changed: "Sure, one moment" → "um", "mhm"
- Filler delay: 100ms → 250ms → 500ms → 800ms → 9999ms (disabled)

### Hour 9: LLM Switching Disasters
- Tried switching to Gemini 2.0 Flash → Google API quota exhausted (429)
- Tried Gemini 3.1 Flash Lite Preview → LiveKit plugin doesn't support preview names
- Tried GPT-5-mini → max_tokens vs max_completion_tokens issue on Agora
- Confirmed GPT-4o-mini works on LiveKit
- Added Groq support (API key from user)
- Groq key added to Railway + LiveKit Cloud
- Groq Llama 3.3 70B: 830ms from India via API test
- But LiveKit engine calls kept crashing...

### Hour 10-11: The 403 Disaster
- Discovered ALL calls returning 403 Forbidden
- Root cause: Twilio signature validation in orchestrator
- Code said "log but allow through" but deployed code was returning 403
- Railway deploys kept failing: "Could not find root directory: vani-orchestrator"
- Fixed: deploy from parent Vani/ dir with .railwayignore
- Multiple deploy attempts, old replicas persisting
- Finally disabled signature check entirely

### Hour 12: LiveKit SIP Path Broken
- Switched Twilio webhook to api.vani.live/telephony/twiml (original SIP path)
- SIP dial fails: Duration 0s on every call
- LiveKit room creation failing: [Errno 2] No such file or directory
- Root cause: livekit_manager.py used `lk` CLI binary (not in container)
- Fixed: switched to Python SDK (lk_api.LiveKitAPI)
- Room creation now works but Twilio redirect to SIP still fails
- Created livekit_twiml.py endpoint for TwiML redirect
- Wrong SIP host: tried 1h5xw3nwkcn.sip.livekit.cloud (from old notes)
- Correct SIP host: vaani-voice-s42m8zzi.sip.livekit.cloud (from git history)
- But SIP dial still fails silently — Twilio returns Duration 0s

### Hour 13: Agent Config Not Loading
- SIP bridge dispatches agent successfully (logs confirm)
- But engine uses default prompt ("Hi I'm Vaani")
- Root cause: dispatch metadata not reaching engine
- SIP bridge wasn't passing agent config as metadata
- Fixed: added _lookup_agent_config() to SIP bridge
- But called_number empty (sip.trunkPhoneNumber not available)
- Added fallback: try all known phone numbers
- But `if called_number:` skipped the lookup when empty
- Fixed: always run lookup
- But has_metadata still False — deploy not going live (Railway root dir issue again)

### Hour 14: ORCHESTRATOR_URL Changed
- Discovered ORCHESTRATOR_URL on LiveKit Cloud was changed by other session
- User fixed it back to https://orchestrator.vani.live
- But engine still defaults — SUPABASE_URL/SUPABASE_SERVICE_KEY never set on LiveKit Cloud
- User added them
- Engine fallback lookup still fails (called_number empty, no fallback in engine)
- Added fallback in engine: try all known phone numbers via Supabase
- Deployed engine — but SIP path still broken (separate issue)

### Hour 15: Back to Media Stream (What Works)
- Realized: every working call with transcript was on media stream path
- LiveKit SIP has NEVER produced a working conversation in this session
- Switched back to orchestrator.vani.live/telephony/inbound (media stream)
- Calls work! Greeting plays, Deepgram transcribes, LLM responds

### Hour 16: Fixing Media Stream Issues
- Cartesia TTS: 402 Payment Required (credits exhausted)
- Switched to OpenAI TTS Nova
- Voice sounded male → `nova` not in _VALID_OAI_VOICES → fell back to `alloy` (male)
- Fixed: added nova, fable, onyx to valid voices list
- Disabled fillers: empty list crashed `random.choice([])` → Deepgram receive loop died
- Fixed: guard with `if _FILLER_TEXTS else None`
- Then `play_text(None)` crashed → removed entire filler block
- Switched LLM to Groq → response time dropped from 3s to 1s
- Added Groq routing to media stream LLM handler
- Added ElevenLabs TTS support to media stream
- Added audio enhancement (_enhance_for_telephone) to all TTS providers
- Updated dashboard with all 21 ElevenLabs voices
- Switched Mira to ElevenLabs Sarah

---

## Current State (Mar 26 2026, 12:30 IST)

### What Works
- Media stream path: Twilio → orchestrator → WebSocket → STT/LLM/TTS → caller
- Groq Llama 3.3 70B LLM (~1s response)
- Deepgram Nova-3 STT
- OpenAI/ElevenLabs TTS
- Agent config loaded from Supabase per call
- Transcripts saved to calls table
- Dashboard: QA testing, latency reports, all voices

### What's Broken
- **Audio quality**: muffled/whispery (8kHz mulaw resampling)
- **LiveKit SIP path**: completely broken (SIP dial fails, metadata not reaching engine)
- **Cartesia TTS**: 402 credits exhausted
- **Google Gemini**: 429 quota exhausted
- **Fillers**: disabled (caused crashes)
- **Call data**: duration, providers, latency not saved for media stream calls
- **Playground**: not linked to agent config

### API Keys Status
| Key | Status |
|-----|--------|
| OpenAI | ✅ Working |
| Deepgram | ✅ Working |
| Groq | ✅ Working (Railway + LiveKit Cloud) |
| ElevenLabs | ✅ Working (free tier, 10K credits) |
| Cartesia | ❌ 402 Payment Required |
| Google/Gemini | ❌ 429 Quota Exhausted |
| Sarvam | ✅ Key set, untested |

---

## Root Cause Analysis

### Why is the audio muffled?
`audioop.ratecv()` is a primitive resampler. Professional voice AI platforms use:
- scipy.signal.resample_poly() — proper anti-aliasing
- OR native 8kHz TTS output (Cartesia supports this)
- OR speech-to-speech models (no TTS resampling needed)

### Why does LiveKit SIP fail?
Unknown. SIP trunk exists, dispatch rules exist, billing is fine. The SIP dial from Twilio returns Duration: 0s with no error. Could be:
- SIP trunk configuration changed by other session
- Authentication issue between Twilio and LiveKit SIP
- Network/firewall issue on LiveKit's SIP gateway

### Why did the 403 happen?
The other session's Agora build changed the Twilio webhook from `api.vani.live/telephony/twiml` to `orchestrator.vani.live/telephony/inbound`. The orchestrator's signature validation rejected all calls because the ORCHESTRATOR_PUBLIC_URL didn't match what Twilio used to sign the request.

### Why does the agent default to "Vaani"?
The SIP bridge dispatch doesn't pass metadata reliably. The engine's fallback (Supabase lookup by phone number) fails because:
1. `sip.trunkPhoneNumber` attribute is empty at dispatch time
2. SUPABASE keys weren't on LiveKit Cloud (now added)
3. Engine fallback only tries the called number, not all known numbers (now fixed)

### Why do Railway deploys fail?
The Railway service has `rootDirectory: vani-orchestrator` set. When running `railway up` from inside `vani-orchestrator/`, it looks for `vani-orchestrator/vani-orchestrator/` which doesn't exist. Must deploy from parent `Vani/` directory with `.railwayignore` to exclude heavy folders.

---

## Recommended Next Steps

### Priority 1: Fix Audio Quality
- Replace `audioop.ratecv()` with `scipy.signal.resample_poly()` in media_stream.py
- OR add scipy to orchestrator dependencies and use proper anti-aliasing
- OR use Cartesia native 8kHz output (needs credit top-up: $5)
- Test each option before deploying

### Priority 2: Fix LiveKit SIP Path
- Debug why Twilio SIP dial returns Duration: 0s
- Check LiveKit SIP trunk auth settings
- Test with a simple SIP client (not Twilio) to isolate
- If fixed, this path gives better audio quality (LiveKit handles codecs)

### Priority 3: Reduce Latency
- Deepgram endpointing: 500ms → try 300ms
- Stream LLM response to TTS (don't wait for full response)
- Consider OpenAI Realtime API for speech-to-speech (eliminates STT+TTS)
- Consider Groq streaming mode

### Priority 4: Production Hardening
- Save all call metadata (duration, providers, latency)
- Watcher agents for call monitoring
- Auto-fallback between engines
- Proper deploy pipeline (no manual railway up)
