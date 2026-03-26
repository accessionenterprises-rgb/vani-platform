import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function LatencyPage() {
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.listAgents().then(setAgents).catch(() => {}) }, [])

  useEffect(() => {
    if (!selectedAgent) return
    setLoading(true)
    api.listCalls({ limit: 50 }).then(data => {
      const filtered = data.filter(c => c.agent_id === selectedAgent && c.metadata)
      setCalls(filtered)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [selectedAgent])

  // Also fetch from provider_latency table
  const [providerStats, setProviderStats] = useState([])
  useEffect(() => {
    fetch('https://osimjsbgxhoqlrfutloh.supabase.co/rest/v1/provider_latency?select=*&order=created_at.desc&limit=50', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // will use auth token
        'Authorization': `Bearer ${localStorage.getItem('vani_token')}`,
      }
    }).then(r => r.json()).then(setProviderStats).catch(() => {})
  }, [])

  // Get latency from call metadata
  const callsWithLatency = calls.filter(c => {
    const m = c.metadata || {}
    return m.latency_profile || m.usage
  })

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1816]">Latency Reports</h1>
          <p className="text-sm text-[#78716C] mt-1">Real-time performance metrics for every call</p>
        </div>
        <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
          className="bg-white border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm">
          <option value="">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Avg Response Time" value={calcAvg(callsWithLatency, 'avg_ms')} unit="ms" color="#2563EB" />
        <MetricCard label="P50 Latency" value={calcAvg(callsWithLatency, 'p50_ms')} unit="ms" color="#059669" />
        <MetricCard label="P95 Latency" value={calcAvg(callsWithLatency, 'p95_ms')} unit="ms" color="#D97706" />
        <MetricCard label="Calls Measured" value={callsWithLatency.length} unit="" color="#7C3AED" />
      </div>

      {/* Per-call breakdown */}
      <div className="bg-white border border-[#E8E5E2] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EDEA]">
          <h2 className="text-lg font-semibold text-[#1A1816]">Per-Call Latency</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : callsWithLatency.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[#78716C]">No latency data yet</p>
            <p className="text-sm text-[#A8A29E] mt-1">Make a call on LiveKit engine — latency will be recorded automatically</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#78716C] text-xs uppercase tracking-wider border-b border-[#F0EDEA]">
                <th className="px-5 py-3">Call</th>
                <th className="px-5 py-3">Engine</th>
                <th className="px-5 py-3">LLM</th>
                <th className="px-5 py-3">Avg</th>
                <th className="px-5 py-3">P50</th>
                <th className="px-5 py-3">P95</th>
                <th className="px-5 py-3">Min</th>
                <th className="px-5 py-3">Max</th>
                <th className="px-5 py-3">Turns</th>
              </tr>
            </thead>
            <tbody>
              {callsWithLatency.map(c => {
                const lp = (c.metadata || {}).latency_profile || {}
                const engine = (c.metadata || {}).engine || c.engine || '?'
                return (
                  <tr key={c.id} className="border-b border-[#F8F6F4] hover:bg-[#FAFAF9]">
                    <td className="px-5 py-3">
                      <div className="font-medium text-[#1A1816]">{c.phone || 'Unknown'}</div>
                      <div className="text-xs text-[#A8A29E]">{new Date(c.created_at).toLocaleString()}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${engine === 'agora' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {engine}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#44403C]">{c.llm_provider || '?'}</td>
                    <td className="px-5 py-3 font-mono"><LatencyBadge ms={lp.avg_ms} /></td>
                    <td className="px-5 py-3 font-mono"><LatencyBadge ms={lp.p50_ms} /></td>
                    <td className="px-5 py-3 font-mono"><LatencyBadge ms={lp.p95_ms} /></td>
                    <td className="px-5 py-3 font-mono text-[#78716C]">{lp.min_ms ?? '—'}ms</td>
                    <td className="px-5 py-3 font-mono text-[#78716C]">{lp.max_ms ?? '—'}ms</td>
                    <td className="px-5 py-3 text-center">{lp.samples ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Provider latency stats */}
      {providerStats.length > 0 && (
        <div className="mt-8 bg-white border border-[#E8E5E2] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDEA]">
            <h2 className="text-lg font-semibold text-[#1A1816]">Provider Latency History</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#78716C] text-xs uppercase tracking-wider border-b border-[#F0EDEA]">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">STT</th>
                <th className="px-5 py-3">LLM</th>
                <th className="px-5 py-3">TTS</th>
                <th className="px-5 py-3">Avg</th>
                <th className="px-5 py-3">P95</th>
                <th className="px-5 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {providerStats.map(p => (
                <tr key={p.id} className="border-b border-[#F8F6F4]">
                  <td className="px-5 py-3 text-xs text-[#A8A29E]">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3">{p.stt_provider || '—'}</td>
                  <td className="px-5 py-3">{p.llm_provider || '—'}</td>
                  <td className="px-5 py-3">{p.tts_provider || '—'}</td>
                  <td className="px-5 py-3 font-mono"><LatencyBadge ms={p.avg_ms} /></td>
                  <td className="px-5 py-3 font-mono"><LatencyBadge ms={p.p95_ms} /></td>
                  <td className="px-5 py-3">{p.duration_sec ? `${p.duration_sec}s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, unit, color }) {
  return (
    <div className="bg-white border border-[#E8E5E2] rounded-xl p-5">
      <div className="text-xs text-[#78716C] uppercase tracking-wider mb-2">{label}</div>
      <div className="text-3xl font-bold" style={{ color }}>{value ?? '—'}<span className="text-sm font-normal text-[#A8A29E] ml-1">{unit}</span></div>
    </div>
  )
}

function LatencyBadge({ ms }) {
  if (ms == null) return <span className="text-[#A8A29E]">—</span>
  const color = ms < 1000 ? 'text-emerald-600 bg-emerald-50' : ms < 2000 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{ms}ms</span>
}

function calcAvg(calls, field) {
  const vals = calls.map(c => ((c.metadata || {}).latency_profile || {})[field]).filter(v => v != null)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}
