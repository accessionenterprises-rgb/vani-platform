import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { VoiceSessionProvider } from './context/VoiceSessionContext'
import { ThemeProvider } from './context/ThemeContext'
import { api } from './api/client'
import Sidebar from './components/Sidebar'
import TopBar from './components/layout/TopBar'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

// ─── Pages (8 consolidated + functional sub-pages + standalone) ─────────────
import LoginPage        from './pages/LoginPage'
import DashboardPage    from './pages/DashboardPage'
import AgentsPage       from './pages/AgentsPage'
import AgentFormPage    from './pages/AgentFormPage'
import AgentBuilderPage from './pages/AgentBuilderPage'
import CallsPage        from './pages/CallsPage'
import CampaignsPage    from './pages/CampaignsPage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import AnalyticsPage    from './pages/AnalyticsPage'
import NumbersPage      from './pages/NumbersPage'
import IntegrationsPage from './pages/IntegrationsPage'
import SettingsPage     from './pages/SettingsPage'
import KioskPage        from './pages/KioskPage'

function AppShell() {
  return (
    <div className="vani-app-bg flex h-screen overflow-hidden w-full" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Gradient mesh background */}
      <div className="vani-mesh pointer-events-none fixed inset-0 z-0" style={{
        background: `
          radial-gradient(ellipse 600px 400px at 15% 10%, rgba(139,92,246,0.06) 0%, transparent 70%),
          radial-gradient(ellipse 500px 300px at 85% 80%, rgba(59,130,246,0.04) 0%, transparent 70%),
          radial-gradient(ellipse 400px 400px at 50% 50%, rgba(139,92,246,0.03) 0%, transparent 60%)
        `,
      }} />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto w-full">
          <Routes>
            <Route path="/"              element={<DashboardPage />} />
            <Route path="/agents"        element={<AgentsPage />} />
            <Route path="/agents/build"  element={<AgentBuilderPage />} />
            <Route path="/agents/:id"    element={<AgentFormPage />} />
            <Route path="/calls"         element={<CallsPage />} />
            <Route path="/campaigns"     element={<CampaignsPage />} />
            <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
            <Route path="/analytics"     element={<AnalyticsPage />} />
            <Route path="/numbers"       element={<NumbersPage />} />
            <Route path="/integrations"  element={<IntegrationsPage />} />
            <Route path="/settings"      element={<SettingsPage />} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#09090b]">
        <div className="w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    if (accessToken) {
      localStorage.setItem('vani_token', accessToken)
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]))
        localStorage.setItem('vani_tenant', payload.sub || '')
      } catch {}
      api.me().catch(() => {})
      window.location.href = '/'
    } else {
      navigate('/login')
    }
  }, [navigate])
  return (
    <div className="flex-1 flex items-center justify-center bg-[#09090b]">
      <div className="w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <VoiceSessionProvider>
              <Routes>
                <Route path="/login"         element={<LoginPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/kiosk"         element={<KioskPage />} />
                <Route path="/*" element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                } />
              </Routes>
            </VoiceSessionProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
