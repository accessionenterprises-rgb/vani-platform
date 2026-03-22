import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'

export default function LoginPage() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(secret)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid secret')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080a12]">
      <div className="w-full max-w-sm px-4">
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
            </svg>
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight">Vani</span>
            <span className="ml-2 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5">ADMIN</span>
          </div>
        </div>

        <div className="bg-[#0d0f1a] rounded-2xl border border-[#1a1d2e] p-8">
          <h1 className="text-lg font-semibold text-white mb-1">Admin access</h1>
          <p className="text-sm text-slate-500 mb-6">Enter your admin secret to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin secret</label>
              <input
                type="password"
                required
                autoFocus
                value={secret}
                onChange={e => setSecret(e.target.value)}
                className="w-full bg-[#080a12] border border-[#1a1d2e] hover:border-[#2a2d3e] focus:border-indigo-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                placeholder="••••••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Verifying…' : 'Access admin panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
