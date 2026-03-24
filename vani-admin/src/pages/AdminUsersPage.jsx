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
        <p className="text-gray-500 text-base">Superadmin access required.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Users</h1>
          <p className="text-base text-gray-500 mt-1">Manage who can access the admin panel.</p>
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white text-base font-medium px-4 py-2 rounded-xl shadow-sm shadow-violet-200 transition-colors">
          <span className="text-lg leading-none">+</span> Add Admin
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">New Admin User</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Shiva Kumar"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-colors">
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Email</label>
                <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@vani.live"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Password</label>
                <input type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="min 8 characters"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-colors" />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-xl text-base shadow-sm shadow-violet-200 transition-colors">
                {saving ? 'Creating…' : 'Create Admin'}
              </button>
              <button type="button" onClick={() => { setAdding(false); setError('') }}
                className="text-gray-500 hover:text-gray-700 text-base px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {admins.map(admin => (
            <div key={admin.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                <span className="text-base font-semibold text-violet-700">
                  {(admin.name || admin.email)[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-900">{admin.name || '—'}</p>
                <p className="text-sm text-gray-500 mt-0.5">{admin.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  admin.role === 'superadmin'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {admin.role}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  admin.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {admin.active ? 'Active' : 'Disabled'}
                </span>
                {admin.last_login && (
                  <span className="text-sm text-gray-400 hidden sm:block">
                    Last: {new Date(admin.last_login).toLocaleDateString()}
                  </span>
                )}
                <button onClick={() => handleToggle(admin.id, admin.active)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2.5 py-1 rounded-xl hover:bg-gray-50 transition-colors">
                  {admin.active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => handleDelete(admin.id)}
                  className="text-sm text-red-400 hover:text-red-600 px-2.5 py-1 rounded-xl hover:bg-red-50 transition-colors">
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
