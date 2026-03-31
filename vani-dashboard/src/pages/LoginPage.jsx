import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth()
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [mode, setMode] = useState('login')
  const savedEmail = localStorage.getItem('vani_remember_email') || ''
  const [form, setForm] = useState({ name: '', email: savedEmail, password: '' })
  const [remember, setRemember] = useState(!!savedEmail)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (remember) localStorage.setItem('vani_remember_email', form.email)
      else localStorage.removeItem('vani_remember_email')
      if (mode === 'login') await login(form.email, form.password)
      else await register(form.name, form.email, form.password)
      window.location.href = '/'
    } catch (err) {
      setError(err.message || (mode === 'login' ? 'Login failed' : 'Signup failed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    try { await loginWithGoogle() }
    catch (err) { setError(err.message || 'Google login failed'); setGoogleLoading(false) }
  }

  function switchMode(m) {
    setMode(m)
    setError('')
    setForm({ name: '', email: savedEmail, password: '' })
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 relative"
      style={{ background: 'var(--bg)', transition: 'background 0.2s ease' }}>

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: isLight
          ? `radial-gradient(ellipse 500px 400px at 50% 40%, rgba(124,58,237,0.07) 0%, transparent 70%),
             radial-gradient(ellipse 300px 300px at 30% 70%, rgba(124,58,237,0.04) 0%, transparent 60%)`
          : `radial-gradient(ellipse 500px 400px at 50% 40%, rgba(139,92,246,0.08) 0%, transparent 70%),
             radial-gradient(ellipse 300px 300px at 30% 70%, rgba(139,92,246,0.04) 0%, transparent 60%)`
      }} />

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 relative z-10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center shadow-lg"
          style={{ boxShadow: '0 4px 20px rgba(139,92,246,0.30)' }}>
          <svg viewBox="0 0 24 24" className="w-[16px] h-[16px] text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 8v8"/><path d="M7 5v14"/><path d="M11 2v20"/><path d="M15 6v12"/><path d="M19 9v6"/>
          </svg>
        </div>
        <span className="text-[24px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Vani</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] relative z-10 rounded-2xl p-8"
        style={{
          background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          border: `1px solid ${isLight ? 'rgba(100,80,200,0.10)' : 'rgba(255,255,255,0.07)'}`,
          boxShadow: isLight
            ? '0 4px 24px rgba(100,80,200,0.08), 0 1px 3px rgba(100,80,200,0.06)'
            : '0 24px 48px rgba(0,0,0,0.4), 0 0 80px rgba(139,92,246,0.06)',
        }}>

        <h1 className="text-[18px] font-semibold mb-1 text-center" style={{ color: 'var(--text)' }}>
          {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
        </h1>
        <p className="text-[13px] text-center mb-6" style={{ color: 'var(--text-muted)' }}>
          {mode === 'login' ? 'Welcome back.' : 'Get started with Vani.'}
        </p>

        {/* Google login */}
        <button type="button" onClick={handleGoogle} disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg text-[13px] font-medium transition-all disabled:opacity-50"
          style={{
            background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${isLight ? 'rgba(100,80,200,0.12)' : 'rgba(255,255,255,0.08)'}`,
            color: 'var(--text)',
          }}>
          {googleLoading ? (
            <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: isLight ? 'rgba(100,80,200,0.10)' : 'rgba(255,255,255,0.06)' }} />
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: isLight ? 'rgba(100,80,200,0.10)' : 'rgba(255,255,255,0.06)' }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Workspace name</label>
              <input type="text" required autoFocus={mode === 'signup'} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="input w-full" placeholder="Acme Inc." />
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input type="email" required autoFocus={mode === 'login'} value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="input w-full" placeholder="you@company.com" />
          </div>

          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <input type="password" required value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="input w-full" placeholder="••••••••" />
          </div>

          {mode === 'login' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#8b5cf6] cursor-pointer" />
              <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Remember me</span>
            </label>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg text-[12px]"
              style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--red)' }}>
              {error}
              {mode === 'signup' && /already (been )?registered|already exists|email.*taken/i.test(error) && (
                <button type="button" onClick={() => switchMode('login')}
                  className="ml-1 underline" style={{ color: 'var(--accent)' }}>Sign in instead</button>
              )}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed mt-1">
            {loading
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>
      </div>

      {/* Switch mode */}
      <p className="text-[13px] mt-5 relative z-10" style={{ color: 'var(--text-muted)' }}>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          className="hover:underline transition-colors font-medium" style={{ color: 'var(--accent)' }}>
          {mode === 'login' ? 'Create one' : 'Sign in'}
        </button>
      </p>

      <p className="text-[11px] mt-3 relative z-10" style={{ color: 'var(--text-muted)' }}>
        By continuing, you agree to our Terms &amp; Privacy Policy
      </p>
    </div>
  )
}
