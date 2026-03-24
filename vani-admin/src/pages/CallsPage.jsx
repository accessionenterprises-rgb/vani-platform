import { useEffect, useState } from 'react'
import { adminApi } from '../api/client'

const STATUS_COLORS = {
  completed:  'bg-emerald-50 text-emerald-700',
  active:     'bg-violet-50 text-violet-700',
  failed:     'bg-red-50 text-red-600',
  incoming:   'bg-amber-50 text-amber-700',
  routing:    'bg-amber-50 text-amber-700',
  connecting: 'bg-amber-50 text-amber-700',
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
          <h1 className="text-3xl font-bold text-gray-900">All Calls</h1>
          <p className="text-base text-gray-500 mt-1">{calls.length} results</p>
        </div>
      </div>

      <div className="mb-5">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-colors"
        >
          <option value="">All statuses</option>
          {['completed', 'active', 'failed', 'incoming', 'routing', 'connecting'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-gray-100">
              {['Workspace', 'Agent', 'Phone', 'Direction', 'Status', 'Duration', 'Date'].map(h => (
                <th key={h} className="text-left text-sm font-medium text-gray-500 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading…</td></tr>
            ) : calls.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No calls found</td></tr>
            ) : calls.map(c => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-sm">{c.tenants?.name || c.tenant_id?.slice(0, 8)}</td>
                <td className="px-4 py-3 text-gray-900 text-sm">{c.agents?.name || '—'}</td>
                <td className="px-4 py-3 font-mono text-gray-700 text-sm">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500 capitalize text-sm">{c.direction}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-500'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm">
                  {c.duration_sec ? `${Math.round(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm">
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
