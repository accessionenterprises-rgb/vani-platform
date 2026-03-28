import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth()
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

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(err.message || 'Google login failed')
      setGoogleLoading(false)
    }
  }

  function switchMode(m) {
    setMode(m)
    setError('')
    setForm({ name: '', email: savedEmail, password: '' })
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#FAFAF9] px-4">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center shadow-lg shadow-blue-200/30">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        </div>
        <span className="text-3xl font-bold text-[#1A1816] tracking-tight">Vani</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] bg-white border border-[#E8E5E2] rounded-2xl p-8">

        <h1 className="text-xl font-semibold text-[#1A1816] mb-1 text-center">
          {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
        </h1>
        <p className="text-base text-[#A8A29E] text-center mb-6">
          {mode === 'login' ? 'Welcome back. Enter your details below.' : 'Get started with Vani in seconds.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-[#78716C] mb-1.5">Workspace name</label>
              <input type="text" required autoFocus={mode === 'signup'} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-[#FAFAF9] border border-[#E8E5E2] hover:border-[#E8E5E2] focus:border-[#2563EB] rounded-lg px-3.5 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] outline-none transition-colors"
                placeholder="Acme Inc." />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#78716C] mb-1.5">Email address</label>
            <input type="email" required autoFocus={mode === 'login'} value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-[#FAFAF9] border border-[#E8E5E2] hover:border-[#E8E5E2] focus:border-[#2563EB] rounded-lg px-3.5 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] outline-none transition-colors"
              placeholder="you@company.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#78716C] mb-1.5">Password</label>
            <input type="password" required value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-[#FAFAF9] border border-[#E8E5E2] hover:border-[#E8E5E2] focus:border-[#2563EB] rounded-lg px-3.5 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] outline-none transition-colors"
              placeholder="••••••••" />
          </div>

          {mode === 'login' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[#D6D3D1] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer" />
              <span className="text-sm text-[#78716C]">Remember me</span>
            </label>
          )}

          {error && (
            <div className="bg-red-500/8 border border-red-500/20 rounded-lg px-3.5 py-2.5 text-sm text-red-400">
              {error}
              {mode === 'signup' && /already (been )?registered|already exists|email.*taken/i.test(error) && (
                <span className="ml-1">
                  <button type="button" onClick={() => switchMode('login')}
                    className="text-[#2563EB] hover:text-[#3B82F6] underline">Sign in instead</button>
                </span>
              )}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-base transition-colors mt-1">
            {loading
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#E8E5E2]" />
          <span className="text-[12px] text-[#A8A29E]">or</span>
          <div className="flex-1 h-px bg-[#E8E5E2]" />
        </div>

        {/* Google login */}
        <button type="button" onClick={handleGoogle} disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-[#FAFAF9] border border-[#E8E5E2] hover:border-[#D6D3D1] disabled:opacity-50 text-[#44403C] font-medium py-2.5 rounded-lg text-base transition-colors">
          {googleLoading ? (
            <div className="w-4 h-4 border-2 border-[#A8A29E] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continue with Google
        </button>
      </div>

      {/* Switch mode */}
      <p className="text-base text-[#A8A29E] mt-5">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          className="text-[#2563EB] hover:text-[#3B82F6] transition-colors font-medium">
          {mode === 'login' ? 'Create one' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
