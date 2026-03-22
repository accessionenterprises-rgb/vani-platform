import { useEffect, useState } from 'react'
import { adminApi } from '../api/client'
import { useAdminAuth } from '../context/AdminAuthContext'

export default function AdminUsersPage() {
  const { adminUser } = useAdminAuth()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'admin' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminApi.listAdmins().then(setAdmins).catch(console.error).finally(() => setLoading(false))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const created = await adminApi.createAdmin(form)
      setAdmins(a => [created, ...a])
      setAdding(false)
      setForm({ email: '', password: '', name: '', role: 'admin' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this admin user?')) return
    await adminApi.deleteAdmin(id).catch(console.error)
    setAdmins(a => a.filter(x => x.id !== id))
  }

  async function handleToggle(id, active) {
    await adminApi.updateAdmin(id, { active: !active }).catch(console.error)
    setAdmins(a => a.map(x => x.id === id ? { ...x, active: !active } : x))
  }

  if (adminUser?.role !== 'superadmin') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Superadmin access required.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Admin Users</h1>
          <p className="text-sm text-slate-500 mt-1">Manage who can access the admin panel.</p>
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <span className="text-lg leading-none">+</span> Add Admin
        </button>
      </div>

      {adding && (
        <div className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl p-6 mb-5">
          <h2 className="text-sm font-semibold text-white mb-5">New Admin User</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Shiva Kumar"
                  className="w-full bg-[#080a12] border border-[#1a1d2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-[#080a12] border border-[#1a1d2e] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@vani.live"
                  className="w-full bg-[#080a12] border border-[#1a1d2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <input type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="min 8 characters"
                  className="w-full bg-[#080a12] border border-[#1a1d2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">
                {saving ? 'Creating…' : 'Create Admin'}
              </button>
              <button type="button" onClick={() => { setAdding(false); setError('') }}
                className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl divide-y divide-[#1a1d2e]">
          {admins.map(admin => (
            <div key={admin.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-indigo-400">
                  {(admin.name || admin.email)[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{admin.name || '—'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{admin.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  admin.role === 'superadmin'
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-slate-500/15 text-slate-400'
                }`}>
                  {admin.role}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  admin.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-500'
                }`}>
                  {admin.active ? 'Active' : 'Disabled'}
                </span>
                {admin.last_login && (
                  <span className="text-xs text-slate-600 hidden sm:block">
                    Last: {new Date(admin.last_login).toLocaleDateString()}
                  </span>
                )}
                <button onClick={() => handleToggle(admin.id, admin.active)}
                  className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg hover:bg-white/5 transition-colors">
                  {admin.active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => handleDelete(admin.id)}
                  className="text-xs text-red-400/60 hover:text-red-400 px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
