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
                  {['Phone', 'Agent', 'Status', 'Direction', 'Duration', 'Started', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-sm font-medium text-[#A8A29E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDEA]">
                {pageData.map(call => (
                  <tr key={call.id} className="hover:bg-[#FAFAF9] transition-colors">
                    <td className="px-5 py-3.5 text-[#44403C] font-medium">{call.phone || '—'}</td>
                    <td className="px-5 py-3.5 text-[#A8A29E] font-mono text-sm">{call.agent_id?.slice(0,8)}…</td>
                    <td className="px-5 py-3.5"><StatusBadge status={call.status} /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={call.direction} /></td>
                    <td className="px-5 py-3.5 text-[#78716C]">{call.duration_sec ? `${call.duration_sec}s` : '—'}</td>
                    <td className="px-5 py-3.5 text-[#A8A29E] text-sm">{formatDate(call.started_at)}</td>
                    <td className="px-5 py-3.5">
                      <Link to={`/calls/${call.id}`} className="text-sm text-[#2563EB] hover:text-[#3B82F6]">
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
