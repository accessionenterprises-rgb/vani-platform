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
  const [started, setStarted] = useState(false)
  const [options, setOptions] = useState([])
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
    const history = [...messages]
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    setStarted(true)
    setOptions([])

    try {
      const res = await api.builderChat(text.trim(), history)
      setMessages(m => [...m, { role: 'assistant', content: res.reply }])
      setOptions(res.options || [])
      if (res.agent_config) {
        setAgentConfig(res.agent_config)
        setOptions([])
      }
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
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
      navigate(`/agents/${agent.id}`)
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: `Failed to create agent: ${err.message}` }])
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#1a1d2e] shrink-0 bg-[#080a12]">
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate('/agents')}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Agents
          </button>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-xs font-medium text-indigo-300">AI Agent Builder</span>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">

          {/* Initial state — template picker */}
          {!started && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">What kind of agent do<br/>you want to build?</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  I'll guide you through a quick conversation — one question at a time — then generate a production-ready voice agent you can deploy instantly.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => handleTemplate(t)}
                    className="flex items-start gap-3 p-4 rounded-xl border border-[#1f2235] bg-[#0d0f18] hover:border-indigo-500/30 hover:bg-indigo-500/5 text-left transition-all group">
                    <span className="text-2xl mt-0.5">{t.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-200 group-hover:text-white">{t.title}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">{t.desc}</p>
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
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-500 text-white rounded-br-md'
                      : 'bg-[#12141f] border border-[#1f2235] text-slate-300 rounded-bl-md'
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
                          <svg className="w-3 h-3 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Builder</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#12141f] border border-[#1f2235] rounded-2xl rounded-bl-md px-5 py-4">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-400/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-indigo-400/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-indigo-400/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Quick-reply option buttons */}
              {!loading && options.length > 0 && !agentConfig && (
                <div className="flex flex-wrap gap-2 pl-2 pt-1">
                  {options.map((opt, i) => (
                    <button key={i} onClick={() => handleOption(opt)}
                      className="px-4 py-2.5 text-sm font-medium text-indigo-300 bg-indigo-500/8 border border-indigo-500/25 rounded-xl hover:bg-indigo-500/15 hover:border-indigo-500/40 transition-all">
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
                      <p className="text-sm font-semibold text-emerald-300">Agent Ready</p>
                      <p className="text-xs text-slate-500 mt-0.5">Review and deploy your new voice agent</p>
                    </div>
                  </div>

                  <div className="bg-[#080a12] rounded-xl p-4 space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Name</span>
                      <span className="text-white font-medium">{agentConfig.name}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Tone</span>
                      <span className="text-slate-300 capitalize">{agentConfig.behavior?.tone || 'friendly'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Objective</span>
                      <span className="text-slate-300 capitalize">{agentConfig.behavior?.objective || 'support'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Language</span>
                      <span className="text-slate-300">{agentConfig.language === 'hi' ? 'Hindi' : agentConfig.language === 'multi' ? 'Multilingual' : 'English'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">LLM</span>
                      <span className="text-slate-300">{agentConfig.llm_provider || 'gpt-4o-mini'}</span>
                    </div>
                    <div className="border-t border-[#1f2235] pt-2.5 mt-1">
                      <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Greeting</p>
                      <p className="text-xs text-slate-400 italic">"{agentConfig.greeting}"</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleDeploy}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                      </svg>
                      Deploy Agent
                    </button>
                    <button onClick={() => { setAgentConfig(null); send('I want to change something.') }}
                      className="px-4 py-2.5 text-sm text-slate-400 hover:text-white bg-white/5 border border-[#2a2d3a] rounded-xl transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              )}

              {creating && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-indigo-300">
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
        <div className="border-t border-[#1a1d2e] bg-[#080a12] px-6 py-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder={options.length > 0 ? 'Pick an option above or type your own...' : 'Type your answer...'}
              disabled={loading || creating}
              className="flex-1 bg-[#12141f] border border-[#2a2d3a] focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors disabled:opacity-50"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading || creating}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl transition-colors shrink-0">
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
