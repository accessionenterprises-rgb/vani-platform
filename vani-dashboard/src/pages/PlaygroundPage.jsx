import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

/**
 * Agent Testing Playground
 *
 * Tab 1: Text Chat  — browser-based, no phone needed
 * Tab 2: Phone Test — triggers a real outbound call + live transcript
 */
export default function PlaygroundPage() {
  const [tab, setTab] = useState('chat')
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')

  useEffect(() => {
    api.listAgents().then(list => {
      const active = list.filter(a => a.active)
      setAgents(active)
      if (active.length > 0) setSelectedAgent(active[0].id)
    }).catch(console.error)
  }, [])

  const agent = agents.find(a => a.id === selectedAgent)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Testing Playground</h1>
          <p className="text-sm text-slate-500 mt-0.5">Test agents before going live</p>
        </div>

        {/* Agent selector */}
        <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-4 mb-5 flex items-center gap-4">
          <label className="text-xs font-medium text-slate-400 shrink-0">Agent</label>
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            className="bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 min-w-[220px]">
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {agent && (
            <div className="flex gap-3 ml-2">
              {[['STT', agent.stt_provider], ['LLM', agent.llm_provider], ['TTS', agent.tts_provider]].map(([k, v]) => (
                <span key={k} className="text-xs text-slate-500">
                  <span className="text-slate-600">{k}:</span> {v}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[#0d0f18] rounded-lg p-1 w-fit border border-[#1f2235]">
          {[['chat', 'Text Chat'], ['phone', 'Phone Test'], ['sim', 'Simulation']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === key ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'chat' && <TextChatTab selectedAgent={selectedAgent} agent={agent} />}
        {tab === 'phone' && <PhoneTestTab selectedAgent={selectedAgent} />}
        {tab === 'sim' && <SimulationTab selectedAgent={selectedAgent} agent={agent} />}
      </div>
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
    <div className="bg-[#12141f] rounded-xl border border-[#1f2235] flex flex-col" style={{ minHeight: 520 }}>
      <div className="px-5 py-4 border-b border-[#1f2235] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-white">Text Chat</h2>
          <p className="text-xs text-slate-500 mt-0.5">No phone required — tests the LLM directly</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
        )}
      </div>

      <div className="flex-1 p-5 space-y-3 overflow-y-auto" style={{ maxHeight: 420 }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-indigo-400 fill-current">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <p className="text-sm text-slate-500">
              {selectedAgent ? 'Type a message to start chatting with the agent' : 'Select an agent to begin'}
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'assistant' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                msg.role === 'user' ? 'bg-slate-700 text-slate-300' : 'bg-indigo-500/20 text-indigo-400'
              }`}>
                {msg.role === 'user' ? 'U' : 'A'}
              </div>
              <div className={`flex-1 ${msg.role === 'assistant' ? 'text-right' : ''}`}>
                <p className={`text-sm rounded-xl px-3.5 py-2.5 inline-block max-w-sm ${
                  msg.role === 'user' ? 'bg-[#1a1d2e] text-slate-200' : 'bg-indigo-500/15 text-indigo-200'
                }`}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-3 flex-row-reverse">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs shrink-0">A</div>
            <div className="bg-indigo-500/15 rounded-xl px-3.5 py-2.5">
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
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        </div>
      )}

      <form onSubmit={sendMessage} className="px-5 py-4 border-t border-[#1f2235] flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={selectedAgent ? 'Type a message…' : 'Select an agent first'}
          disabled={!selectedAgent || loading}
          className="flex-1 bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <button type="submit" disabled={!selectedAgent || !input.trim() || loading}
          className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
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
        <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Test Configuration</h2>
          <form onSubmit={startTest} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Your Phone Number</label>
              <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+91XXXXXXXXXX"
                className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
              <p className="text-xs text-slate-600 mt-1">Agent will call this number via Twilio/Exotel.</p>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={running || !selectedAgent || !testPhone}
                className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                {running ? 'Calling…' : 'Start Test Call'}
              </button>
              {running && (
                <button type="button" onClick={stopTest}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium px-4 py-2.5 rounded-lg text-sm transition-colors">
                  Stop
                </button>
              )}
            </div>
          </form>
        </div>
        {callStatus && (
          <div className="mt-4 bg-[#12141f] rounded-xl border border-[#1f2235] p-4">
            <div className="flex items-center gap-2.5">
              <StatusDot status={callStatus} />
              <div>
                <p className="text-sm font-medium text-white capitalize">{callStatus}</p>
                {callId && <p className="text-xs text-slate-600 font-mono mt-0.5">{callId.slice(0, 12)}…</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="col-span-3 bg-[#12141f] rounded-xl border border-[#1f2235] flex flex-col">
        <div className="px-5 py-4 border-b border-[#1f2235] flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Live Transcript</h2>
          {running && <span className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live</span>}
        </div>
        <div className="flex-1 p-5 space-y-3 min-h-[400px] max-h-[520px] overflow-y-auto">
          {transcript.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-slate-500">{running ? 'Waiting for conversation…' : 'Start a test call to see the transcript'}</p>
            </div>
          ) : (
            transcript.map((line, i) => {
              const isUser = line.includes('] User:')
              const isAgent = line.includes('] Agent:')
              const text = line.replace(/^\[\d+:\d+:\d+\] (User|Agent): /, '')
              const time = line.match(/\[(\d+:\d+:\d+)\]/)?.[1]
              return (
                <div key={i} className={`flex gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${isUser ? 'bg-slate-700 text-slate-300' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {isUser ? 'U' : 'A'}
                  </div>
                  <div className={`flex-1 ${isAgent ? 'text-right' : ''}`}>
                    <p className={`text-sm rounded-xl px-3.5 py-2.5 inline-block max-w-xs ${isUser ? 'bg-[#1a1d2e] text-slate-200' : 'bg-indigo-500/15 text-indigo-200'}`}>{text}</p>
                    {time && <p className="text-xs text-slate-700 mt-1 px-1">{time}</p>}
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
  const map = { queued: 'bg-slate-500', routing: 'bg-blue-500 animate-pulse', connecting: 'bg-amber-500 animate-pulse', active: 'bg-emerald-500 animate-pulse', ending: 'bg-orange-500', completed: 'bg-emerald-500', failed: 'bg-red-500', cancelled: 'bg-slate-600' }
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
      <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Automated Simulation</h2>
            <p className="text-xs text-slate-500 mt-0.5">Run pre-built conversation scenarios through your agent and inspect responses.</p>
          </div>
          <button onClick={runAllScenarios} disabled={!selectedAgent || runAll}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
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
            className="flex-1 bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
          <button onClick={addCustomScenario}
            className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-lg transition-colors">
            Add
          </button>
        </div>
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-2 gap-3">
        {allScenarios.map(scenario => {
          const result = results[scenario.id]
          return (
            <div key={scenario.id} className={`bg-[#12141f] rounded-xl border p-4 transition-colors ${
              result?.status === 'done' ? 'border-emerald-500/30' :
              result?.status === 'error' ? 'border-red-500/30' :
              result?.status === 'running' ? 'border-indigo-500/40' :
              'border-[#1f2235]'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    result?.status === 'done' ? 'bg-emerald-500' :
                    result?.status === 'error' ? 'bg-red-500' :
                    result?.status === 'running' ? 'bg-indigo-500 animate-pulse' :
                    'bg-slate-600'
                  }`} />
                  <p className="text-xs font-medium text-slate-200">{scenario.label}</p>
                </div>
                <button
                  onClick={() => runScenario(scenario)}
                  disabled={!selectedAgent || result?.status === 'running'}
                  className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40 transition-colors">
                  {result?.status === 'running' ? '…' : '▶'}
                </button>
              </div>

              {!result && (
                <div className="flex flex-wrap gap-1">
                  {scenario.messages.map((m, i) => (
                    <span key={i} className="text-[10px] text-slate-600 bg-white/[0.03] px-1.5 py-0.5 rounded">
                      "{m.slice(0, 25)}{m.length > 25 ? '…' : ''}"
                    </span>
                  ))}
                </div>
              )}

              {result?.status === 'error' && (
                <p className="text-xs text-red-400">{result.error}</p>
              )}

              {result?.responses?.length > 0 && (
                <div className="space-y-2 mt-1">
                  {result.responses.map((r, i) => (
                    <div key={i} className="text-[11px] space-y-0.5">
                      <p className="text-slate-500">U: <span className="text-slate-400">{r.user}</span></p>
                      <p className="text-indigo-400/80">A: <span className="text-indigo-300">{r.agent?.slice(0, 80)}{r.agent?.length > 80 ? '…' : ''}</span></p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!selectedAgent && (
        <p className="text-center text-sm text-slate-500 py-4">Select an agent above to run simulations.</p>
      )}
    </div>
  )
}
