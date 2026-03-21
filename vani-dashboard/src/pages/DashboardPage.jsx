import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import StatusBadge from '../components/StatusBadge'

export default function DashboardPage() {
  const [calls, setCalls] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.listCalls({ limit: 20 }), api.listAgents()])
      .then(([c, a]) => { setCalls(c || []); setAgents(a || []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const totalCalls   = calls.length
  const activeCalls  = calls.filter(c => c.status === 'active').length
  const completed    = calls.filter(c => c.status === 'completed').length
  const failed       = calls.filter(c => c.status === 'failed').length
  const avgDuration  = calls.filter(c => c.duration_sec).reduce((s, c) => s + c.duration_sec, 0) / (completed || 1)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-7xl">
        <div className="mb-7">
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your voice AI at a glance</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Calls" value={totalCalls} color="indigo" />
          <StatCard label="Active Now" value={activeCalls} color="emerald" pulse={activeCalls > 0} />
          <StatCard label="Completed" value={completed} color="slate" />
          <StatCard label="Avg Duration" value={`${Math.round(avgDuration)}s`} color="slate" />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Recent Calls */}
          <div className="col-span-2 bg-[#12141f] rounded-xl border border-[#1f2235]">
            <div className="px-5 py-4 border-b border-[#1f2235] flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Recent Calls</h2>
              <Link to="/calls" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</Link>
            </div>
            {loading ? (
              <div className="p-8 text-center text-slate-600 text-sm">Loading…</div>
            ) : calls.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-600 text-sm">No calls yet. Waiting for first inbound call.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1f2235]">
                {calls.slice(0, 8).map(call => (
                  <Link key={call.id} to={`/calls/${call.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 font-medium truncate">{call.phone || 'Unknown'}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {call.agent_id?.slice(0, 8)} · {formatTime(call.started_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {call.duration_sec && (
                        <span className="text-xs text-slate-500">{call.duration_sec}s</span>
                      )}
                      <StatusBadge status={call.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Agents */}
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235]">
            <div className="px-5 py-4 border-b border-[#1f2235] flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Agents</h2>
              <Link to="/agents" className="text-xs text-indigo-400 hover:text-indigo-300">Manage →</Link>
            </div>
            {agents.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-slate-600 text-sm mb-3">No agents yet.</p>
                <Link to="/agents/new"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300">
                  + Create your first agent
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#1f2235]">
                {agents.map(a => (
                  <Link key={a.id} to={`/agents/${a.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                      {a.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 font-medium truncate">{a.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{a.language?.toUpperCase()} · {a.llm_provider}</p>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full ${a.active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, pulse }) {
  const colors = {
    indigo: 'text-indigo-400',
    emerald: 'text-emerald-400',
    slate: 'text-slate-200',
  }
  return (
    <div className="bg-[#12141f] rounded-xl border border-[#1f2235] px-5 py-4">
      <p className="text-xs text-slate-500 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`text-2xl font-semibold ${colors[color]}`}>{value}</p>
        {pulse && <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"/>
        </span>}
      </div>
    </div>
  )
}

function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
