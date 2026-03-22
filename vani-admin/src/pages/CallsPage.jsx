import { useEffect, useState } from 'react'
import { adminApi } from '../api/client'

const STATUS_COLORS = {
  completed:  'bg-emerald-500/15 text-emerald-400',
  active:     'bg-indigo-500/15 text-indigo-400',
  failed:     'bg-rose-500/15 text-rose-400',
  incoming:   'bg-amber-500/15 text-amber-400',
  routing:    'bg-amber-500/15 text-amber-400',
  connecting: 'bg-amber-500/15 text-amber-400',
}

export default function CallsPage() {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')

  async function load() {
    setLoading(true)
    const params = {}
    if (filterStatus) params.status = filterStatus
    params.limit = 100
    adminApi.listCalls(params).then(setCalls).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterStatus])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">All Calls</h1>
          <p className="text-sm text-slate-500 mt-1">{calls.length} results</p>
        </div>
      </div>

      <div className="mb-5">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">All statuses</option>
          {['completed', 'active', 'failed', 'incoming', 'routing', 'connecting'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1d2e]">
              {['Workspace', 'Agent', 'Phone', 'Direction', 'Status', 'Duration', 'Date'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-600">Loading…</td></tr>
            ) : calls.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-600">No calls found</td></tr>
            ) : calls.map(c => (
              <tr key={c.id} className="border-b border-[#1a1d2e] last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-slate-400 text-xs">{c.tenants?.name || c.tenant_id?.slice(0, 8)}</td>
                <td className="px-4 py-3 text-white text-xs">{c.agents?.name || '—'}</td>
                <td className="px-4 py-3 font-mono text-slate-300 text-xs">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-slate-400 capitalize text-xs">{c.direction}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] || 'bg-slate-500/15 text-slate-400'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {c.duration_sec ? `${Math.round(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
