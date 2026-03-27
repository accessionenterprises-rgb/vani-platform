import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../api/client'

export default function AgentsPage() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    adminApi.listAgents().then(setAgents).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = search
    ? agents.filter(a =>
        (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.tenants?.name || '').toLowerCase().includes(search.toLowerCase())
      )
    : agents

  async function toggleActive(agent) {
    try {
      await adminApi.updateAgent(agent.id, { active: !agent.active })
      setAgents(as => as.map(a => a.id === agent.id ? { ...a, active: !a.active } : a))
    } catch (e) { alert(e.message) }
  }

  async function doDelete(id) {
    try {
      await adminApi.deleteAgent(id)
      setAgents(as => as.filter(a => a.id !== id))
      setConfirmDelete(null)
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Agents</h1>
          <p className="text-base text-gray-500 mt-1">{filtered.length} agent{filtered.length !== 1 ? 's' : ''} across all workspaces</p>
        </div>
      </div>

      <div className="mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or workspace…"
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-900 placeholder-gray-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-colors w-64"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-gray-100">
              {['Agent', 'Workspace', 'Voice', 'LLM / STT', 'Language', 'Status', ''].map(h => (
                <th key={h} className="text-left text-sm font-medium text-gray-500 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No agents found</td></tr>
            ) : filtered.map(a => (
              <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{a.name}</p>
                  <p className="text-sm text-gray-400 font-mono mt-0.5">{a.id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/tenants/${a.tenant_id}`)}
                    className="text-violet-600 hover:text-violet-700 transition-colors text-sm"
                  >
                    {a.tenants?.name || a.tenant_id?.slice(0, 8)}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm">{a.voice || '—'}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-500 text-sm">{a.llm_provider || '—'}</p>
                  <p className="text-gray-400 text-sm">{a.stt_provider || '—'}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm uppercase">{a.language || 'en'}</td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => toggleActive(a)}
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                      a.active !== false ? 'bg-violet-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                      a.active !== false ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setConfirmDelete(a)}
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
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete agent?</h3>
            <p className="text-base text-gray-500 mb-5">
              <strong className="text-gray-900">{confirmDelete.name}</strong> will be permanently deleted along with its KB and tools.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-base hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={() => doDelete(confirmDelete.id)} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-base hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
