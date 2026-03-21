import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const STATUS_FILTERS = ['all', 'active', 'completed', 'failed', 'connecting']

export default function CallsPage() {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.listCalls({ limit: 100 })
      .then(setCalls)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? calls : calls.filter(c => c.status === filter)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-6xl">
        <div className="mb-7">
          <h1 className="text-xl font-semibold text-white">Calls</h1>
          <p className="text-sm text-slate-500 mt-0.5">{calls.length} total calls</p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-5 bg-[#12141f] border border-[#1f2235] rounded-lg p-1 w-fit">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === s ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="bg-[#12141f] rounded-xl border border-[#1f2235] overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-slate-600 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-600 text-sm">No calls found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f2235]">
                  {['Phone', 'Agent', 'Status', 'Direction', 'Duration', 'Started', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2235]">
                {filtered.map(call => (
                  <tr key={call.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-slate-200 font-medium">{call.phone || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{call.agent_id?.slice(0,8)}…</td>
                    <td className="px-5 py-3.5"><StatusBadge status={call.status} /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={call.direction} /></td>
                    <td className="px-5 py-3.5 text-slate-400">{call.duration_sec ? `${call.duration_sec}s` : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(call.started_at)}</td>
                    <td className="px-5 py-3.5">
                      <Link to={`/calls/${call.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
