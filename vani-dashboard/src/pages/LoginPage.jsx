import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
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
      navigate('/')
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
    <div className="min-h-screen flex bg-[#080a12]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex w-[480px] flex-shrink-0 flex-col justify-between p-12 bg-[#0d0f1a] border-r border-[#1a1d2e]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
            </svg>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Vani</span>
        </div>

        <div>
          <p className="text-3xl font-semibold text-white leading-snug mb-4">
            Low-latency Voice AI<br />built for real-time<br />conversations.
          </p>
          <p className="text-sm text-slate-500 leading-relaxed">
            Deploy intelligent voice agents in minutes. Multi-tenant, provider-agnostic, and built to scale.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Sub-600ms latency', desc: 'STT → LLM → TTS pipeline' },
            { label: 'Multi-provider', desc: 'Deepgram, OpenAI, Sarvam and more' },
            { label: 'Multi-tenant', desc: 'Isolated agents per workspace' },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-4 h-4 mt-0.5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">{label}</p>
                <p className="text-xs text-slate-600">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
            </svg>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Vani</span>
        </div>

        <div className="w-full max-w-[360px]">
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-[#0d0f1a] border border-[#1a1d2e] p-1 mb-8">
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === m
                    ? 'bg-indigo-500 text-white shadow shadow-indigo-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <div>
            <h1 className="text-xl font-semibold text-white mb-1">
              {mode === 'login' ? 'Welcome back' : 'Get started'}
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              {mode === 'login'
                ? 'Enter your credentials to continue.'
                : 'Create your Vani workspace in seconds.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Workspace name
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus={mode === 'signup'}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-[#0d0f1a] border border-[#1a1d2e] hover:border-[#2a2d3e] focus:border-indigo-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                    placeholder="Acme Inc."
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoFocus={mode === 'login'}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-[#0d0f1a] border border-[#1a1d2e] hover:border-[#2a2d3e] focus:border-indigo-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-[#0d0f1a] border border-[#1a1d2e] hover:border-[#2a2d3e] focus:border-indigo-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                  <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div>
                    <p className="text-xs text-red-400 leading-relaxed">{error}</p>
                    {mode === 'signup' && /already (been )?registered|already exists|email.*taken/i.test(error) && (
                      <p className="text-xs text-slate-500 mt-1">
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('login')}
                          className="text-indigo-400 hover:text-indigo-300 transition-colors underline"
                        >
                          Sign in instead
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors shadow shadow-indigo-500/20 mt-2"
              >
                {loading
                  ? (mode === 'login' ? 'Signing in…' : 'Creating workspace…')
                  : (mode === 'login' ? 'Sign in' : 'Create workspace')}
              </button>
            </form>

            <p className="text-center text-xs text-slate-600 mt-6">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
