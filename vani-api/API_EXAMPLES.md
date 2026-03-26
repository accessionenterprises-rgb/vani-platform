# Vani API — Quick Start

Base URL: `https://api.vani.live/v1`

Authenticate with: `Authorization: Bearer vani_YOUR_API_KEY`

---

## 1. Create an Agent

```bash
curl -X POST https://api.vani.live/v1/agents \
  -H "Authorization: Bearer vani_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Agent",
    "greeting": "Hi, thanks for calling! How can I help?",
    "prompt": "You are a helpful sales assistant for a popcorn machine company.",
    "language": "en",
    "llm_provider": "llama-3.3-70b",
    "stt_provider": "deepgram-nova-3",
    "tts_provider": "openai",
    "voice": "nova"
  }'
```

**Node.js:**
```javascript
const res = await fetch("https://api.vani.live/v1/agents", {
  method: "POST",
  headers: {
    "Authorization": "Bearer vani_YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    name: "Sales Agent",
    greeting: "Hi, thanks for calling! How can I help?",
    prompt: "You are a helpful sales assistant.",
    llm_provider: "llama-3.3-70b",
    tts_provider: "openai",
    voice: "nova"
  })
});
const agent = await res.json();
console.log(agent.id);
```

**Python:**
```python
import httpx

r = httpx.post("https://api.vani.live/v1/agents",
    headers={"Authorization": "Bearer vani_YOUR_API_KEY"},
    json={
        "name": "Sales Agent",
        "greeting": "Hi, thanks for calling!",
        "prompt": "You are a helpful sales assistant.",
        "llm_provider": "llama-3.3-70b",
        "tts_provider": "openai",
        "voice": "nova",
    })
agent = r.json()
print(agent["id"])
```

---

## 2. Make an Outbound Call

```bash
curl -X POST https://api.vani.live/v1/calls/outbound \
  -H "Authorization: Bearer vani_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+919876543210",
    "agent_id": "YOUR_AGENT_ID"
  }'
```

**Node.js:**
```javascript
const res = await fetch("https://api.vani.live/v1/calls/outbound", {
  method: "POST",
  headers: {
    "Authorization": "Bearer vani_YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    to: "+919876543210",
    agent_id: "YOUR_AGENT_ID"
  })
});
const call = await res.json();
console.log(call.call_id);
```

**Python:**
```python
r = httpx.post("https://api.vani.live/v1/calls/outbound",
    headers={"Authorization": "Bearer vani_YOUR_API_KEY"},
    json={"to": "+919876543210", "agent_id": "YOUR_AGENT_ID"})
print(r.json()["call_id"])
```

---

## 3. Get Call History

```bash
curl https://api.vani.live/v1/calls \
  -H "Authorization: Bearer vani_YOUR_API_KEY"
```

**Node.js:**
```javascript
const res = await fetch("https://api.vani.live/v1/calls", {
  headers: { "Authorization": "Bearer vani_YOUR_API_KEY" }
});
const calls = await res.json();
calls.forEach(c => console.log(c.id, c.status, c.duration_sec));
```

**Python:**
```python
r = httpx.get("https://api.vani.live/v1/calls",
    headers={"Authorization": "Bearer vani_YOUR_API_KEY"})
for call in r.json():
    print(call["id"], call["status"], call.get("transcript", "")[:100])
```

---

## 4. Upload Knowledge Base Document

```bash
curl -X POST https://api.vani.live/v1/agents/YOUR_AGENT_ID/kb \
  -H "Authorization: Bearer vani_YOUR_API_KEY" \
  -F "file=@product-catalog.pdf"
```

**Node.js:**
```javascript
const form = new FormData();
form.append("file", fs.createReadStream("product-catalog.pdf"));

const res = await fetch("https://api.vani.live/v1/agents/YOUR_AGENT_ID/kb", {
  method: "POST",
  headers: { "Authorization": "Bearer vani_YOUR_API_KEY" },
  body: form
});
console.log(await res.json());
```

**Python:**
```python
with open("product-catalog.pdf", "rb") as f:
    r = httpx.post(f"https://api.vani.live/v1/agents/YOUR_AGENT_ID/kb",
        headers={"Authorization": "Bearer vani_YOUR_API_KEY"},
        files={"file": f})
print(r.json())
```

---

## 5. List Phone Numbers

```bash
curl https://api.vani.live/v1/numbers \
  -H "Authorization: Bearer vani_YOUR_API_KEY"
```

---

## Error Format

All errors return:
```json
{
  "error": "unauthorized",
  "message": "Invalid API key",
  "status": 401
}
```

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Default | 60 req/min |
| Outbound calls | 10 req/min |
| TTS preview | 20 req/min |
| Campaigns | 10 req/min |

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

## Available TTS Providers

| Provider | Voice | Cost |
|----------|-------|------|
| `openai` | nova, alloy, echo, shimmer... | ₹0.70/min |
| `sarvam` | manisha, anushka, vidya, arya... | ₹0.83/min |
| `sarvam-v3` | shreya, amelia, sophia, priya... | ₹1.65/min |
| `cartesia` | Brooke (UUID) | ₹3.00/min |
| `elevenlabs` | Sarah (UUID) | ₹4.07/min |

## Available LLM Providers

| Provider | Model | Cost |
|----------|-------|------|
| `llama-3.3-70b` | Groq Llama 3.3 | ₹0.09/min |
| `gpt-4o-mini` | OpenAI | ₹0.70/min |
| `gpt-4.1-mini` | OpenAI | ₹0.70/min |
| `gemini-2.0-flash` | Google | ₹0.50/min |
