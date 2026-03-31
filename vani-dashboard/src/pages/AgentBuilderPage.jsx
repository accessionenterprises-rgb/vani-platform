import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const TEMPLATES = [
  { id: 'restaurant', icon: '🍽️', title: 'Restaurant & Food',        desc: 'Reservations, menu & takeout' },
  { id: 'clinic',     icon: '🏥', title: 'Healthcare & Clinics',     desc: 'Appointments & patient FAQs' },
  { id: 'realestate', icon: '🏘️', title: 'Real Estate',              desc: 'Lead qualification & viewings' },
  { id: 'ecommerce',  icon: '🛍️', title: 'E-commerce & Retail',      desc: 'Orders, returns & support' },
  { id: 'hotel',      icon: '🏨', title: 'Hotels & Hospitality',     desc: 'Check-in, concierge & bookings' },
  { id: 'custom',     icon: '⚡',  title: 'Something Else',           desc: 'Describe your own use case' },
]

export default function AgentBuilderPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentConfig, setAgentConfig] = useState(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(null)   // holds newly created agent
  const [started, setStarted] = useState(false)
  const [options, setOptions] = useState([])
  const [scanning, setScanning] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (started && options.length === 0) inputRef.current?.focus()
  }, [started, options, loading])

  async function send(text) {
    if (!text.trim() || loading) return
    const userMsg = { role: 'user', content: text.trim() }
    // Use raw content for assistant messages so LLM sees its own OPTIONS markers
    const history = messages.map(m => ({ role: m.role, content: m.raw || m.content }))
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    setStarted(true)
    setOptions([])
    // Detect if message contains a URL
    const hasUrl = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|co|in|io|org|net|live|ai)\b/.test(text.trim())
    setScanning(hasUrl)

    try {
      const res = await api.builderChat(text.trim(), history)
      // Save raw reply (with OPTIONS markers) for LLM history, display clean version
      setMessages(m => [...m, { role: 'assistant', content: res.reply, raw: res.reply_raw || res.reply }])
      setOptions(res.options || [])
      if (res.agent_config) {
        setAgentConfig(res.agent_config)
        setOptions([])
      }
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
      setScanning(false)
    }
  }

  function handleTemplate(t) {
    send(t.title)
  }

  function handleOption(opt) {
    send(opt)
  }

  async function handleDeploy() {
    if (!agentConfig || creating) return
    setCreating(true)
    try {
      const payload = {
        name: agentConfig.name,
        greeting: agentConfig.greeting,
        prompt: agentConfig.prompt,
        language: agentConfig.language || 'en',
        voice: agentConfig.tts_provider || 'openai-nova',
        agent_type: 'voice',
        stack: {
          stt: agentConfig.stt_provider || 'deepgram-nova-3',
          llm: agentConfig.llm_provider || 'gpt-4o-mini',
          tts: agentConfig.tts_provider || 'openai-nova',
        },
        behavior: agentConfig.behavior || { tone: 'friendly', objective: 'support', fallback: 'Let me connect you with our team.', constraints: [] },
      }
      const agent = await api.createAgent(payload)
      setCreated(agent)
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: `Failed to create agent: ${err.message}` }])
    } finally {
      setCreating(false)
    }
  }

  // ── Post-creation screen ──
  if (created) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[rgba(255,255,255,0.06)] shrink-0 bg-[#09090b]">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate('/agents')}
              className="text-[#71717a] hover:text-[#e4e4e7] text-base transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to Agents
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full text-center space-y-6 px-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#fafafa] mb-2">Your agent is ready!</h2>
              <p className="text-base text-[#a1a1aa]">
                <span className="font-semibold text-[#e4e4e7]">{created.name}</span> has been created. Now get a phone number so it can receive calls.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/numbers')}
                className="flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-3 rounded-xl text-base transition-colors shadow-sm shadow-blue-200">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 7.36 7.36l1.91-1.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Get a Number
              </button>
              <div className="flex gap-3">
                <button onClick={() => navigate(`/agents/${created.id}`)}
                  className="flex-1 text-base font-medium text-[#2563EB] bg-[#EFF4FF] hover:bg-[#DBEAFE] py-2.5 rounded-xl transition-colors">
                  Configure Agent
                </button>
                <button onClick={() => navigate('/playground')}
                  className="flex-1 text-base font-medium text-[#a1a1aa] bg-[#1c1c1f] hover:bg-[#E8E5E2] py-2.5 rounded-xl border border-[rgba(255,255,255,0.06)] transition-colors">
                  Test in Playground
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[rgba(255,255,255,0.06)] shrink-0 bg-[#09090b]">
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate('/agents')}
            className="text-[#71717a] hover:text-[#e4e4e7] text-base transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Agents
          </button>
        </div>
        <div className="flex items-center gap-1.5 bg-[#2563EB]/10 border border-indigo-500/20 rounded-lg px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-sm font-medium text-[#8b5cf6]">AI Agent Builder</span>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">

          {/* Initial state — template picker */}
          {!started && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/15 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-[#2563EB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-[#fafafa] mb-2">What kind of agent do<br/>you want to build?</h2>
                <p className="text-base text-[#71717a] max-w-md mx-auto">
                  I'll guide you through a quick conversation — one question at a time — then generate a production-ready voice agent you can deploy instantly.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => handleTemplate(t)}
                    className="flex items-start gap-3 p-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#09090b] hover:border-indigo-500/30 hover:bg-[#2563EB]/5 text-left transition-all group">
                    <span className="text-3xl mt-0.5">{t.icon}</span>
                    <div>
                      <p className="text-base font-medium text-[#e4e4e7] group-hover:text-[#fafafa]">{t.title}</p>
                      <p className="text-[13px] text-[#71717a] mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {started && (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-base leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#2563EB] text-white rounded-br-md'
                      : 'bg-[#0f0f11] border border-[rgba(255,255,255,0.06)] text-[#e4e4e7] rounded-bl-md'
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-[#2563EB]/20 flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#2563EB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-semibold text-[#2563EB] uppercase tracking-wider">Builder</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {/* Typing / scanning indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#0f0f11] border border-[rgba(255,255,255,0.06)] rounded-2xl rounded-bl-md px-5 py-4">
                    {scanning ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-[#8b5cf6]">Scanning your website...</span>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-indigo-400/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-indigo-400/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-indigo-400/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick-reply option buttons */}
              {!loading && options.length > 0 && !agentConfig && (
                <div className="flex flex-wrap gap-2 pl-2 pt-1">
                  {options.map((opt, i) => (
                    <button key={i} onClick={() => handleOption(opt)}
                      className="px-4 py-2.5 text-base font-medium text-[#8b5cf6] bg-[#2563EB]/8 border border-indigo-500/25 rounded-xl hover:bg-[#2563EB]/15 hover:border-indigo-500/40 transition-all">
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Deploy card */}
              {agentConfig && !creating && (
                <div className="bg-emerald-500/8 border border-emerald-500/25 rounded-2xl p-5 space-y-4 mt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-emerald-300">Agent Ready</p>
                      <p className="text-sm text-[#71717a] mt-0.5">Review and deploy your new voice agent</p>
                    </div>
                  </div>

                  <div className="bg-[#09090b] rounded-xl p-4 space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#71717a]">Name</span>
                      <span className="text-[#fafafa] font-medium">{agentConfig.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#71717a]">Tone</span>
                      <span className="text-[#e4e4e7] capitalize">{agentConfig.behavior?.tone || 'friendly'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#71717a]">Objective</span>
                      <span className="text-[#e4e4e7] capitalize">{agentConfig.behavior?.objective || 'support'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#71717a]">Language</span>
                      <span className="text-[#e4e4e7]">{agentConfig.language === 'hi' ? 'Hindi' : agentConfig.language === 'multi' ? 'Multilingual' : 'English'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#71717a]">LLM</span>
                      <span className="text-[#e4e4e7]">{agentConfig.llm_provider || 'gpt-4o-mini'}</span>
                    </div>
                    <div className="border-t border-[rgba(255,255,255,0.06)] pt-2.5 mt-1">
                      <p className="text-[12px] text-[#71717a] uppercase tracking-wider mb-1">Greeting</p>
                      <p className="text-sm text-[#a1a1aa] italic">"{agentConfig.greeting}"</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleDeploy}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 rounded-xl text-base transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                      </svg>
                      Deploy Agent
                    </button>
                    <button onClick={() => { setAgentConfig(null); send('I want to change something.') }}
                      className="px-4 py-2.5 text-base text-[#a1a1aa] hover:text-[#fafafa] bg-[#1c1c1f] border border-[rgba(255,255,255,0.06)] rounded-xl transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              )}

              {creating && (
                <div className="flex items-center justify-center gap-2 py-6 text-base text-[#8b5cf6]">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  Creating your agent...
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      {started && (
        <div className="border-t border-[rgba(255,255,255,0.06)] bg-[#09090b] px-6 py-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder={options.length > 0 ? 'Pick an option above or type your own...' : 'Type your answer...'}
              disabled={loading || creating}
              className="flex-1 bg-[#0f0f11] border border-[rgba(255,255,255,0.06)] focus:border-[#2563EB] rounded-xl px-4 py-3 text-base text-[#fafafa] placeholder-[#A8A29E] focus:outline-none transition-colors disabled:opacity-50"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading || creating}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl transition-colors shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
