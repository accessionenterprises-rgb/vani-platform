import { Link } from 'react-router-dom'
import { useAgents } from '../hooks/useAgents'
import { useCalls } from '../hooks/useCalls'
import { useNumbers } from '../hooks/useNumbers'
import KPICard from '../components/shared/KPICard'
import Badge from '../components/shared/Badge'
import EmptyState from '../components/shared/EmptyState'
import { SkeletonCard } from '../components/shared/Skeleton'

export default function DashboardPage() {
  const { data: calls = [], isLoading: loadingCalls } = useCalls({ limit: 20 })
  const { data: agents = [], isLoading: loadingAgents } = useAgents()
  const { data: numbers = [] } = useNumbers()

  const loading = loadingCalls || loadingAgents
  const totalCalls  = calls.length
  const activeCalls = calls.filter(c => c.status === 'active').length
  const completed   = calls.filter(c => c.status === 'completed').length
  const avgDuration = calls.filter(c => c.duration_sec).reduce((s, c) => s + c.duration_sec, 0) / (completed || 1)
  const dismissChecklist = localStorage.getItem('vani_dismiss_checklist')

  return (
    <div className="flex flex-col min-h-full w-full px-6 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[26px] font-bold text-[#fafafa] tracking-[-0.02em]">Dashboard</h1>
          <p className="text-[13px] text-[#52525b] mt-0.5">Your voice AI at a glance</p>
        </div>
        <Link to="/agents/build" className="btn-primary press flex items-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Agent
        </Link>
      </div>

      {/* Onboarding checklist */}
      {!loading && !dismissChecklist && !(agents.length > 0 && numbers.length > 0 && calls.length > 0) && (
        <div className="mb-5 glass p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[rgba(139,92,246,0.10)] flex items-center justify-center">
                <svg className="w-4 h-4 text-[#8b5cf6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-[#fafafa]">Get started with Vani</h3>
                <p className="text-[12px] text-[#52525b]">Complete these steps to go live</p>
              </div>
            </div>
            <button onClick={() => { localStorage.setItem('vani_dismiss_checklist', '1'); location.reload() }} className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="space-y-2">
            {[
              { done: agents.length > 0, label: 'Create an agent', sub: agents.length > 0 ? `${agents.length} created` : 'Build your first voice AI agent', to: '/agents/build' },
              { done: numbers.length > 0, label: 'Get a phone number', sub: numbers.length > 0 ? `${numbers.length} active` : 'Buy or connect a phone number', to: '/numbers' },
              { done: calls.length > 0, label: 'Receive your first call', sub: calls.length > 0 ? `${calls.length} received` : 'Waiting for your first call' },
            ].map((step, i) => (
              <Link key={i} to={step.to || '#'}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                  step.done
                    ? 'bg-[rgba(139,92,246,0.06)] border border-[rgba(139,92,246,0.12)]'
                    : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] hover:border-[rgba(139,92,246,0.15)]'
                }`}>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-[#8b5cf6]' : 'border-[1.5px] border-[#52525b]'}`}>
                  {step.done && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div className="flex-1">
                  <p className={`text-[13px] font-medium ${step.done ? 'text-[#8b5cf6]' : 'text-[#fafafa]'}`}>{step.label}</p>
                  <p className="text-[11px] text-[#52525b]">{step.sub}</p>
                </div>
                {!step.done && step.to && <span className="text-[11px] font-semibold text-[#8b5cf6]">Start →</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Active call banner */}
      {activeCalls > 0 && (
        <div className="mb-5 glass rounded-xl p-4 flex items-center gap-4">
          <div className="flex items-end gap-[3px] h-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#fafafa]">{activeCalls} live call{activeCalls > 1 ? 's' : ''}</p>
            <p className="text-[12px] text-[#52525b]">Agents handling conversations</p>
          </div>
          <Link to="/calls?status=active" className="btn-ghost press text-[12px]">View live →</Link>
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 mb-5">
          <KPICard label="Total Calls" value={totalCalls} />
          <KPICard label="Active Now" value={activeCalls} pulse={activeCalls > 0} />
          <KPICard label="Completed" value={completed} />
          <KPICard label="Avg Duration" value={`${Math.round(avgDuration)}s`} />
        </div>
      )}

      {/* Main content — stretches to fill remaining space */}
      <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">

        {/* Recent Calls — 2 cols, fills height */}
        <div className="col-span-2 glass overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between shrink-0">
            <h2 className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-[0.04em]">Recent Calls</h2>
            <Link to="/calls" className="text-[12px] font-medium text-[#8b5cf6] hover:text-[#a78bfa] transition-colors">View all</Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 flex justify-center">
                <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : calls.length === 0 ? (
              <EmptyState title="No calls yet" description="Calls appear here once your agents go live" />
            ) : (
              <div>
                {calls.slice(0, 12).map((call, idx) => (
                  <Link key={call.id} to={`/calls?detail=${call.id}`}
                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(255,255,255,0.02)] transition-colors ${idx < Math.min(calls.length, 12) - 1 ? 'border-b border-[rgba(255,255,255,0.03)]' : ''}`}>
                    <div className="w-7 h-7 rounded-md bg-[rgba(255,255,255,0.04)] flex items-center justify-center shrink-0">
                      {call.status === 'active' ? (
                        <div className="flex items-end gap-[2px] h-3">
                          {[0,1,2].map(i => <div key={i} className="wave-bar" style={{ width: 2, animationDelay: `${i * 0.15}s` }} />)}
                        </div>
                      ) : (
                        <svg className="w-3 h-3 text-[#52525b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3"/></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#fafafa] font-medium truncate font-mono">{call.phone || 'Unknown'}</p>
                      <p className="text-[11px] text-[#52525b]">{agents.find(a => a.id === call.agent_id)?.name || '—'} · {fmtTime(call.started_at)}</p>
                    </div>
                    {call.duration_sec > 0 && <span className="text-[11px] text-[#52525b] font-mono">{fmtDur(call.duration_sec)}</span>}
                    <Badge status={call.status} pulse={call.status === 'active'} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — Agents + Quick Actions stacked */}
        <div className="col-span-1 flex flex-col gap-3 min-h-0">

          {/* Agents list — fills available space */}
          <div className="glass overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between shrink-0">
              <h2 className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-[0.04em]">Agents</h2>
              <Link to="/agents" className="text-[12px] font-medium text-[#8b5cf6] hover:text-[#a78bfa] transition-colors">Manage</Link>
            </div>
            <div className="flex-1 overflow-y-auto">
              {agents.length === 0 ? (
                <EmptyState title="No agents" action={() => window.location.href = '/agents/build'} actionLabel="Create agent" />
              ) : (
                <div>
                  {agents.map((a, idx) => (
                    <Link key={a.id} to={`/agents/${a.id}`}
                      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(255,255,255,0.02)] transition-colors ${idx < agents.length - 1 ? 'border-b border-[rgba(255,255,255,0.03)]' : ''}`}>
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        a.active ? 'bg-[rgba(139,92,246,0.12)] text-[#8b5cf6]' : 'bg-[rgba(255,255,255,0.04)] text-[#52525b]'
                      }`}>
                        {a.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[#fafafa] font-medium truncate">{a.name}</p>
                        <p className="text-[11px] text-[#52525b]">{a.llm_provider}</p>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ${a.active ? 'bg-[#8b5cf6]' : 'bg-[#52525b]'}`} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick actions — pinned at bottom */}
          <div className="flex flex-col gap-2 shrink-0">
            {[
              { to: '/agents/build', label: 'Build an Agent', desc: 'Voice or chatbot' },
              { to: '/numbers',      label: 'Get a Number',   desc: 'Twilio, Telnyx, Vobiz' },
              { to: '/campaigns',    label: 'Launch Campaign', desc: 'Outbound at scale' },
            ].map(a => (
              <Link key={a.to} to={a.to} className="group glass card-hover px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(139,92,246,0.08)] group-hover:bg-[rgba(139,92,246,0.12)] transition-colors shrink-0">
                  <svg className="w-3.5 h-3.5 text-[#8b5cf6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#fafafa] group-hover:text-[#8b5cf6] transition-colors">{a.label}</p>
                  <p className="text-[11px] text-[#52525b]">{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDur(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
