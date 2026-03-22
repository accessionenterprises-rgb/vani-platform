import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import StatusBadge from '../components/StatusBadge'

function QAPanel({ callId, transcript }) {
  const [qa, setQa]           = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function runQA() {
    setError('')
    setLoading(true)
    try { setQa(await api.runCallQA(callId)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const scores = qa ? [
    { label: 'Professionalism', value: qa.professionalism },
    { label: 'Empathy',         value: qa.empathy },
    { label: 'Resolution',      value: qa.resolution },
    { label: 'Adherence',       value: qa.adherence },
  ] : []
  const overall = qa ? Math.round(scores.reduce((s, x) => s + x.value, 0) / scores.length) : 0

  return (
    <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-white">AI QA Review</h2>
        {qa && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
            overall >= 8 ? 'bg-emerald-500/15 text-emerald-400' :
            overall >= 6 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
          }`}>{overall}/10</span>
        )}
      </div>
      {!qa && !loading && (
        <div className="text-center py-3">
          <p className="text-xs text-slate-500 mb-3">
            {transcript ? 'Run an AI-powered quality review.' : 'No transcript available.'}
          </p>
          <button onClick={runQA} disabled={!transcript}
            className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
            Run QA Review
          </button>
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
          <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Analysing transcript…
        </div>
      )}
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      {qa && (
        <div className="space-y-2.5">
          {scores.map(({ label, value }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{label}</span>
                <span className={value >= 8 ? 'text-emerald-400' : value >= 6 ? 'text-amber-400' : 'text-red-400'}>{value}/10</span>
              </div>
              <div className="h-1.5 bg-[#1f2235] rounded-full overflow-hidden">
                <div style={{ width: `${value * 10}%` }}
                  className={`h-full rounded-full ${value >= 8 ? 'bg-emerald-500' : value >= 6 ? 'bg-amber-500' : 'bg-red-500'}`} />
              </div>
            </div>
          ))}
          {qa.summary && <p className="text-xs text-slate-400 leading-relaxed mt-3 pt-3 border-t border-[#1f2235]">{qa.summary}</p>}
          {qa.flags?.map((f, i) => (
            <p key={i} className="text-xs text-amber-400 flex gap-1"><span>⚠</span>{f}</p>
          ))}
          <button onClick={runQA} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Re-run</button>
        </div>
      )}
    </div>
  )
}

export default function CallDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [call, setCall] = useState(null)
  const [loading, setLoading] = useState(true)
  const [monitorToken, setMonitorToken] = useState(null)
  const [monitorLoading, setMonitorLoading] = useState(false)

  // Replay state
  const [replayActive, setReplayActive] = useState(false)
  const [replayIndex, setReplayIndex] = useState(-1)
  const [replaySpeed, setReplaySpeed] = useState(1)
  const replayRef = useRef({ active: false, speed: 1, timer: null })
  const replayBottomRef = useRef(null)

  useEffect(() => {
    api.getCall(id)
      .then(setCall)
      .catch(() => navigate('/calls'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  async function openMonitor() {
    setMonitorLoading(true)
    try {
      const res = await api.getMonitorToken(id)
      setMonitorToken(res)
    } catch (err) {
      alert(err.message)
    } finally {
      setMonitorLoading(false)
    }
  }

  // Cleanup replay on unmount
  useEffect(() => () => clearTimeout(replayRef.current.timer), [])

  // Scroll to latest replayed line
  useEffect(() => {
    if (replayActive) replayBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replayIndex, replayActive])

  function startReplay(lines) {
    if (!lines.length) return
    clearTimeout(replayRef.current.timer)
    replayRef.current.active = true
    replayRef.current.speed  = replaySpeed
    setReplayActive(true)
    setReplayIndex(-1)
    let idx = -1
    function tick() {
      if (!replayRef.current.active) return
      idx++
      setReplayIndex(idx)
      if (idx >= lines.length - 1) {
        setReplayActive(false)
        replayRef.current.active = false
        return
      }
      const nextLine = lines[idx + 1]
      const words = (nextLine.replace(/^\[\d+:\d+:\d+\] (User|Agent): /, '').match(/\S+/g) || []).length
      const delay  = Math.max(700, Math.min(words * 90, 3500)) / replayRef.current.speed
      replayRef.current.timer = setTimeout(tick, delay)
    }
    tick()
  }

  function stopReplay(lines) {
    clearTimeout(replayRef.current.timer)
    replayRef.current.active = false
    setReplayActive(false)
    setReplayIndex(lines.length - 1)
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-slate-600">Loading…</div>
  if (!call) return null

  const transcriptLines = call.transcript ? call.transcript.split('\n').filter(Boolean) : []
  const meta = call.metadata || {}
  const cost = meta.cost || {}
  const latency = meta.latency_profile
  const extracted = meta.extracted
  const isActive = ['routing', 'connecting', 'active'].includes(call.status)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-4xl">
        <div className="flex items-center gap-3 mb-7">
          <button onClick={() => navigate('/calls')} className="text-slate-500 hover:text-slate-300 text-sm">
            ← Calls
          </button>
          <span className="text-slate-700">/</span>
          <h1 className="text-xl font-semibold text-white font-mono">{call.phone || 'Unknown'}</h1>
          <StatusBadge status={call.status} />
          {call.direction === 'outbound' && (
            <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">outbound</span>
          )}
          {isActive && (
            <button
              onClick={openMonitor}
              disabled={monitorLoading}
              className="ml-auto text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {monitorLoading ? 'Getting token…' : '🎧 Monitor Live'}
            </button>
          )}
        </div>

        {/* Monitor token display */}
        {monitorToken && (
          <div className="mb-5 bg-[#12141f] rounded-xl border border-emerald-500/20 p-4">
            <h3 className="text-xs font-medium text-emerald-400 mb-2">Supervisor Listen-In Token</h3>
            <p className="text-xs text-slate-500 mb-2">
              Use this token with a LiveKit web client to listen in (read-only, caller cannot hear you).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-600 mb-1">LiveKit URL</p>
                <code className="text-xs text-slate-300 bg-[#0d0f18] px-2 py-1 rounded block truncate">{monitorToken.livekit_url}</code>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Room</p>
                <code className="text-xs text-slate-300 bg-[#0d0f18] px-2 py-1 rounded block truncate">{monitorToken.room}</code>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs text-slate-600 mb-1">Token (copy to LiveKit client)</p>
              <code className="text-xs text-slate-400 bg-[#0d0f18] px-2 py-1.5 rounded block break-all">{monitorToken.token.slice(0, 80)}…</code>
            </div>
          </div>
        )}

        {/* Meta grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetaCard label="Duration" value={call.duration_sec ? fmtDuration(call.duration_sec) : '—'} />
          <MetaCard label="Direction" value={call.direction || 'inbound'} />
          <MetaCard label="Started" value={formatTime(call.started_at)} />
          <MetaCard label="Cost" value={cost.total_usd ? `$${cost.total_usd.toFixed(4)}` : '—'}
            sub={cost.duration_min ? `${cost.duration_min.toFixed(1)} min` : undefined} />
        </div>

        {/* Recording */}
        {call.recording_url && (
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5 mb-5">
            <h2 className="text-sm font-medium text-white mb-3">Recording</h2>
            <audio controls src={call.recording_url} className="w-full h-10" style={{ colorScheme: 'dark' }} />
          </div>
        )}

        <div className="grid grid-cols-5 gap-5">
          {/* Transcript */}
          <div className="col-span-3 bg-[#12141f] rounded-xl border border-[#1f2235]">
            <div className="px-5 py-4 border-b border-[#1f2235] flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-white">Transcript</h2>
              {transcriptLines.length > 0 && (
                <div className="flex items-center gap-2">
                  {/* Speed selector — only visible when replaying */}
                  {replayActive && (
                    <div className="flex gap-0.5 bg-[#0d0f18] rounded-md p-0.5 border border-[#2a2d3a]">
                      {[0.5, 1, 2].map(s => (
                        <button key={s} onClick={() => { replayRef.current.speed = s; setReplaySpeed(s) }}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            replaySpeed === s ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
                          }`}>
                          {s}×
                        </button>
                      ))}
                    </div>
                  )}
                  {replayActive ? (
                    <button onClick={() => stopReplay(transcriptLines)}
                      className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Stop
                    </button>
                  ) : (
                    <button onClick={() => startReplay(transcriptLines)}
                      className="flex items-center gap-1.5 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors">
                      ▶ Replay
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="p-5 space-y-3 max-h-[520px] overflow-y-auto">
              {transcriptLines.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-6">No transcript available.</p>
              ) : (
                (() => {
                  const displayLines = replayActive
                    ? transcriptLines.slice(0, replayIndex + 1)
                    : transcriptLines
                  return (
                    <>
                      {displayLines.map((line, i) => {
                        const isUser  = line.includes('] User:')
                        const isAgent = line.includes('] Agent:')
                        const text = line.replace(/^\[\d+:\d+:\d+\] (User|Agent): /, '')
                        const time = line.match(/\[(\d+:\d+:\d+)\]/)?.[1]
                        return (
                          <div key={i} className={`flex gap-3 ${isAgent ? 'flex-row-reverse' : ''} ${
                            replayActive && i === displayLines.length - 1 ? 'animate-pulse' : ''
                          }`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                              isUser ? 'bg-slate-700 text-slate-300' : 'bg-indigo-500/20 text-indigo-400'
                            }`}>
                              {isUser ? 'U' : 'A'}
                            </div>
                            <div className={`flex-1 ${isAgent ? 'text-right' : ''}`}>
                              <p className={`text-sm rounded-xl px-3.5 py-2.5 inline-block max-w-xs ${
                                isUser ? 'bg-[#1a1d2e] text-slate-200' : 'bg-indigo-500/15 text-indigo-200'
                              }`}>
                                {text}
                              </p>
                              {time && <p className="text-xs text-slate-700 mt-1 px-1">{time}</p>}
                            </div>
                          </div>
                        )
                      })}
                      {replayActive && (
                        <div className="flex gap-1 px-1">
                          {[0,1,2].map(i => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      )}
                      <div ref={replayBottomRef} />
                    </>
                  )
                })()
              )}
            </div>
          </div>

          {/* Side info */}
          <div className="col-span-2 space-y-4">
            {/* AI QA Analyst */}
            {call.status === 'completed' && (
              <QAPanel callId={call.id} transcript={call.transcript} />
            )}
            {/* Call info */}
            <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
              <h2 className="text-sm font-medium text-white mb-4">Details</h2>
              <dl className="space-y-3">
                <InfoRow label="Call ID"   value={<span className="font-mono text-xs">{call.id?.slice(0, 12)}…</span>} />
                <InfoRow label="Agent ID"  value={<span className="font-mono text-xs">{call.agent_id?.slice(0,12)}…</span>} />
                <InfoRow label="Sentiment" value={<span className={sentimentColor(call.sentiment)}>{call.sentiment || '—'}</span>} />
                {meta.intent && <InfoRow label="Intent" value={<span className="text-indigo-400 capitalize">{meta.intent}</span>} />}
                {meta.resolved !== undefined && (
                  <InfoRow label="Resolved" value={
                    <span className={meta.resolved ? 'text-emerald-400' : 'text-amber-400'}>
                      {meta.resolved ? 'Yes' : 'No'}
                    </span>
                  } />
                )}
                {meta.goal_achieved !== undefined && (
                  <InfoRow label="Goal" value={
                    <span className={meta.goal_achieved ? 'text-emerald-400' : 'text-red-400'}>
                      {meta.goal_achieved ? '✓ Achieved' : '✗ Not achieved'}
                    </span>
                  } />
                )}
              </dl>
            </div>

            {/* Summary */}
            {call.summary && (
              <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
                <h2 className="text-sm font-medium text-white mb-3">AI Summary</h2>
                <p className="text-xs text-slate-400 leading-relaxed">{call.summary}</p>
              </div>
            )}

            {/* Latency profile */}
            {latency && (
              <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
                <h2 className="text-sm font-medium text-white mb-3">Response Latency</h2>
                <div className="space-y-2">
                  {[['Avg', latency.avg_ms], ['P50', latency.p50_ms], ['P95', latency.p95_ms], ['Max', latency.max_ms]].map(([label, val]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-7">{label}</span>
                      <div className="flex-1 bg-[#0d0f18] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${val < 500 ? 'bg-emerald-500' : val < 1000 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(100, (val / 2000) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-300 w-14 text-right">{val}ms</span>
                    </div>
                  ))}
                  <p className="text-xs text-slate-600 mt-1">{latency.samples} turns measured</p>
                </div>
              </div>
            )}

            {/* Cost breakdown */}
            {cost.total_usd !== undefined && (
              <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
                <h2 className="text-sm font-medium text-white mb-3">Cost Breakdown</h2>
                <div className="space-y-1.5">
                  {[['STT', cost.stt_usd], ['LLM', cost.llm_usd], ['TTS', cost.tts_usd], ['Telephony', cost.telephony_usd]].map(([label, val]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className="text-xs text-slate-300">${(val || 0).toFixed(5)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#1f2235] pt-1.5 mt-1.5">
                    <span className="text-xs font-medium text-slate-400">Total</span>
                    <span className="text-xs font-medium text-slate-200">${(cost.total_usd || 0).toFixed(5)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Extracted fields */}
            {extracted && Object.keys(extracted).length > 0 && (
              <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
                <h2 className="text-sm font-medium text-white mb-3">Extracted Data</h2>
                <dl className="space-y-2">
                  {Object.entries(extracted).map(([k, v]) => (
                    <InfoRow key={k} label={k} value={
                      <span className="text-slate-300 text-right max-w-[140px] break-words">
                        {v === null ? <span className="text-slate-600">null</span> :
                         typeof v === 'boolean' ? (v ? '✓ true' : '✗ false') : String(v)}
                      </span>
                    } />
                  ))}
                </dl>
              </div>
            )}

            {/* Topics */}
            {meta.topics?.length > 0 && (
              <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
                <h2 className="text-sm font-medium text-white mb-3">Topics</h2>
                <div className="flex flex-wrap gap-1.5">
                  {meta.topics.map(t => (
                    <span key={t} className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaCard({ label, value, sub }) {
  return (
    <div className="bg-[#12141f] rounded-xl border border-[#1f2235] px-4 py-3.5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-200">{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}
function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-slate-500 shrink-0">{label}</dt>
      <dd className="text-xs text-slate-300 text-right">{value}</dd>
    </div>
  )
}
function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(sec) {
  if (!sec) return '—'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}
function sentimentColor(s) {
  return { positive: 'text-emerald-400', negative: 'text-red-400', neutral: 'text-slate-400' }[s] || 'text-slate-500'
}
