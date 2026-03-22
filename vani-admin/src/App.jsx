import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext'
import Sidebar from './components/Sidebar'
import LoginPage          from './pages/LoginPage'
import OverviewPage       from './pages/OverviewPage'
import TenantsPage        from './pages/TenantsPage'
import TenantDetailPage   from './pages/TenantDetailPage'
import AgentsPage         from './pages/AgentsPage'
import CallsPage          from './pages/CallsPage'
import PlatformConfigPage from './pages/PlatformConfigPage'
import SystemHealthPage   from './pages/SystemHealthPage'
import PlansPage          from './pages/PlansPage'

function RequireAuth({ children }) {
  const { token } = useAdminAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

function AdminShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <Routes>
          <Route path="/"              element={<OverviewPage />} />
          <Route path="/tenants"       element={<TenantsPage />} />
          <Route path="/tenants/:id"   element={<TenantDetailPage />} />
          <Route path="/agents"        element={<AgentsPage />} />
          <Route path="/calls"         element={<CallsPage />} />
          <Route path="/config"        element={<PlatformConfigPage />} />
          <Route path="/health"        element={<SystemHealthPage />} />
          <Route path="/plans"         element={<PlansPage />} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <RequireAuth>
              <AdminShell />
            </RequireAuth>
          } />
        </Routes>
      </AdminAuthProvider>
    </BrowserRouter>
  )
}
