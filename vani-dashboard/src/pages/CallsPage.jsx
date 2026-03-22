import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const STATUS_FILTERS = ['all', 'active', 'completed', 'failed', 'connecting']
const PAGE_SIZE = 25

export default function CallsPage() {
  const [calls, setCalls]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  function load() {
    api.listCalls({ limit: 200 })
      .then(setCalls)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

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

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-6xl">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-semibold text-white">Calls</h1>
            <p className="text-sm text-slate-500 mt-0.5">{calls.length} total calls</p>
          </div>
          <button onClick={load}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 bg-[#12141f] border border-[#1f2235] px-3 py-1.5 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-[#12141f] border border-[#1f2235] rounded-lg p-1">
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setFilterReset(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === s ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                }`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <svg className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearchReset(e.target.value)}
              placeholder="Search by phone…"
              className="pl-8 pr-3 py-1.5 bg-[#12141f] border border-[#1f2235] rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 w-52"
            />
          </div>
        </div>

        <div className="bg-[#12141f] rounded-xl border border-[#1f2235] overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-slate-600 text-sm">Loading…</div>
          ) : pageData.length === 0 ? (
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
                {pageData.map(call => (
                  <tr key={call.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-slate-200 font-medium">{call.phone || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{call.agent_id?.slice(0,8)}…</td>
                    <td className="px-5 py-3.5"><StatusBadge status={call.status} /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={call.direction} /></td>
                    <td className="px-5 py-3.5 text-slate-400">{call.duration_sec ? `${call.duration_sec}s` : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(call.started_at)}</td>
                    <td className="px-5 py-3.5">
                      <Link to={`/calls/${call.id}`} className="text-xs text-indigo-400 hover:text-indigo-300">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-[#12141f] border border-[#1f2235] rounded-lg disabled:opacity-40 transition-colors">
                ← Prev
              </button>
              <span className="text-xs text-slate-500">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-[#12141f] border border-[#1f2235] rounded-lg disabled:opacity-40 transition-colors">
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
