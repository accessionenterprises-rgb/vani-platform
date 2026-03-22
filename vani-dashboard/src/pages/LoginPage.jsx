import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register(form.name, form.email, form.password)
      }
      window.location.href = '/'
    } catch (err) {
      setError(err.message || (mode === 'login' ? 'Login failed' : 'Signup failed'))
    } finally {
      setLoading(false)
    }
  }

  function switchMode(m) {
    setMode(m)
    setError('')
    setForm({ name: '', email: '', password: '' })
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#080a12] px-4">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">Vani</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] bg-[#0d0f1a] border border-[#1a1d2e] rounded-2xl p-8">

        <h1 className="text-lg font-semibold text-white mb-1 text-center">
          {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
        </h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          {mode === 'login' ? 'Welcome back. Enter your details below.' : 'Get started with Vani in seconds.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Workspace name</label>
              <input type="text" required autoFocus={mode === 'signup'} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-[#080a12] border border-[#1f2235] hover:border-[#2a2d3e] focus:border-indigo-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                placeholder="Acme Inc." />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email address</label>
            <input type="email" required autoFocus={mode === 'login'} value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-[#080a12] border border-[#1f2235] hover:border-[#2a2d3e] focus:border-indigo-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-colors"
              placeholder="you@company.com" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <input type="password" required value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-[#080a12] border border-[#1f2235] hover:border-[#2a2d3e] focus:border-indigo-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-colors"
              placeholder="••••••••" />
          </div>

          {error && (
            <div className="bg-red-500/8 border border-red-500/20 rounded-lg px-3.5 py-2.5 text-xs text-red-400">
              {error}
              {mode === 'signup' && /already (been )?registered|already exists|email.*taken/i.test(error) && (
                <span className="ml-1">
                  <button type="button" onClick={() => switchMode('login')}
                    className="text-indigo-400 hover:text-indigo-300 underline">Sign in instead</button>
                </span>
              )}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-1">
            {loading
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>
      </div>

      {/* Switch mode */}
      <p className="text-sm text-slate-500 mt-5">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
          {mode === 'login' ? 'Create one' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
