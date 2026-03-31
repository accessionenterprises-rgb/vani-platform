import { useState, useMemo } from 'react'
import { useCalls, useCall } from '../hooks/useCalls'
import { useAgents } from '../hooks/useAgents'
import { useDrawer } from '../hooks/useDrawer'
import Badge from '../components/shared/Badge'
import EmptyState from '../components/shared/EmptyState'
import DrawerShell from '../components/modals/DrawerShell'

const STATUS_PILLS = ['all', 'active', 'completed', 'failed']
const PAGE_SIZE = 25

function fmtDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function fmtTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDur(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─── Call Detail Drawer ──────────────────────────────────────────────────────

function CallDetailDrawer({ callId, isOpen, onClose, agents }) {
  const { data: call, isLoading } = useCall(callId)
  const agentName = useMemo(() => {
    if (!call || !agents) return '—'
    return agents.find(a => a.id === call.agent_id)?.name || '—'
  }, [call, agents])

  const transcriptLines = useMemo(() => {
    if (!call?.transcript) return []
    return call.transcript.split('\n').filter(Boolean)
  }, [call?.transcript])

  return (
    <DrawerShell isOpen={isOpen} onClose={onClose} title="Call Details" width={520}>
      {isLoading || !call ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">

          {/* Header info */}
          <div className="glass p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-mono text-[#fafafa]">{call.phone || 'Unknown'}</span>
              <Badge status={call.status} pulse={call.status === 'active'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoCell label="Agent" value={agentName} />
              <InfoCell label="Direction" value={call.direction || 'inbound'} />
              <InfoCell label="Duration" value={fmtDur(call.duration_sec)} />
              <InfoCell label="Date" value={call.started_at ? `${fmtDate(call.started_at)} ${fmtTime(call.started_at)}` : '—'} />
            </div>
          </div>

          {/* Provider metadata */}
          {call.metadata && (call.metadata.stt_provider || call.metadata.llm_provider || call.metadata.tts_provider) && (
            <div className="glass p-4">
              <h3 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-[0.06em] mb-3">Providers</h3>
              <div className="grid grid-cols-3 gap-3">
                {call.metadata.stt_provider && <InfoCell label="STT" value={call.metadata.stt_provider} />}
                {call.metadata.llm_provider && <InfoCell label="LLM" value={call.metadata.llm_provider} />}
                {call.metadata.tts_provider && <InfoCell label="TTS" value={call.metadata.tts_provider} />}
              </div>
            </div>
          )}

          {/* Summary */}
          {call.summary && (
            <div className="glass p-4">
              <h3 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-[0.06em] mb-2">AI Summary</h3>
              <p className="text-[13px] text-[#a1a1aa] leading-relaxed">{call.summary}</p>
            </div>
          )}

          {/* Recording */}
          {call.recording_url && (
            <div className="glass p-4">
              <h3 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-[0.06em] mb-3">Recording</h3>
              <audio
                controls
                src={call.recording_url}
                className="w-full h-9"
                style={{ filter: 'invert(1) hue-rotate(180deg)', opacity: 0.85 }}
              />
            </div>
          )}

          {/* Transcript */}
          <div className="glass p-4">
            <h3 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-[0.06em] mb-3">Transcript</h3>
            {transcriptLines.length === 0 ? (
              <p className="text-[13px] text-[#52525b] text-center py-6">No transcript available</p>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {transcriptLines.map((line, i) => {
                  const isUser = line.includes('] User:')
                  const text = line.replace(/^\[\d+:\d+:\d+\] (User|Agent): /, '')
                  const time = line.match(/\[(\d+:\d+:\d+)\]/)?.[1]
                  return (
                    <div key={i} className={`flex gap-2 ${!isUser ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5 ${
                        isUser ? 'bg-[rgba(255,255,255,0.06)] text-[#a1a1aa]' : 'bg-[rgba(139,92,246,0.15)] text-[#8b5cf6]'
                      }`}>
                        {isUser ? 'U' : 'A'}
                      </div>
                      <div className={`flex-1 ${!isUser ? 'text-right' : ''}`}>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#52525b]">
                          {isUser ? 'User' : 'Agent'}
                          {time && <span className="text-[#3f3f46] ml-1">{time}</span>}
                        </span>
                        <p className={`text-[12px] leading-relaxed mt-0.5 rounded-lg px-3 py-1.5 inline-block max-w-[85%] ${
                          isUser
                            ? 'bg-[rgba(255,255,255,0.04)] text-[#fafafa] border border-[rgba(255,255,255,0.06)]'
                            : 'bg-[rgba(139,92,246,0.08)] text-[#e4e4e7]'
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

          {/* Cost */}
          {call.metadata?.cost && (
            <div className="glass p-4">
              <h3 className="text-[11px] font-semibold text-[#52525b] uppercase tracking-[0.06em] mb-3">Cost</h3>
              <div className="space-y-1.5">
                {[['STT', call.metadata.cost.stt_usd || call.metadata.cost.stt],
                  ['LLM', call.metadata.cost.llm_usd || call.metadata.cost.llm],
                  ['TTS', call.metadata.cost.tts_usd || call.metadata.cost.tts],
                  ['Telephony', call.metadata.cost.telephony_usd || call.metadata.cost.telephony],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-[12px] text-[#52525b]">{label}</span>
                    <span className="text-[12px] text-[#a1a1aa] font-mono">${Number(val).toFixed(5)}</span>
                  </div>
                ))}
                {(call.metadata.cost.total || call.metadata.cost.total_usd) && (
                  <div className="flex justify-between border-t border-[rgba(255,255,255,0.06)] pt-1.5 mt-1.5">
                    <span className="text-[12px] font-medium text-[#a1a1aa]">Total</span>
                    <span className="text-[12px] font-medium text-[#fafafa] font-mono">
                      ${Number(call.metadata.cost.total || call.metadata.cost.total_usd).toFixed(5)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </DrawerShell>
  )
}

function InfoCell({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#52525b] uppercase tracking-[0.06em]">{label}</p>
      <p className="text-[13px] text-[#fafafa] mt-0.5 capitalize">{value}</p>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CallsPage() {
  const [status, setStatus] = useState('all')
  const [agentFilter, setAgentFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const { isOpen, detailId, open, close } = useDrawer('detail')
  const { data: agents = [] } = useAgents()

  const filters = useMemo(() => ({
    status: status !== 'all' ? status : undefined,
    agent_id: agentFilter || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [status, agentFilter, page])

  const { data: rawCalls = [], isLoading } = useCalls(filters)

  // Client-side search filter
  const calls = useMemo(() => {
    if (!search.trim()) return rawCalls
    const q = search.toLowerCase()
    return rawCalls.filter(c =>
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (agents.find(a => a.id === c.agent_id)?.name?.toLowerCase().includes(q))
    )
  }, [rawCalls, search, agents])

  const agentMap = useMemo(() => {
    const m = {}
    agents.forEach(a => { m[a.id] = a.name })
    return m
  }, [agents])

  return (
    <div className="w-full h-full px-6 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[26px] font-bold text-[#fafafa] tracking-[-0.02em]">Calls</h1>
          <p className="text-[13px] text-[#52525b] mt-0.5">Monitor and review all voice conversations</p>
        </div>
        <button className="btn-primary press flex items-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72"/>
          </svg>
          Open Dialer
        </button>
      </div>

      {/* Filter bar */}
      <div className="glass p-3 mb-4 flex items-center gap-3 flex-wrap">

        {/* Status pills */}
        <div className="flex items-center gap-1">
          {STATUS_PILLS.map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(0) }}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium capitalize transition-all ${
                status === s
                  ? 'bg-[rgba(139,92,246,0.15)] text-[#8b5cf6] border border-[rgba(139,92,246,0.25)]'
                  : 'text-[#52525b] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.03)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-[rgba(255,255,255,0.06)]" />

        {/* Agent dropdown */}
        <select
          value={agentFilter}
          onChange={e => { setAgentFilter(e.target.value); setPage(0) }}
          className="input text-[12px] py-1.5 px-3 min-w-[140px] bg-transparent appearance-none cursor-pointer"
        >
          <option value="">All agents</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Search */}
        <div className="flex-1 min-w-[180px] relative">
          <svg className="w-3.5 h-3.5 text-[#52525b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search phone or agent..."
            className="input w-full text-[12px] py-1.5 pl-9 pr-3"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_140px_130px_80px_90px_80px] px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)]">
          {['Date / Time', 'Phone', 'Agent', 'Duration', 'Status', 'Direction'].map(h => (
            <span key={h} className="text-[11px] font-semibold text-[#52525b] uppercase tracking-[0.06em]">{h}</span>
          ))}
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : calls.length === 0 ? (
          <EmptyState
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 7.36 7.36l1.91-1.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
            title={status !== 'all' || search ? 'No calls match your filters' : 'No calls yet'}
            description={status !== 'all' || search ? 'Try clearing the filters to see all calls' : 'Calls will appear here once your agents start handling conversations'}
          />
        ) : (
          <div>
            {calls.map((call, idx) => (
              <button
                key={call.id}
                onClick={() => open(call.id)}
                className={`grid grid-cols-[1fr_140px_130px_80px_90px_80px] px-4 py-2.5 w-full text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer ${
                  idx < calls.length - 1 ? 'border-b border-[rgba(255,255,255,0.03)]' : ''
                }`}
              >
                {/* Date/Time */}
                <span className="text-[13px] text-[#fafafa]">
                  {fmtDate(call.started_at)}
                  <span className="text-[#52525b] ml-1.5">{fmtTime(call.started_at)}</span>
                </span>

                {/* Phone */}
                <span className="text-[13px] font-mono text-[#a1a1aa] truncate pr-2">{call.phone || '—'}</span>

                {/* Agent */}
                <span className="text-[13px] text-[#a1a1aa] truncate pr-2">{agentMap[call.agent_id] || '—'}</span>

                {/* Duration */}
                <span className="text-[13px] font-mono text-[#52525b]">{fmtDur(call.duration_sec)}</span>

                {/* Status */}
                <span>
                  <Badge status={call.status} pulse={call.status === 'active'} />
                </span>

                {/* Direction */}
                <span className="text-[12px] text-[#52525b] capitalize flex items-center gap-1.5">
                  {call.direction === 'outbound' ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="17" y1="7" x2="7" y2="17" /><polyline points="17 17 7 17 7 7" />
                    </svg>
                  )}
                  {call.direction || 'inbound'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && calls.length > 0 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-[11px] text-[#52525b]">
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + calls.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-ghost text-[12px] py-1 px-3 disabled:opacity-30 disabled:pointer-events-none"
            >
              Previous
            </button>
            <span className="text-[12px] text-[#52525b] font-mono">{page + 1}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={rawCalls.length < PAGE_SIZE}
              className="btn-ghost text-[12px] py-1 px-3 disabled:opacity-30 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Call detail drawer */}
      <CallDetailDrawer
        callId={detailId}
        isOpen={isOpen}
        onClose={close}
        agents={agents}
      />
    </div>
  )
}
