import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'

export default function DashboardPage() {
  const [calls, setCalls] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      import('../api/client').then(m => m.api.listCalls({ limit: 20 })),
      import('../api/client').then(m => m.api.listAgents()),
    ])
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
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="px-8 py-7 max-w-7xl">

        {/* Welcome header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Your voice AI at a glance</p>
          </div>
          <Link to="/agents/build"
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Agent
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Total Calls"
            value={totalCalls}
            icon={<PhoneOutIcon />}
            color="blue"
            trend={null}
          />
          <StatCard
            label="Active Now"
            value={activeCalls}
            icon={<WaveformIcon />}
            color="green"
            pulse={activeCalls > 0}
          />
          <StatCard
            label="Completed"
            value={completed}
            icon={<CheckCircleIcon />}
            color="gray"
          />
          <StatCard
            label="Avg Duration"
            value={`${Math.round(avgDuration)}s`}
            icon={<ClockIcon />}
            color="orange"
          />
        </div>

        {/* Active call banner */}
        {activeCalls > 0 && (
          <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="flex items-end gap-[3px] h-8">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-1 bg-green-500 rounded-full wave-bar" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">{activeCalls} call{activeCalls > 1 ? 's' : ''} in progress</p>
              <p className="text-xs text-green-600 mt-0.5">Your AI agents are handling conversations right now</p>
            </div>
            <Link to="/calls" className="text-xs font-medium text-green-700 hover:text-green-900 bg-green-100 hover:bg-green-200 px-3.5 py-1.5 rounded-lg transition-colors">
              View live
            </Link>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Recent Calls */}
          <div className="col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <PhoneOutIcon className="w-4 h-4 text-blue-500" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Recent Calls</h2>
              </div>
              <Link to="/calls" className="text-xs font-medium text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="p-10 text-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : calls.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <PhoneOutIcon className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-gray-400 text-sm">No calls yet</p>
                <p className="text-xs text-gray-300 mt-1">Waiting for first inbound call</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {calls.slice(0, 8).map(call => (
                  <Link key={call.id} to={`/calls/${call.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/80 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <PhoneOutIcon className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">{call.phone || 'Unknown'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {agents.find(a => a.id === call.agent_id)?.name || call.agent_id?.slice(0, 8)} · {formatTime(call.started_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {call.duration_sec && (
                        <span className="text-xs text-gray-400 font-mono">{formatDuration(call.duration_sec)}</span>
                      )}
                      <StatusBadge status={call.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Agents panel */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <BotIcon className="w-4 h-4 text-violet-500" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Agents</h2>
              </div>
              <Link to="/agents" className="text-xs font-medium text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                Manage
              </Link>
            </div>
            {agents.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <BotIcon className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-gray-400 text-sm mb-3">No agents yet</p>
                <Link to="/agents/build"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-600">
                  + Create your first agent
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {agents.map(a => (
                  <Link key={a.id} to={`/agents/${a.id}`}
                    className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50/80 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      a.active ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {a.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">{a.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.language?.toUpperCase()} · {a.llm_provider}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.agent_type === 'chatbot' && (
                        <span className="text-[9px] font-medium text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">Chat</span>
                      )}
                      <div className={`w-2 h-2 rounded-full ${a.active ? 'bg-green-400' : 'bg-gray-300'}`} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-5 mt-6">
          <QuickAction
            to="/agents/build"
            icon={<BotIcon className="w-5 h-5" />}
            label="Build an Agent"
            desc="Create a new voice or chatbot agent"
            color="blue"
          />
          <QuickAction
            to="/numbers"
            icon={<HashIcon className="w-5 h-5" />}
            label="Get a Number"
            desc="Buy or sync phone numbers"
            color="green"
          />
          <QuickAction
            to="/campaigns"
            icon={<MegaphoneIcon className="w-5 h-5" />}
            label="Launch Campaign"
            desc="Start an outbound calling campaign"
            color="orange"
          />
        </div>
      </div>
    </div>
  )
}


// ─── Components ──────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, pulse }) {
  const bg = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    gray: 'bg-gray-50',
    orange: 'bg-orange-50',
  }
  const text = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    gray: 'text-gray-600',
    orange: 'text-orange-600',
  }
  const iconColor = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    gray: 'text-gray-400',
    orange: 'text-orange-400',
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${bg[color]} flex items-center justify-center`}>
          <span className={iconColor[color]}>{icon}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className={`text-3xl font-semibold ${text[color]}`}>{value}</p>
        {pulse && <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"/>
        </span>}
      </div>
    </div>
  )
}

function QuickAction({ to, icon, label, desc, color }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-500 group-hover:bg-blue-100',
    green:  'bg-green-50 text-green-500 group-hover:bg-green-100',
    orange: 'bg-orange-50 text-orange-500 group-hover:bg-orange-100',
  }
  return (
    <Link to={to} className="group bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-gray-300 transition-all flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </Link>
  )
}

function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function PhoneOutIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73A16 16 0 0 0 15.27 16.09l1.92-1.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}

function WaveformIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="8" x2="4" y2="16"/>
      <line x1="8" y1="4" x2="8" y2="20"/>
      <line x1="12" y1="6" x2="12" y2="18"/>
      <line x1="16" y1="4" x2="16" y2="20"/>
      <line x1="20" y1="8" x2="20" y2="16"/>
    </svg>
  )
}

function CheckCircleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}

function ClockIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

function BotIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/>
      <line x1="8" y1="16" x2="8" y2="16" strokeWidth="3" strokeLinecap="round"/>
      <line x1="16" y1="16" x2="16" y2="16" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

function HashIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  )
}

function MegaphoneIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l19-9-9 19-2-8-8-2z"/>
    </svg>
  )
}
