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

  const totalCalls  = calls.length
  const activeCalls = calls.filter(c => c.status === 'active').length
  const completed   = calls.filter(c => c.status === 'completed').length
  const avgDuration = calls.filter(c => c.duration_sec).reduce((s, c) => s + c.duration_sec, 0) / (completed || 1)

  return (
    <div className="flex-1 overflow-auto bg-[#FAFAF9]">
      <div className="px-8 py-8 max-w-[1200px]">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[30px] font-bold text-[#1A1816] tracking-[-0.02em]">Dashboard</h1>
            <p className="text-[16px] text-[#A8A29E] mt-0.5 font-medium">Your voice AI at a glance</p>
          </div>
          <Link to="/agents/build"
            className="press flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[16px] font-semibold px-5 py-2.5 rounded-[10px] shadow-sm shadow-blue-200 transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Agent
          </Link>
        </div>

        {/* Active call banner */}
        {activeCalls > 0 && (
          <div className="mb-6 bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-5 flex items-center gap-5">
            <div className="flex items-end gap-[3px] h-7">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-[3px] bg-[#16A34A] rounded-full wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-bold text-[#15803D]">{activeCalls} live call{activeCalls > 1 ? 's' : ''}</p>
              <p className="text-[15px] text-[#16A34A]/70 mt-0.5">Your agents are handling conversations</p>
            </div>
            <Link to="/calls" className="press text-[15px] font-semibold text-[#15803D] bg-white border border-[#BBF7D0] px-4 py-1.5 rounded-lg hover:bg-[#F0FDF4] transition-all">
              View live →
            </Link>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Calls', value: totalCalls, icon: '📞', bg: '#EFF4FF', color: '#2563EB' },
            { label: 'Active Now', value: activeCalls, icon: '🎙️', bg: '#F0FDF4', color: '#16A34A', pulse: activeCalls > 0 },
            { label: 'Completed', value: completed, icon: '✓', bg: '#F5F5F4', color: '#44403C' },
            { label: 'Avg Duration', value: `${Math.round(avgDuration)}s`, icon: '⏱', bg: '#FFF7ED', color: '#EA580C' },
          ].map((s, i) => (
            <div key={i} className="card-hover bg-white rounded-2xl border border-[#E8E5E2] px-5 py-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[14px] font-semibold text-[#A8A29E] uppercase tracking-[0.06em]">{s.label}</span>
                <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-base" style={{ background: s.bg }}>
                  {s.icon === '✓'
                    ? <svg className="w-4 h-4" style={{ color: s.color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : s.icon}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-[40px] font-bold tracking-[-0.03em]" style={{ color: s.color }}>{s.value}</span>
                {s.pulse && <span className="relative flex h-2 w-2 mb-2"><span className="animate-ping absolute h-full w-full rounded-full bg-[#16A34A] opacity-60"/><span className="relative h-2 w-2 rounded-full bg-[#16A34A]"/></span>}
              </div>
            </div>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-5 gap-5">

          {/* Recent Calls — 3 cols */}
          <div className="col-span-3 bg-white rounded-2xl border border-[#E8E5E2] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EDEA] flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#1A1816]">Recent Calls</h2>
              <Link to="/calls" className="press text-[14px] font-semibold text-[#2563EB] bg-[#EFF4FF] hover:bg-[#DBEAFE] px-3 py-1 rounded-md transition-colors">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : calls.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F5F5F4] flex items-center justify-center mx-auto mb-3 text-2xl">📞</div>
                <p className="text-[16px] text-[#78716C] font-medium">No calls yet</p>
                <p className="text-[14px] text-[#A8A29E] mt-1">Waiting for your first inbound call</p>
              </div>
            ) : (
              <div>
                {calls.slice(0, 7).map((call, idx) => (
                  <Link key={call.id} to={`/calls/${call.id}`}
                    className={`flex items-center gap-4 px-5 py-3 hover:bg-[#FAFAF9] transition-colors ${idx < calls.slice(0,7).length - 1 ? 'border-b border-[#F5F5F4]' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-[#F5F5F4] flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-[#A8A29E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 7.36 7.36l1.91-1.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] text-[#1A1816] font-semibold truncate">{call.phone || 'Unknown'}</p>
                      <p className="text-[14px] text-[#A8A29E] mt-0.5">
                        {agents.find(a => a.id === call.agent_id)?.name || '—'} · {fmtTime(call.started_at)}
                      </p>
                    </div>
                    {call.duration_sec > 0 && (
                      <span className="text-[14px] text-[#A8A29E] font-mono tabular-nums">{fmtDur(call.duration_sec)}</span>
                    )}
                    <StatusBadge status={call.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Agents — 2 cols */}
          <div className="col-span-2 bg-white rounded-2xl border border-[#E8E5E2] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0EDEA] flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#1A1816]">Agents</h2>
              <Link to="/agents" className="press text-[14px] font-semibold text-[#2563EB] bg-[#EFF4FF] hover:bg-[#DBEAFE] px-3 py-1 rounded-md transition-colors">
                Manage
              </Link>
            </div>
            {agents.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F5F5F4] flex items-center justify-center mx-auto mb-3 text-2xl">🤖</div>
                <p className="text-[16px] text-[#78716C] font-medium mb-3">No agents yet</p>
                <Link to="/agents/build" className="press inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#2563EB]">
                  + Create your first agent
                </Link>
              </div>
            ) : (
              <div>
                {agents.map((a, idx) => (
                  <Link key={a.id} to={`/agents/${a.id}`}
                    className={`flex items-center gap-3 px-5 py-3 hover:bg-[#FAFAF9] transition-colors ${idx < agents.length - 1 ? 'border-b border-[#F5F5F4]' : ''}`}>
                    <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center text-[14px] font-bold shrink-0 ${
                      a.active ? 'bg-[#EFF4FF] text-[#2563EB]' : 'bg-[#F5F5F4] text-[#A8A29E]'
                    }`}>
                      {a.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] text-[#1A1816] font-semibold truncate">{a.name}</p>
                      <p className="text-[14px] text-[#A8A29E] mt-0.5">{a.language?.toUpperCase()} · {a.llm_provider}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.agent_type === 'chatbot' && (
                        <span className="text-[10px] font-bold text-[#7C3AED] bg-[#F5F3FF] px-1.5 py-0.5 rounded">CHAT</span>
                      )}
                      <div className={`w-[6px] h-[6px] rounded-full ${a.active ? 'bg-[#16A34A]' : 'bg-[#D6D3D1]'}`} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { to: '/agents/build', icon: '🤖', label: 'Build an Agent', desc: 'Voice or chatbot, guided setup', color: '#EFF4FF' },
            { to: '/numbers',      icon: '📱', label: 'Get a Number',   desc: 'Buy from Twilio or Telnyx',   color: '#F0FDF4' },
            { to: '/campaigns',    icon: '🚀', label: 'Launch Campaign', desc: 'Outbound calling at scale',    color: '#FFF7ED' },
          ].map(a => (
            <Link key={a.to} to={a.to} className="group card-hover bg-white rounded-2xl border border-[#E8E5E2] p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105" style={{ background: a.color }}>
                {a.icon}
              </div>
              <div>
                <p className="text-[16px] font-bold text-[#1A1816] group-hover:text-[#2563EB] transition-colors">{a.label}</p>
                <p className="text-[14px] text-[#A8A29E] mt-0.5">{a.desc}</p>
              </div>
            </Link>
          ))}
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
