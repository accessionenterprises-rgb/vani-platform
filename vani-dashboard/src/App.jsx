import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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

function AppShell() {
  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"  element={<LoginPage />} />
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
