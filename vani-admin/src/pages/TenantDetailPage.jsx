import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { adminApi } from '../api/client'

const PLANS = ['starter', 'growth', 'enterprise']

export default function TenantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('agents')

  useEffect(() => {
    adminApi.getTenant(id)
      .then(setTenant)
      .catch(e => { alert(e.message); navigate('/tenants') })
      .finally(() => setLoading(false))
  }, [id])

  async function toggleActive() {
    setSaving(true)
    try {
      const updated = await adminApi.updateTenant(id, { active: !tenant.active })
      setTenant(prev => ({ ...prev, active: updated.active }))
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function changePlan(plan) {
    setSaving(true)
    try {
      const updated = await adminApi.updateTenant(id, { plan })
      setTenant(prev => ({ ...prev, plan: updated.plan }))
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function impersonate() {
    setSaving(true)
    try {
      const data = await adminApi.impersonate(id)
      if (data.magic_link) {
        window.open(data.magic_link, '_blank')
      } else {
        alert(`Open dashboard.vani.live and log in as ${data.email}`)
      }
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function deleteAgent(agentId) {
    if (!confirm('Delete this agent?')) return
    try {
      await adminApi.deleteAgent(agentId)
      setTenant(prev => ({ ...prev, agents: prev.agents.filter(a => a.id !== agentId) }))
    } catch (e) { alert(e.message) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isActive = tenant?.active !== false

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/tenants" className="hover:text-slate-300 transition-colors">Tenants</Link>
        <span>/</span>
        <span className="text-white">{tenant.name}</span>
      </div>

      {/* Header */}
      <div className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">{tenant.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{tenant.email}</p>
            <p className="text-xs text-slate-600 mt-1">ID: {tenant.id}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Open in dashboard */}
            <a
              href="https://dashboard.vani.live"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-[#1a1d2e] hover:text-white hover:bg-[#2a2d3e] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Dashboard
            </a>

            {/* Impersonate */}
            <button
              onClick={impersonate}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Impersonate
            </button>

            {/* Plan selector */}
            <select
              value={tenant.plan || 'starter'}
              disabled={saving}
              onChange={e => changePlan(e.target.value)}
              className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
            >
              {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* Active toggle */}
            <button
              onClick={toggleActive}
              disabled={saving}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 hover:bg-rose-500/15 hover:text-rose-400'
                  : 'bg-rose-500/15 text-rose-400 hover:bg-emerald-500/15 hover:text-emerald-400'
              }`}
            >
              {isActive ? 'Active — click to disable' : 'Disabled — click to enable'}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#1a1d2e]">
          <div>
            <p className="text-xs text-slate-500">Agents</p>
            <p className="text-2xl font-bold text-white mt-0.5">{tenant.agents?.length ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Recent calls</p>
            <p className="text-2xl font-bold text-white mt-0.5">{tenant.recent_calls?.length ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Phone numbers</p>
            <p className="text-2xl font-bold text-white mt-0.5">{tenant.phone_numbers?.length ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#0d0f1a] border border-[#1a1d2e] p-1 rounded-xl w-fit">
        {['agents', 'calls', 'numbers'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Agents tab */}
      {tab === 'agents' && (
        <div className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl overflow-hidden">
          {!tenant.agents?.length ? (
            <p className="text-slate-600 text-sm p-6">No agents.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1d2e]">
                  {['Name', 'Voice', 'LLM', 'STT', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenant.agents.map(a => (
                  <tr key={a.id} className="border-b border-[#1a1d2e] last:border-0">
                    <td className="px-4 py-3 font-medium text-white">{a.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{a.voice || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{a.llm_provider || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{a.stt_provider || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        a.active !== false ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'
                      }`}>
                        {a.active !== false ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteAgent(a.id)}
                        className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Calls tab */}
      {tab === 'calls' && (
        <div className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl overflow-hidden">
          {!tenant.recent_calls?.length ? (
            <p className="text-slate-600 text-sm p-6">No calls.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1d2e]">
                  {['Phone', 'Direction', 'Status', 'Duration', 'Date'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenant.recent_calls.map(c => (
                  <tr key={c.id} className="border-b border-[#1a1d2e] last:border-0">
                    <td className="px-4 py-3 text-white">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{c.direction}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        c.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                        c.status === 'active' ? 'bg-indigo-500/15 text-indigo-400' :
                        c.status === 'failed' ? 'bg-rose-500/15 text-rose-400' :
                        'bg-slate-500/15 text-slate-400'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {c.duration_sec ? `${Math.round(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Numbers tab */}
      {tab === 'numbers' && (
        <div className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl overflow-hidden">
          {!tenant.phone_numbers?.length ? (
            <p className="text-slate-600 text-sm p-6">No phone numbers.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1d2e]">
                  {['Number', 'Provider', 'Status', 'SIP URI'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenant.phone_numbers.map(n => (
                  <tr key={n.id} className="border-b border-[#1a1d2e] last:border-0">
                    <td className="px-4 py-3 font-mono text-white">{n.number}</td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{n.provider}</td>
                    <td className="px-4 py-3 text-slate-400">{n.status}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-48">{n.sip_uri || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
