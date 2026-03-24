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
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isActive = tenant?.active !== false

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-2 text-base text-gray-500 mb-6">
        <Link to="/tenants" className="hover:text-gray-700 transition-colors">Tenants</Link>
        <span>/</span>
        <span className="text-gray-900">{tenant.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{tenant.name}</h1>
            <p className="text-base text-gray-500 mt-0.5">{tenant.email}</p>
            <p className="text-sm text-gray-400 mt-1">ID: {tenant.id}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Open in dashboard */}
            <a
              href="https://dashboard.vani.live"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:text-gray-700 hover:bg-gray-200 transition-colors"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors"
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
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-base text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-colors"
            >
              {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* Active toggle */}
            <button
              onClick={toggleActive}
              disabled={saving}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600'
                  : 'bg-red-50 text-red-600 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              {isActive ? 'Active — click to disable' : 'Disabled — click to enable'}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Agents</p>
            <p className="text-3xl font-bold text-gray-900 mt-0.5">{tenant.agents?.length ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Recent calls</p>
            <p className="text-3xl font-bold text-gray-900 mt-0.5">{tenant.recent_calls?.length ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Phone numbers</p>
            <p className="text-3xl font-bold text-gray-900 mt-0.5">{tenant.phone_numbers?.length ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {['agents', 'calls', 'numbers'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-base font-medium transition-colors capitalize ${
              tab === t ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Agents tab */}
      {tab === 'agents' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {!tenant.agents?.length ? (
            <p className="text-gray-400 text-base p-6">No agents.</p>
          ) : (
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Name', 'Voice', 'LLM', 'STT', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-sm font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenant.agents.map(a => (
                  <tr key={a.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{a.voice || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{a.llm_provider || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{a.stt_provider || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        a.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {a.active !== false ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteAgent(a.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {!tenant.recent_calls?.length ? (
            <p className="text-gray-400 text-base p-6">No calls.</p>
          ) : (
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Phone', 'Direction', 'Status', 'Duration', 'Date'].map(h => (
                    <th key={h} className="text-left text-sm font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenant.recent_calls.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-900">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{c.direction}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                        c.status === 'active' ? 'bg-violet-50 text-violet-700' :
                        c.status === 'failed' ? 'bg-red-50 text-red-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.duration_sec ? `${Math.round(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {!tenant.phone_numbers?.length ? (
            <p className="text-gray-400 text-base p-6">No phone numbers.</p>
          ) : (
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Number', 'Provider', 'Status', 'SIP URI'].map(h => (
                    <th key={h} className="text-left text-sm font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenant.phone_numbers.map(n => (
                  <tr key={n.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-gray-900">{n.number}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{n.provider}</td>
                    <td className="px-4 py-3 text-gray-500">{n.status}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm truncate max-w-48">{n.sip_uri || '—'}</td>
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
