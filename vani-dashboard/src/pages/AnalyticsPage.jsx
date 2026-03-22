import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

// Persist pinned widgets to localStorage
const STORAGE_KEY = 'vani_pinned_widgets'
const ALL_WIDGETS = [
  { id: 'total_calls',   label: 'Total Calls' },
  { id: 'success_rate',  label: 'Success Rate' },
  { id: 'avg_duration',  label: 'Avg Duration' },
  { id: 'active_now',    label: 'Active Now' },
  { id: 'call_volume',   label: 'Call Volume Chart' },
  { id: 'sentiment',     label: 'Sentiment' },
  { id: 'providers',     label: 'Provider Performance' },
  { id: 'agents',        label: 'Agent Performance' },
  { id: 'intents',       label: 'Intent Distribution' },
]
const DEFAULT_PINNED = ALL_WIDGETS.map(w => w.id)

const PERIODS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
]
const REFRESH_INTERVAL = 30_000

export default function AnalyticsPage() {
  const [period, setPeriod]           = useState(7)
  const [overview, setOverview]       = useState(null)
  const [callsChart, setCallsChart]   = useState([])
  const [agents, setAgents]           = useState([])
  const [intents, setIntents]         = useState(null)
  const [providers, setProviders]     = useState(null)
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing, setRefreshing]   = useState(false)
  const [pinned, setPinned]           = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_PINNED }
    catch { return DEFAULT_PINNED }
  })
  const [customizing, setCustomizing] = useState(false)

  function togglePin(id) {
    setPinned(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }
  const show = id => pinned.includes(id)

  const fetchData = useCallback(async (isAuto = false) => {
    if (!isAuto) setLoading(true); else setRefreshing(true)
    try {
      const [ov, ch, ag, int, prov] = await Promise.all([
        api.analyticsOverview(period),
        api.analyticsCalls(period),
        api.analyticsAgents(period),
        api.analyticsIntents(period),
        api.analyticsProviders(period),
      ])
      setOverview(ov)
      setCallsChart(ch.chart || [])
      setAgents(ag.agents || [])
      setIntents(int)
      setProviders(prov)
      setLastUpdated(new Date())
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const id = setInterval(() => fetchData(true), REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading && !overview) return (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">Loading analytics…</div>
  )


  const maxCalls = Math.max(...callsChart.map(d => d.total), 1)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-semibold text-white">Analytics</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Call performance and agent insights
              {lastUpdated && <span className="ml-2 text-slate-600">· {lastUpdated.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setCustomizing(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                customizing ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'text-slate-500 hover:text-slate-300 bg-[#12141f] border-[#1f2235]'
              }`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              {customizing ? 'Done' : 'Customize'}
            </button>
            <button onClick={() => fetchData()} disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 bg-[#12141f] border border-[#1f2235] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          <div className="flex gap-1 bg-[#12141f] rounded-lg border border-[#1f2235] p-1">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period === p.value
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          </div>
        </div>

        {/* Widget picker */}
        {customizing && (
          <div className="mb-5 bg-[#12141f] rounded-xl border border-indigo-500/20 p-4">
            <p className="text-xs font-medium text-slate-300 mb-3">Toggle widgets to show/hide them:</p>
            <div className="flex flex-wrap gap-2">
              {ALL_WIDGETS.map(w => (
                <button key={w.id} onClick={() => togglePin(w.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    pinned.includes(w.id)
                      ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                      : 'text-slate-500 border-[#2a2d3a] hover:text-slate-300'
                  }`}>
                  {pinned.includes(w.id) ? '✓ ' : ''}{w.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {overview && (
          <div className="grid grid-cols-6 gap-4 mb-6">
            <StatCard label="Total Calls"    value={overview.total_calls}      color="indigo" />
            <StatCard label="Completed"      value={overview.completed}         color="emerald" />
            <StatCard label="Failed"         value={overview.failed}            color="red" />
            <StatCard label="Success Rate"   value={`${overview.success_rate}%`} color="indigo" />
            <StatCard label="Avg Duration"   value={fmtDuration(overview.avg_duration_sec)} color="slate" />
            <StatCard label="Active Now"     value={overview.active_now}        color="amber" pulse={overview.active_now > 0} />
          </div>
        )}

        <div className="grid grid-cols-3 gap-5 mb-5">
          {/* Call Volume Chart */}
          <div className="col-span-2 bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
            <h2 className="text-sm font-medium text-white mb-5">Call Volume</h2>
            {callsChart.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-slate-600 text-sm">No data yet</div>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {callsChart.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute bottom-full mb-1 bg-[#1a1d2e] text-xs text-slate-300 px-2 py-1 rounded
                      opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {day.date}: {day.total} calls
                    </div>
                    <div className="w-full flex flex-col-reverse gap-px">
                      <div
                        style={{ height: `${Math.max(2, (day.completed / maxCalls) * 120)}px` }}
                        className="w-full bg-emerald-500/70 rounded-sm"
                      />
                      {day.failed > 0 && (
                        <div
                          style={{ height: `${Math.max(1, (day.failed / maxCalls) * 120)}px` }}
                          className="w-full bg-red-500/60 rounded-sm"
                        />
                      )}
                    </div>
                    <span className="text-[9px] text-slate-600 mt-1">
                      {day.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-4 mt-3">
              <Legend color="bg-emerald-500/70" label="Completed" />
              <Legend color="bg-red-500/60" label="Failed" />
            </div>
          </div>

          {/* Sentiment Breakdown */}
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
            <h2 className="text-sm font-medium text-white mb-5">Sentiment</h2>
            {overview?.sentiment_breakdown ? (
              <div className="space-y-3">
                {Object.entries(overview.sentiment_breakdown).map(([s, count]) => {
                  const total = overview.total_calls || 1
                  const pct = Math.round(count / total * 100)
                  return (
                    <div key={s}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`capitalize font-medium ${sentimentColor(s)}`}>{s}</span>
                        <span className="text-slate-500">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-[#1f2235] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full ${sentimentBg(s)}`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-slate-600 text-sm text-center py-8">No data yet</div>
            )}

            {/* Inbound vs Outbound */}
            {overview && (
              <div className="mt-6 pt-4 border-t border-[#1f2235]">
                <p className="text-xs text-slate-500 mb-3">Direction</p>
                <div className="flex gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{overview.inbound}</p>
                    <p className="text-xs text-slate-500">Inbound</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{overview.outbound}</p>
                    <p className="text-xs text-slate-500">Outbound</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Provider Performance */}
        {providers && (providers.llm?.length > 0 || providers.tts?.length > 0) && (
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] mb-5">
            <div className="px-5 py-4 border-b border-[#1f2235]">
              <h2 className="text-sm font-medium text-white">Provider Performance</h2>
              <p className="text-xs text-slate-500 mt-0.5">Avg latency + cost from {providers.total_calls} completed calls</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#1f2235]">
              {[
                { label: 'LLM', rows: providers.llm, unit: 'first token' },
                { label: 'TTS', rows: providers.tts, unit: 'first chunk' },
                { label: 'STT', rows: providers.stt, unit: 'latency' },
              ].map(({ label, rows, unit }) => (
                <div key={label} className="p-5">
                  <p className="text-xs font-medium text-slate-400 mb-3">{label}</p>
                  {!rows?.length ? (
                    <p className="text-xs text-slate-600">No data</p>
                  ) : (
                    <div className="space-y-3">
                      {rows.map(p => (
                        <div key={p.provider} className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-white">{p.provider}</p>
                            <p className="text-[10px] text-slate-600">{p.calls} calls</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-semibold ${p.avg_latency_ms > 1500 ? 'text-red-400' : p.avg_latency_ms > 800 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {p.avg_latency_ms > 0 ? `${p.avg_latency_ms}ms` : '—'}
                            </p>
                            <p className="text-[10px] text-slate-600">${p.total_cost_usd.toFixed(3)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          {/* Per-Agent Performance */}
          <div className="col-span-2 bg-[#12141f] rounded-xl border border-[#1f2235]">
            <div className="px-5 py-4 border-b border-[#1f2235]">
              <h2 className="text-sm font-medium text-white">Agent Performance</h2>
            </div>
            {agents.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-slate-600 text-sm">No agent data yet</div>
            ) : (
              <div className="divide-y divide-[#1f2235]">
                {agents.map(a => (
                  <div key={a.agent_id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{a.agent_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {a.total} calls · avg {fmtDuration(a.avg_duration_sec)}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className={`text-sm font-medium ${a.success_rate >= 80 ? 'text-emerald-400' : a.success_rate >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                          {a.success_rate}%
                        </p>
                        <p className="text-xs text-slate-600">success</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-medium capitalize ${sentimentColor(a.dominant_sentiment)}`}>
                          {a.dominant_sentiment}
                        </p>
                        <p className="text-xs text-slate-600">sentiment</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Intent Breakdown */}
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
            <h2 className="text-sm font-medium text-white mb-5">Intent Distribution</h2>
            {intents?.intents?.length > 0 ? (
              <div className="space-y-2.5">
                {intents.intents.slice(0, 6).map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="h-1.5 rounded-full bg-indigo-500/60 flex-1"
                      style={{ maxWidth: `${Math.max(item.pct, 4)}%`, minWidth: '4%' }} />
                    <div className="flex items-center justify-between flex-1">
                      <span className="text-xs text-slate-400 capitalize">{item.label}</span>
                      <span className="text-xs text-slate-600">{item.pct}%</span>
                    </div>
                  </div>
                ))}
                <div className="pt-3 mt-3 border-t border-[#1f2235] flex gap-6">
                  <div>
                    <p className="text-base font-semibold text-emerald-400">{intents.resolved}</p>
                    <p className="text-xs text-slate-500">Resolved</p>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-amber-400">{intents.escalated}</p>
                    <p className="text-xs text-slate-500">Escalated</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-600 text-sm text-center py-8">No completed calls yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, pulse }) {
  const colorMap = {
    indigo: 'text-indigo-400', emerald: 'text-emerald-400',
    red: 'text-red-400', amber: 'text-amber-400', slate: 'text-slate-200',
  }
  return (
    <div className="bg-[#12141f] rounded-xl border border-[#1f2235] px-4 py-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`text-xl font-semibold ${colorMap[color] || 'text-white'}`}>{value}</p>
        {pulse && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
      </div>
    </div>
  )
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}

function fmtDuration(sec) {
  if (!sec) return '—'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function sentimentColor(s) {
  return { positive: 'text-emerald-400', negative: 'text-red-400', neutral: 'text-slate-400' }[s] || 'text-slate-500'
}
function sentimentBg(s) {
  return { positive: 'bg-emerald-500', negative: 'bg-red-500', neutral: 'bg-slate-500' }[s] || 'bg-slate-600'
}
