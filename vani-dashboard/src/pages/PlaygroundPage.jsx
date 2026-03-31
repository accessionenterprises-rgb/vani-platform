import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

/**
 * Agent Testing Playground
 *
 * Tab 1: Text Chat  — browser-based, no phone needed
 * Tab 2: Phone Test — triggers a real outbound call + live transcript
 */

// ── Cost tables (verified rates, ₹/min) ──────────────────────────────────────
const STT_COSTS = { 'deepgram-nova-3': 0.57, 'deepgram-nova-2': 0.32, 'sarvam-saaras': 0.46, 'openai-whisper': 0.23, 'google': 0.61, 'azure': 0.64 }
const LLM_COSTS = {
  'groq': 0.10, 'gpt-4o-mini': 0.48, 'gpt-5-mini': 0.76, 'gemini-2.0-flash': 0.29,
  'gpt-5-nano': 0.07, 'gpt-5': 1.76, 'gpt-4o': 2.56,
  'gemini-2.5-flash': 0.16, 'gemini-2.0-flash-lite': 0.08,
  'claude-haiku-4-5-20251001': 0.93, 'claude-sonnet-4-20250514': 3.51,
  'llama-3.3-70b': 0.51, 'deepseek-chat': 0.29, 'mistral-large': 2.00,
  'gpt-4.1-nano': 0.10, 'gpt-4.1-mini': 0.43, 'gpt-4.1': 2.05,
}
const TTS_COSTS = { 'openai': 0.76, 'sarvam': 0.95, 'sarvam-v3': 1.90, 'cartesia': 3.42, 'elevenlabs': 4.56, 'gemini-live': 2.19, 'google-wavenet': 1.37 }
const ENGINE_COST = 1.00  // base engine
const TELEPHONY_COSTS = { 'twilio': 1.23, 'vobiz': 0.62, 'exotel': 0.23 }

function isGeminiLive(agent) {
  return agent?.tts_provider === 'gemini-live'
}

function getAgentCosts(agent) {
  if (!agent) return null
  const gemini = isGeminiLive(agent)
  const ai = gemini
    ? 2.19
    : (STT_COSTS[agent.stt_provider] || 0.57) + (LLM_COSTS[agent.llm_provider] || 0.29) + (TTS_COSTS[agent.tts_provider] || 0.76)
  const engine = ENGINE_COST
  const tel = TELEPHONY_COSTS[agent.telephony_provider] || null
  return { ai, engine, tel, total: ai + engine + (tel || 0), gemini }
}

export default function PlaygroundPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState('chat')
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')

  useEffect(() => {
    api.listAgents().then(list => {
      const active = list.filter(a => a.active)
      setAgents(active)
      const preselect = searchParams.get('agent')
      if (preselect && active.find(a => a.id === preselect)) {
        setSelectedAgent(preselect)
      } else if (active.length > 0) {
        setSelectedAgent(active[0].id)
      }
    }).catch(console.error)
  }, [searchParams])

  const agent = agents.find(a => a.id === selectedAgent)
  const costs = getAgentCosts(agent)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 ">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#fafafa]">Testing Playground</h1>
          <p className="text-base text-[#71717a] mt-0.5">Test agents before going live</p>
        </div>

        {/* Agent selector + stack display */}
        <div className="bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)] p-4 mb-5 space-y-3">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-[#a1a1aa] shrink-0">Agent</label>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="bg-[#09090b] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-base text-[#fafafa] focus:outline-none focus:border-[#2563EB] min-w-[220px]">
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {agent && (
            <div className="flex items-center gap-3 flex-wrap">
              {isGeminiLive(agent) ? (
                /* Gemini Live badge */
                <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-violet-50 border border-[rgba(139,92,246,0.20)] rounded-lg px-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-[rgba(139,92,246,0.08)]0 animate-pulse" />
                  <span className="text-[13px] font-semibold text-blue-700">Gemini Live</span>
                  <span className="text-[11px] text-blue-500/80 font-medium">Speech-to-speech</span>
                  {agent.voice && (
                    <span className="text-[11px] text-[#a1a1aa] bg-[#0f0f11]/60 rounded px-1.5 py-0.5">
                      Voice: {agent.voice}
                    </span>
                  )}
                  <span className="text-[11px] text-[#a1a1aa] bg-[#0f0f11]/60 rounded px-1.5 py-0.5">
                    AI: ₹2.19/min
                  </span>
                </div>
              ) : (
                /* Regular STT + LLM + TTS read-only display */
                <>
                  <StackBadge label="STT" value={agent.stt_provider} cost={STT_COSTS[agent.stt_provider]} />
                  <StackBadge label="LLM" value={agent.llm_provider} cost={LLM_COSTS[agent.llm_provider]} />
                  <StackBadge label="TTS" value={agent.tts_provider} cost={TTS_COSTS[agent.tts_provider]} />
                </>
              )}

              {/* Cost estimator */}
              {costs && (
                <div className="ml-auto text-right">
                  <span className="text-[10px] text-[#71717a]">Est. total cost</span>
                  <p className="text-base font-bold text-[#fafafa]">₹{costs.total.toFixed(1)}/min</p>
                  <div className="text-[9px] text-[#71717a] font-mono mt-0.5 space-y-px">
                    <p>AI: ₹{costs.ai.toFixed(2)} | Engine: ₹{costs.engine.toFixed(2)} | Tel: {costs.tel != null ? `₹${costs.tel.toFixed(2)}` : 'varies'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[#09090b] rounded-lg p-1 w-fit border border-[rgba(255,255,255,0.06)]">
          {[['voice', 'Voice Call'], ['chat', 'Text Chat'], ['phone', 'Phone Test'], ['sim', 'Simulation']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-md text-base font-medium transition-colors ${
                tab === key ? 'bg-[#2563EB] text-white' : 'text-[#a1a1aa] hover:text-[#e4e4e7]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'voice' && <VoiceCallTab selectedAgent={selectedAgent} agent={agent} />}
        {tab === 'chat' && <TextChatTab selectedAgent={selectedAgent} agent={agent} />}
        {tab === 'phone' && <PhoneTestTab selectedAgent={selectedAgent} />}
        {tab === 'sim' && <SimulationTab selectedAgent={selectedAgent} agent={agent} />}
      </div>
    </div>
  )
}


// ── Stack Badge (read-only display) ──────────────────────────────────────────

function StackBadge({ label, value, cost }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider">{label}</span>
      <div className="bg-[#09090b] border border-[rgba(255,255,255,0.06)] rounded-md px-2 py-1 text-[13px] text-[#fafafa]">
        {value || '—'}
        {cost != null && <span className="text-[#71717a] ml-1">(₹{cost.toFixed(2)}/min)</span>}
      </div>
    </div>
  )
}


// ── Voice Call Tab (WebRTC) ───────────────────────────────────────────────────

function VoiceCallTab({ selectedAgent, agent }) {
  const [status, setStatus] = useState('idle') // idle | connecting | connected | ended
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')
  const roomRef = useRef(null)
  const timerRef = useRef(null)
  const audioRef = useRef(null)

  const startCall = async () => {
    if (!selectedAgent) return
    setStatus('connecting')
    setError('')

    try {
      const data = await api.startVoiceTest(selectedAgent)

      const { Room, RoomEvent, Track } = await import('livekit-client')
      const room = new Room()
      roomRef.current = room

      // Handle remote audio (agent's voice)
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach()
          el.id = 'agent-audio'
          document.body.appendChild(el)
          audioRef.current = el
        }
      })

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach(el => el.remove())
      })

      room.on(RoomEvent.Disconnected, () => {
        setStatus('ended')
        if (timerRef.current) clearInterval(timerRef.current)
      })

      room.on(RoomEvent.ParticipantConnected, () => {
        setStatus('connected')
        const start = Date.now()
        timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - start) / 1000)), 1000)
      })

      await room.connect(data.livekit_url, data.token)

      // Publish microphone
      await room.localParticipant.setMicrophoneEnabled(true)

      // If agent already in room
      if (room.remoteParticipants.size > 0) {
        setStatus('connected')
        const start = Date.now()
        timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - start) / 1000)), 1000)
      }

    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  const endCall = () => {
    if (roomRef.current) {
      roomRef.current.disconnect()
      roomRef.current = null
    }
    if (timerRef.current) clearInterval(timerRef.current)
    if (audioRef.current) {
      audioRef.current.remove()
      audioRef.current = null
    }
    setStatus('ended')
    setDuration(0)
  }

  useEffect(() => {
    return () => {
      if (roomRef.current) roomRef.current.disconnect()
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioRef.current) audioRef.current.remove()
    }
  }, [])

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const gemini = isGeminiLive(agent)

  return (
    <div className="bg-[#0f0f11] rounded-2xl border border-[rgba(255,255,255,0.06)] p-8 flex flex-col items-center justify-center min-h-[400px] gap-6">
      {/* Waveform visualization */}
      <div className="w-32 h-32 rounded-full border-2 border-[rgba(255,255,255,0.06)] flex items-center justify-center relative">
        {status === 'connected' && (
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping" />
        )}
        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
          status === 'connected' ? 'bg-[#2563EB]/15' :
          status === 'connecting' ? 'bg-amber-500/15' :
          'bg-[#09090b]'
        }`}>
          {status === 'idle' || status === 'ended' ? (
            <svg className="w-10 h-10 text-[#71717a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          ) : status === 'connecting' ? (
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-1 bg-indigo-400 rounded-full animate-pulse"
                  style={{ height: `${12 + Math.random() * 20}px`, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status text */}
      <div className="text-center">
        <p className="text-xl font-semibold text-[#fafafa]">
          {status === 'idle' && 'Ready to test'}
          {status === 'connecting' && 'Connecting...'}
          {status === 'connected' && fmtTime(duration)}
          {status === 'ended' && 'Call ended'}
        </p>
        <p className="text-sm text-[#71717a] mt-1">
          {status === 'idle' && (agent?.name || 'Select an agent')}
          {status === 'connecting' && 'Setting up voice channel...'}
          {status === 'connected' && `Speaking with ${agent?.name || 'Agent'}${gemini ? ' (Gemini Live)' : ''}`}
          {status === 'ended' && `Duration: ${fmtTime(duration)}`}
        </p>
        {gemini && status !== 'connected' && (
          <p className="text-xs text-blue-500 mt-1 font-medium">Gemini Live — speech-to-speech</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {(status === 'idle' || status === 'ended') && (
          <button onClick={startCall} disabled={!selectedAgent}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-medium px-6 py-3 rounded-full text-base transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
            </svg>
            Start Voice Test
          </button>
        )}
        {(status === 'connecting' || status === 'connected') && (
          <button onClick={endCall}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-3 rounded-full text-base transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
            </svg>
            End Call
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{error}</p>
      )}

      <p className="text-[12px] text-[#71717a] max-w-xs text-center">
        Uses your browser microphone + WebRTC. No phone call needed. Zero telephony cost.
      </p>
    </div>
  )
}


// ── Text Chat Tab ─────────────────────────────────────────────────────────────

function TextChatTab({ selectedAgent, agent }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    setMessages([])
    setSessionId(null)
    setError('')
  }, [selectedAgent])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || !selectedAgent || loading) return

    const userMsg = input.trim()
    setInput('')
    setMessages(m => [...m, { role: 'user', content: userMsg }])
    setLoading(true)
    setError('')

    try {
      const res = await api.playgroundChat({
        agent_id: selectedAgent,
        message: userMsg,
        session_id: sessionId,
      })
      setSessionId(res.session_id)
      setMessages(res.messages)
    } catch (err) {
      setError(err.message)
      setMessages(m => m.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  async function clearChat() {
    if (sessionId) api.playgroundClearSession(sessionId).catch(() => {})
    setMessages([])
    setSessionId(null)
    setError('')
  }

  return (
    <div className="bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)] flex flex-col" style={{ minHeight: 520 }}>
      <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-[#fafafa]">Text Chat</h2>
          <p className="text-sm text-[#71717a] mt-0.5">No phone required — tests the LLM directly</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-sm text-[#71717a] hover:text-[#e4e4e7] transition-colors">Clear</button>
        )}
      </div>

      <div className="flex-1 p-5 space-y-3 overflow-y-auto" style={{ maxHeight: 420 }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2563EB]/10 flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#2563EB] fill-current">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <p className="text-base text-[#71717a]">
              {selectedAgent ? 'Type a message to start chatting with the agent' : 'Select an agent to begin'}
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'assistant' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 ${
                msg.role === 'user' ? 'bg-[#E8E5E2] text-[#e4e4e7]' : 'bg-[#2563EB]/20 text-[#2563EB]'
              }`}>
                {msg.role === 'user' ? 'U' : 'A'}
              </div>
              <div className={`flex-1 ${msg.role === 'assistant' ? 'text-right' : ''}`}>
                <p className={`text-base rounded-xl px-3.5 py-2.5 inline-block max-w-sm ${
                  msg.role === 'user' ? 'bg-[#1c1c1f] text-[#e4e4e7]' : 'bg-[#2563EB]/15 text-[#60A5FA]'
                }`}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-3 flex-row-reverse">
            <div className="w-6 h-6 rounded-full bg-[#2563EB]/20 flex items-center justify-center text-sm shrink-0">A</div>
            <div className="bg-[#2563EB]/15 rounded-xl px-3.5 py-2.5">
              <span className="flex gap-1">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-5 pb-2">
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        </div>
      )}

      <form onSubmit={sendMessage} className="px-5 py-4 border-t border-[rgba(255,255,255,0.06)] flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={selectedAgent ? 'Type a message…' : 'Select an agent first'}
          disabled={!selectedAgent || loading}
          className="flex-1 bg-[#09090b] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2.5 text-base text-[#fafafa] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB] disabled:opacity-50"
        />
        <button type="submit" disabled={!selectedAgent || !input.trim() || loading}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-base font-medium transition-colors">
          Send
        </button>
      </form>
    </div>
  )
}


// ── Phone Test Tab ────────────────────────────────────────────────────────────

function PhoneTestTab({ selectedAgent }) {
  const [testPhone, setTestPhone] = useState('')
  const [callId, setCallId] = useState(null)
  const [callStatus, setCallStatus] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef(null)

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current) } }, [])

  async function startTest(e) {
    e.preventDefault()
    if (!selectedAgent || !testPhone) { setError('Select an agent and enter a phone number'); return }
    setError('')
    setRunning(true)
    setTranscript([])
    setCallId(null)
    setCallStatus('starting')

    try {
      const result = await api.triggerOutbound({ agent_id: selectedAgent, to: testPhone })
      setCallId(result.call_id)
      setCallStatus('queued')

      pollRef.current = setInterval(async () => {
        try {
          const call = await api.getCall(result.call_id)
          setCallStatus(call.status)
          if (call.transcript) setTranscript(call.transcript.split('\n').filter(Boolean))
          if (['completed', 'failed', 'cancelled'].includes(call.status)) {
            clearInterval(pollRef.current)
            setRunning(false)
          }
        } catch (err) { console.error(err) }
      }, 3000)
    } catch (err) {
      setError(err.message)
      setRunning(false)
      setCallStatus(null)
    }
  }

  async function stopTest() {
    if (!callId) return
    try {
      await api.stopCall(callId)
      setCallStatus('cancelled')
      if (pollRef.current) clearInterval(pollRef.current)
      setRunning(false)
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="grid grid-cols-5 gap-5">
      <div className="col-span-2">
        <div className="bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)] p-5">
          <h2 className="text-base font-semibold text-[#fafafa] mb-4">Test Configuration</h2>
          <form onSubmit={startTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Your Phone Number</label>
              <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+91XXXXXXXXXX"
                className="w-full bg-[#09090b] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2.5 text-base text-[#fafafa] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]" />
              <p className="text-sm text-[#71717a] mt-1">Agent will call this number via Twilio/Exotel.</p>
            </div>
            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={running || !selectedAgent || !testPhone}
                className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-base transition-colors">
                {running ? 'Calling…' : 'Start Test Call'}
              </button>
              {running && (
                <button type="button" onClick={stopTest}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium px-4 py-2.5 rounded-lg text-base transition-colors">
                  Stop
                </button>
              )}
            </div>
          </form>
        </div>
        {callStatus && (
          <div className="mt-4 bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)] p-4">
            <div className="flex items-center gap-2.5">
              <StatusDot status={callStatus} />
              <div>
                <p className="text-base font-medium text-[#fafafa] capitalize">{callStatus}</p>
                {callId && <p className="text-sm text-[#71717a] font-mono mt-0.5">{callId.slice(0, 12)}…</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="col-span-3 bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)] flex flex-col">
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <h2 className="text-base font-medium text-[#fafafa]">Live Transcript</h2>
          {running && <span className="flex items-center gap-1.5 text-sm text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live</span>}
        </div>
        <div className="flex-1 p-5 space-y-3 min-h-[400px] max-h-[520px] overflow-y-auto">
          {transcript.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-base text-[#71717a]">{running ? 'Waiting for conversation…' : 'Start a test call to see the transcript'}</p>
            </div>
          ) : (
            transcript.map((line, i) => {
              const isUser = line.includes('] User:')
              const isAgent = line.includes('] Agent:')
              const text = line.replace(/^\[\d+:\d+:\d+\] (User|Agent): /, '')
              const time = line.match(/\[(\d+:\d+:\d+)\]/)?.[1]
              return (
                <div key={i} className={`flex gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 ${isUser ? 'bg-[#E8E5E2] text-[#e4e4e7]' : 'bg-[#2563EB]/20 text-[#2563EB]'}`}>
                    {isUser ? 'U' : 'A'}
                  </div>
                  <div className={`flex-1 ${isAgent ? 'text-right' : ''}`}>
                    <p className={`text-base rounded-xl px-3.5 py-2.5 inline-block max-w-xs ${isUser ? 'bg-[#1c1c1f] text-[#e4e4e7]' : 'bg-[#2563EB]/15 text-[#60A5FA]'}`}>{text}</p>
                    {time && <p className="text-sm text-[rgba(255,255,255,0.15)] mt-1 px-1">{time}</p>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }) {
  const map = { queued: 'bg-slate-500', routing: 'bg-[rgba(139,92,246,0.08)]0 animate-pulse', connecting: 'bg-amber-500 animate-pulse', active: 'bg-emerald-500 animate-pulse', ending: 'bg-orange-500', completed: 'bg-emerald-500', failed: 'bg-red-500', cancelled: 'bg-slate-600' }
  return <div className={`w-2.5 h-2.5 rounded-full ${map[status] || 'bg-slate-500'}`} />
}


// ── Simulation Testing Tab ─────────────────────────────────────────────────────

const DEFAULT_SCENARIOS = [
  { id: 'greeting',    label: 'Greeting Flow',         messages: ['Hi there', 'What can you help me with?'] },
  { id: 'booking',     label: 'Booking Intent',         messages: ['I want to book an appointment', 'How about tomorrow at 3pm?'] },
  { id: 'complaint',   label: 'Complaint Handling',     messages: ['I have a serious issue', 'This has been going on for a week and nobody helped me'] },
  { id: 'escalation',  label: 'Escalation Trigger',     messages: ['I need to speak to a human', 'Please transfer me to someone real'] },
  { id: 'off_topic',   label: 'Off-topic Deflection',   messages: ['What is the weather today?', 'Tell me a joke'] },
  { id: 'goodbye',     label: 'Call Goodbye',           messages: ['Thanks, that\'s all I needed', 'Goodbye'] },
]

function SimulationTab({ selectedAgent, agent }) {
  const [results, setResults]   = useState({})
  const [running, setRunning]   = useState(false)
  const [runAll, setRunAll]     = useState(false)
  const [custom, setCustom]     = useState('')
  const [customScenarios, setCustomScenarios] = useState([])

  async function runScenario(scenario) {
    setResults(r => ({ ...r, [scenario.id]: { status: 'running', responses: [] } }))
    const responses = []
    let sessionId = null
    try {
      for (const msg of scenario.messages) {
        const res = await api.playgroundChat({ agent_id: selectedAgent, message: msg, session_id: sessionId })
        sessionId = res.session_id
        const last = res.messages[res.messages.length - 1]
        responses.push({ user: msg, agent: last?.content || '—' })
      }
      // Clear session
      if (sessionId) api.playgroundClearSession(sessionId).catch(() => {})
      setResults(r => ({ ...r, [scenario.id]: { status: 'done', responses } }))
    } catch (err) {
      setResults(r => ({ ...r, [scenario.id]: { status: 'error', error: err.message, responses } }))
    }
  }

  async function runAllScenarios() {
    if (!selectedAgent) return
    setRunAll(true)
    setResults({})
    const all = [...DEFAULT_SCENARIOS, ...customScenarios]
    for (const s of all) {
      await runScenario(s)
    }
    setRunAll(false)
  }

  function addCustomScenario() {
    if (!custom.trim()) return
    const msgs = custom.split('|').map(m => m.trim()).filter(Boolean)
    if (msgs.length === 0) return
    const id = `custom_${Date.now()}`
    setCustomScenarios(cs => [...cs, { id, label: msgs[0].slice(0, 30), messages: msgs }])
    setCustom('')
  }

  const allScenarios = [...DEFAULT_SCENARIOS, ...customScenarios]

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#fafafa]">Automated Simulation</h2>
            <p className="text-sm text-[#71717a] mt-0.5">Run pre-built conversation scenarios through your agent and inspect responses.</p>
          </div>
          <button onClick={runAllScenarios} disabled={!selectedAgent || runAll}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            {runAll ? (
              <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Running…</>
            ) : (
              <><span>▶</span> Run All Scenarios</>
            )}
          </button>
        </div>

        {/* Custom scenario input */}
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomScenario()}
            placeholder="Add custom scenario: message1 | message2 | message3"
            className="flex-1 bg-[#09090b] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#fafafa] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]"
          />
          <button onClick={addCustomScenario}
            className="text-sm text-[#2563EB] hover:text-[#8b5cf6] bg-[#2563EB]/10 border border-indigo-500/20 px-3 py-2 rounded-lg transition-colors">
            Add
          </button>
        </div>
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-2 gap-3">
        {allScenarios.map(scenario => {
          const result = results[scenario.id]
          return (
            <div key={scenario.id} className={`bg-[#0f0f11] rounded-xl border p-4 transition-colors ${
              result?.status === 'done' ? 'border-emerald-500/30' :
              result?.status === 'error' ? 'border-red-500/30' :
              result?.status === 'running' ? 'border-indigo-500/40' :
              'border-[rgba(255,255,255,0.06)]'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    result?.status === 'done' ? 'bg-emerald-500' :
                    result?.status === 'error' ? 'bg-red-500' :
                    result?.status === 'running' ? 'bg-[#2563EB] animate-pulse' :
                    'bg-slate-600'
                  }`} />
                  <p className="text-sm font-medium text-[#e4e4e7]">{scenario.label}</p>
                </div>
                <button
                  onClick={() => runScenario(scenario)}
                  disabled={!selectedAgent || result?.status === 'running'}
                  className="text-sm text-[#71717a] hover:text-[#e4e4e7] disabled:opacity-40 transition-colors">
                  {result?.status === 'running' ? '…' : '▶'}
                </button>
              </div>

              {!result && (
                <div className="flex flex-wrap gap-1">
                  {scenario.messages.map((m, i) => (
                    <span key={i} className="text-[10px] text-[#71717a] bg-[#09090b] px-1.5 py-0.5 rounded">
                      "{m.slice(0, 25)}{m.length > 25 ? '…' : ''}"
                    </span>
                  ))}
                </div>
              )}

              {result?.status === 'error' && (
                <p className="text-sm text-red-400">{result.error}</p>
              )}

              {result?.responses?.length > 0 && (
                <div className="space-y-2 mt-1">
                  {result.responses.map((r, i) => (
                    <div key={i} className="text-[13px] space-y-0.5">
                      <p className="text-[#71717a]">U: <span className="text-[#a1a1aa]">{r.user}</span></p>
                      <p className="text-[#2563EB]/80">A: <span className="text-[#8b5cf6]">{r.agent?.slice(0, 80)}{r.agent?.length > 80 ? '…' : ''}</span></p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!selectedAgent && (
        <p className="text-center text-base text-[#71717a] py-4">Select an agent above to run simulations.</p>
      )}
    </div>
  )
}
