import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { api } from './api/client'
import Sidebar from './components/Sidebar'
import LoginPage          from './pages/LoginPage'
import DashboardPage      from './pages/DashboardPage'
import IntegrationsPage   from './pages/IntegrationsPage'
import ChannelsPage       from './pages/ChannelsPage'
import FlowBuilderPage    from './pages/FlowBuilderPage'
import AgentsPage      from './pages/AgentsPage'
import AgentFormPage   from './pages/AgentFormPage'
import CallsPage       from './pages/CallsPage'
import CallDetailPage  from './pages/CallDetailPage'
import NumbersPage       from './pages/NumbersPage'
import WebhooksPage      from './pages/WebhooksPage'
import SettingsPage    from './pages/SettingsPage'
import CampaignsPage       from './pages/CampaignsPage'
import CampaignDetailPage  from './pages/CampaignDetailPage'
import AnalyticsPage   from './pages/AnalyticsPage'
import TemplatesPage   from './pages/TemplatesPage'
import PlaygroundPage  from './pages/PlaygroundPage'
import KioskPage       from './pages/KioskPage'
import DialerPage      from './pages/DialerPage'
import AgentBuilderPage from './pages/AgentBuilderPage'
import QAPage          from './pages/QAPage'
import LatencyPage     from './pages/LatencyPage'
import ApiKeysPage     from './pages/ApiKeysPage'
import BillingPage     from './pages/BillingPage'

function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Routes>
          <Route path="/"              element={<DashboardPage />} />
          <Route path="/agents"        element={<AgentsPage />} />
          <Route path="/agents/build"  element={<AgentBuilderPage />} />
          <Route path="/agents/:id"    element={<AgentFormPage />} />
          <Route path="/calls"         element={<CallsPage />} />
          <Route path="/calls/:id"     element={<CallDetailPage />} />
          <Route path="/campaigns"     element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="/analytics"     element={<AnalyticsPage />} />
          <Route path="/playground"    element={<PlaygroundPage />} />
          <Route path="/numbers"        element={<NumbersPage />} />
          <Route path="/webhooks"      element={<WebhooksPage />} />
          <Route path="/templates"     element={<TemplatesPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
          <Route path="/dialer"        element={<DialerPage />} />
          <Route path="/integrations"  element={<IntegrationsPage />} />
          <Route path="/channels"      element={<ChannelsPage />} />
          <Route path="/flow-builder"  element={<FlowBuilderPage />} />
          <Route path="/qa"            element={<QAPage />} />
          <Route path="/latency"       element={<LatencyPage />} />
          <Route path="/api-keys"      element={<ApiKeysPage />} />
          <Route path="/billing"       element={<BillingPage />} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FAFAF9]">
        <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    // Supabase OAuth returns tokens in the URL hash: #access_token=...&refresh_token=...
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    if (accessToken) {
      localStorage.setItem('vani_token', accessToken)
      // Extract tenant_id from JWT payload
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]))
        localStorage.setItem('vani_tenant', payload.sub || '')
      } catch {}
      // Ensure tenant row exists (Google OAuth may be first-time user)
      api.me().catch(() => {})
      window.location.href = '/'
    } else {
      navigate('/login')
    }
  }, [navigate])
  return (
    <div className="flex-1 flex items-center justify-center bg-[#FAFAF9]">
      <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/kiosk"  element={<KioskPage />} />
          <Route path="/*" element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
