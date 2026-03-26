import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const STATUS_FILTERS = ['all', 'active', 'completed', 'failed', 'connecting']
const PAGE_SIZE = 25

// Cost-per-minute estimates by provider (USD)
const COST_RATES = {
  stt: { deepgram: 0.0017, 'deepgram-nova-3': 0.0017, 'deepgram-nova-2': 0.0014, 'openai-whisper': 0.0024, google: 0.0064, azure: 0.0067, sarvam: 0.0048 },
  llm: { 'gpt-4o-mini': 0.0017, 'gpt-5-nano': 0.0007, 'gpt-5-mini': 0.0037, 'gemini-2.0-flash': 0.0011, 'claude-haiku': 0.0098, default: 0.003 },
  tts: { openai: 0.0083, cartesia: 0.036, elevenlabs: 0.049, sarvam: 0.01, 'google-standard': 0.0022, default: 0.01 },
  telephony: 0.013, // base per-min telephony
}

function estimateCost(durationSec, meta) {
  if (!durationSec || durationSec < 1) return null
  const mins = durationSec / 60
  const sttRate = COST_RATES.stt[meta?.stt_provider] || 0.0017
  const llmRate = COST_RATES.llm[meta?.llm_provider] || COST_RATES.llm.default
  const ttsRate = COST_RATES.tts[meta?.tts_provider] || COST_RATES.tts.default
  return {
    stt: sttRate * mins,
    llm: llmRate * mins,
    tts: ttsRate * mins,
    telephony: COST_RATES.telephony * mins,
    total: (sttRate + llmRate + ttsRate + COST_RATES.telephony) * mins,
  }
}

function fmtDuration(sec) {
  if (!sec) return '—'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

// ─── Inline Call Detail Panel ─────────────────────────────────────────────

function CallExpandedRow({ call, agentName }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const audioRef = useRef(null)
  const [audioPlaying, setAudioPlaying] = useState(false)

  useEffect(() => {
    api.getCall(call.id)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [call.id])

  if (loading) {
    return (
      <tr><td colSpan={8} className="px-5 py-8 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-[#A8A29E]">
          <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          Loading call details...
        </div>
      </td></tr>
    )
  }

  const d = detail || call
  const meta = d.metadata || {}
  const cost = meta.cost || estimateCost(d.duration_sec, meta)
  const transcriptLines = d.transcript ? d.transcript.split('\n').filter(Boolean) : []

  function toggleAudio() {
    if (!audioRef.current) return
    if (audioPlaying) { audioRef.current.pause(); setAudioPlaying(false) }
    else { audioRef.current.play(); setAudioPlaying(true) }
  }

  return (
    <tr>
      <td colSpan={8} className="px-5 py-0">
        <div className="py-4 border-t border-[#F0EDEA]">
          <div className="grid grid-cols-3 gap-5">
            {/* Left: Transcript */}
            <div className="col-span-2">
              {/* Recording player */}
              {d.recording_url && (
                <div className="mb-4 bg-[#FAFAF9] rounded-xl border border-[#E8E5E2] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-[#2563EB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                    <span className="text-sm font-medium text-[#44403C]">Recording</span>
                  </div>
                  <audio
                    ref={audioRef}
                    controls
                    src={d.recording_url}
                    className="w-full h-10"
                    style={{ colorScheme: 'light' }}
                    onPlay={() => setAudioPlaying(true)}
                    onPause={() => setAudioPlaying(false)}
                    onEnded={() => setAudioPlaying(false)}
                  />
                </div>
              )}

              {/* Transcript */}
              <div className="bg-[#FAFAF9] rounded-xl border border-[#E8E5E2] p-4">
                <h3 className="text-sm font-medium text-[#44403C] mb-3">Transcript</h3>
                {transcriptLines.length === 0 ? (
                  <p className="text-sm text-[#A8A29E] text-center py-4">No transcript available.</p>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {transcriptLines.map((line, i) => {
                      const isUser  = line.includes('] User:')
                      const isAgent = line.includes('] Agent:')
                      const text = line.replace(/^\[\d+:\d+:\d+\] (User|Agent): /, '')
                      const time = line.match(/\[(\d+:\d+:\d+)\]/)?.[1]
                      return (
                        <div key={i} className={`flex gap-2.5 ${isAgent ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5 ${
                            isUser ? 'bg-[#E8E5E2] text-[#44403C]' : 'bg-[#2563EB]/20 text-[#2563EB]'
                          }`}>
                            {isUser ? 'U' : 'A'}
                          </div>
                          <div className={`flex-1 ${isAgent ? 'text-right' : ''}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                              isUser ? 'text-[#A8A29E]' : 'text-[#2563EB]'
                            }`}>
                              {isUser ? 'USER' : 'AGENT'}
                              {time && <span className="text-[#D6D3D1] font-normal ml-1.5">{time}</span>}
                            </span>
                            <p className={`text-sm leading-relaxed mt-0.5 rounded-lg px-3 py-2 inline-block max-w-[85%] ${
                              isUser ? 'bg-white text-[#44403C] border border-[#E8E5E2]' : 'bg-[#2563EB]/10 text-[#1A1816]'
                            }`}>
                              {text}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Metadata + Cost */}
            <div className="space-y-4">
              {/* Call metadata */}
              <div className="bg-[#FAFAF9] rounded-xl border border-[#E8E5E2] p-4">
                <h3 className="text-sm font-medium text-[#44403C] mb-3">Call Metadata</h3>
                <dl className="space-y-2">
                  <MetaRow label="Duration" value={fmtDuration(d.duration_sec)} />
                  <MetaRow label="Status" value={<StatusBadge status={d.status} />} />
                  <MetaRow label="Direction" value={d.direction || 'inbound'} />
                  {meta.engine && <MetaRow label="Engine" value={meta.engine} />}
                  {meta.stt_provider && <MetaRow label="STT" value={<span className="text-[#2563EB]">{meta.stt_provider}</span>} />}
                  {meta.llm_provider && <MetaRow label="LLM" value={<span className="text-[#2563EB]">{meta.llm_provider}</span>} />}
                  {meta.tts_provider && <MetaRow label="TTS" value={<span className="text-[#2563EB]">{meta.tts_provider}</span>} />}
                  {meta.intent && <MetaRow label="Intent" value={<span className="capitalize">{meta.intent}</span>} />}
                  {d.sentiment && <MetaRow label="Sentiment" value={
                    <span className={d.sentiment === 'positive' ? 'text-emerald-500' : d.sentiment === 'negative' ? 'text-red-400' : 'text-[#78716C]'}>
                      {d.sentiment}
                    </span>
                  } />}
                </dl>
              </div>

              {/* Cost estimate */}
              {cost && (
                <div className="bg-[#FAFAF9] rounded-xl border border-[#E8E5E2] p-4">
                  <h3 className="text-sm font-medium text-[#44403C] mb-3">
                    Cost {meta.cost ? '' : 'Estimate'}
                  </h3>
                  <div className="space-y-1.5">
                    {[['STT', cost.stt || cost.stt_usd], ['LLM', cost.llm || cost.llm_usd], ['TTS', cost.tts || cost.tts_usd], ['Telephony', cost.telephony || cost.telephony_usd]].map(([label, val]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-sm text-[#A8A29E]">{label}</span>
                        <span className="text-sm text-[#44403C]">${(val || 0).toFixed(5)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-[#E8E5E2] pt-1.5 mt-1.5">
                      <span className="text-sm font-medium text-[#78716C]">Total</span>
                      <span className="text-sm font-medium text-[#1A1816]">${(cost.total || cost.total_usd || 0).toFixed(5)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              {d.summary && (
                <div className="bg-[#FAFAF9] rounded-xl border border-[#E8E5E2] p-4">
                  <h3 className="text-sm font-medium text-[#44403C] mb-2">AI Summary</h3>
                  <p className="text-sm text-[#78716C] leading-relaxed">{d.summary}</p>
                </div>
              )}

              <Link to={`/calls/${call.id}`} className="block text-center text-sm text-[#2563EB] hover:text-[#3B82F6] py-2">
                Open full detail view →
              </Link>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-sm text-[#A8A29E] shrink-0">{label}</dt>
      <dd className="text-sm text-[#44403C] text-right">{value}</dd>
    </div>
  )
}

export default function CallsPage() {
  const [calls, setCalls]   = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [inlineAudio, setInlineAudio] = useState(null)
  const inlineAudioRef = useRef(null)

  const agentName = (id) => agents.find(a => a.id === id)?.name || id?.slice(0, 8) + '…'

  function load() {
    api.listCalls({ limit: 200 })
      .then(setCalls)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(); api.listAgents().then(setAgents).catch(() => {}) }, [])

  // Auto-refresh every 5 s when active calls exist
  useEffect(() => {
    const hasActive = calls.some(c => ['active', 'routing', 'connecting'].includes(c.status))
    if (!hasActive) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [calls])

  const filtered = calls
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => !search.trim() || (c.phone || '').toLowerCase().includes(search.toLowerCase()))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function setFilterReset(f) { setFilter(f); setPage(1) }
  function setSearchReset(s) { setSearch(s); setPage(1) }

  function playInlineRecording(e, call) {
    e.stopPropagation()
    if (inlineAudio === call.id) {
      if (inlineAudioRef.current) { inlineAudioRef.current.pause(); inlineAudioRef.current = null }
      setInlineAudio(null)
      return
    }
    if (inlineAudioRef.current) { inlineAudioRef.current.pause() }
    const audio = new Audio(call.recording_url)
    audio.onended = () => { setInlineAudio(null); inlineAudioRef.current = null }
    audio.play()
    inlineAudioRef.current = audio
    setInlineAudio(call.id)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-6xl">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1816]">Calls</h1>
            <p className="text-base text-[#A8A29E] mt-0.5">{calls.length} total calls</p>
          </div>
          <button onClick={load}
            className="text-sm text-[#A8A29E] hover:text-[#44403C] flex items-center gap-1.5 bg-white border border-[#E8E5E2] px-3 py-1.5 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-white border border-[#E8E5E2] rounded-lg p-1">
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setFilterReset(s)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filter === s ? 'bg-[#2563EB]/20 text-[#2563EB]' : 'text-[#A8A29E] hover:text-[#44403C]'
                }`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <svg className="w-3.5 h-3.5 text-[#A8A29E] absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearchReset(e.target.value)}
              placeholder="Search by phone…"
              className="pl-8 pr-3 py-1.5 bg-white border border-[#E8E5E2] rounded-lg text-sm text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB] w-52"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E8E5E2] overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-[#A8A29E] text-base">Loading…</div>
          ) : pageData.length === 0 ? (
            <div className="p-10 text-center text-[#A8A29E] text-base">No calls found.</div>
          ) : (
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-[#E8E5E2]">
                  {['', 'Phone', 'Agent', 'Status', 'Direction', 'Duration', 'Started', ''].map((h, i) => (
                    <th key={h + i} className="px-5 py-3 text-left text-sm font-medium text-[#A8A29E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDEA]">
                {pageData.map(call => (
                  <>
                    <tr key={call.id}
                      onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                      className={`hover:bg-[#FAFAF9] transition-colors cursor-pointer ${expandedId === call.id ? 'bg-[#FAFAF9]' : ''}`}>
                      <td className="px-5 py-3.5 w-10">
                        {call.recording_url ? (
                          <button onClick={(e) => playInlineRecording(e, call)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                              inlineAudio === call.id
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 hover:bg-[#2563EB]/20'
                            }`}>
                            {inlineAudio === call.id ? (
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                            ) : (
                              <svg className="w-3 h-3 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            )}
                          </button>
                        ) : (
                          <span className="text-[#D6D3D1]">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[#44403C] font-medium">{call.phone || '—'}</td>
                      <td className="px-5 py-3.5 text-[#A8A29E] font-mono text-sm">{agentName(call.agent_id)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={call.status} /></td>
                      <td className="px-5 py-3.5"><StatusBadge status={call.direction} /></td>
                      <td className="px-5 py-3.5 text-[#78716C]">{call.duration_sec ? `${call.duration_sec}s` : '—'}</td>
                      <td className="px-5 py-3.5 text-[#A8A29E] text-sm">{formatDate(call.started_at)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button className="text-sm text-[#A8A29E] hover:text-[#44403C]">
                            <svg className={`w-4 h-4 transition-transform ${expandedId === call.id ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          <Link to={`/calls/${call.id}`} onClick={e => e.stopPropagation()} className="text-sm text-[#2563EB] hover:text-[#3B82F6]">
                            View →
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {expandedId === call.id && (
                      <CallExpandedRow key={call.id + '-detail'} call={call} agentName={agentName(call.agent_id)} />
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-[#A8A29E]">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm text-[#78716C] hover:text-[#1A1816] bg-white border border-[#E8E5E2] rounded-lg disabled:opacity-40 transition-colors">
                ← Prev
              </button>
              <span className="text-sm text-[#A8A29E]">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-sm text-[#78716C] hover:text-[#1A1816] bg-white border border-[#E8E5E2] rounded-lg disabled:opacity-40 transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
