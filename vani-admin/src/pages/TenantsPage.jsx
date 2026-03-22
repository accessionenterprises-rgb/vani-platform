import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../api/client'

const PLANS = ['starter', 'growth', 'enterprise']

function planBadge(plan) {
  const colors = {
    starter:    'bg-slate-500/15 text-slate-400',
    growth:     'bg-indigo-500/15 text-indigo-400',
    enterprise: 'bg-amber-500/15 text-amber-400',
  }
  return (
    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${colors[plan] || colors.starter}`}>
      {plan}
    </span>
  )
}

export default function TenantsPage() {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [updating, setUpdating] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const params = {}
      if (filterPlan) params.plan = filterPlan
      if (filterActive !== '') params.active = filterActive === 'true'
      if (search) params.search = search
      const data = await adminApi.listTenants(params)
      setTenants(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterPlan, filterActive])

  const filtered = search
    ? tenants.filter(t =>
        (t.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : tenants

  async function toggleActive(tenant) {
    setUpdating(tenant.id)
    try {
      await adminApi.updateTenant(tenant.id, { active: !tenant.active })
      setTenants(ts => ts.map(t => t.id === tenant.id ? { ...t, active: !t.active } : t))
    } catch (e) {
      alert(e.message)
    } finally {
      setUpdating(null)
    }
  }

  async function changePlan(tenant, plan) {
    setUpdating(tenant.id)
    try {
      await adminApi.updateTenant(tenant.id, { plan })
      setTenants(ts => ts.map(t => t.id === tenant.id ? { ...t, plan } : t))
    } catch (e) {
      alert(e.message)
    } finally {
      setUpdating(null)
    }
  }

  async function deleteTenant(id) {
    try {
      await adminApi.deleteTenant(id)
      setTenants(ts => ts.filter(t => t.id !== id))
      setConfirmDelete(null)
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Tenants</h1>
          <p className="text-sm text-slate-500 mt-1">{filtered.length} workspace{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors w-56"
        />
        <select
          value={filterPlan}
          onChange={e => setFilterPlan(e.target.value)}
          className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">All plans</option>
          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterActive}
          onChange={e => setFilterActive(e.target.value)}
          className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1d2e]">
              {['Workspace', 'Plan', 'Agents', 'Calls', 'Joined', 'Status', ''].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-600">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-600">No tenants found</td></tr>
            ) : filtered.map(t => (
              <tr
                key={t.id}
                className="border-b border-[#1a1d2e] last:border-0 hover:bg-white/[0.02] cursor-pointer"
                onClick={() => navigate(`/tenants/${t.id}`)}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{t.name || '—'}</p>
                  <p className="text-xs text-slate-500">{t.email}</p>
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <select
                    value={t.plan || 'starter'}
                    disabled={updating === t.id}
                    onChange={e => changePlan(t, e.target.value)}
                    className="bg-transparent text-xs text-slate-300 border-0 outline-none cursor-pointer"
                  >
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-slate-400">{t.agent_count ?? 0}</td>
                <td className="px-4 py-3 text-slate-400">{t.call_count ?? 0}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => toggleActive(t)}
                    disabled={updating === t.id}
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus:outline-none ${
                      t.active !== false ? 'bg-indigo-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                        t.active !== false ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setConfirmDelete(t)}
                    className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-2">Delete tenant?</h3>
            <p className="text-sm text-slate-400 mb-5">
              <strong className="text-white">{confirmDelete.name}</strong> ({confirmDelete.email}) and all their agents, calls, and data will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-[#1a1d2e] text-slate-300 py-2 rounded-lg text-sm hover:bg-[#2a2d3e] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTenant(confirmDelete.id)}
                className="flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm hover:bg-rose-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
