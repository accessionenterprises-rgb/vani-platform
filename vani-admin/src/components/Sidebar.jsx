import { NavLink, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useMemo } from 'react'

const NAV = [
  {
    section: null,
    items: [
      { label: 'Overview', to: '/', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    ],
  },
  {
    section: 'Users',
    items: [
      { label: 'Tenants', to: '/tenants', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
      { label: 'Agents',  to: '/agents',  icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> },
      { label: 'Calls',   to: '/calls',   icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    ],
  },
  {
    section: 'Platform',
    items: [
      { label: 'Platform Config', to: '/config', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
      { label: 'System Health',   to: '/health', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
      { label: 'Plans',           to: '/plans',  icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
      { label: 'Admin Users',     to: '/admin-users', superadminOnly: true, icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M18 8h4M20 6v4"/></svg> },
    ],
  },
]

export default function Sidebar() {
  const { logout, adminUser } = useAdminAuth()
  const navigate = useNavigate()

  return (
    <aside className="w-56 flex-shrink-0 bg-[#0d0f1a] border-r border-[#1a1d2e] flex flex-col min-h-screen">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-[#1a1d2e]">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow shadow-indigo-500/30 flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">Vani</p>
          <p className="text-[10px] text-rose-400 font-semibold tracking-widest mt-0.5">ADMIN</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5">
        {NAV.map((group, i) => (
          <div key={i}>
            {group.section && (
              <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-widest px-3 mb-1.5">
                {group.section}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.filter(item => !item.superadminOnly || adminUser?.role === 'superadmin').map(({ label, to, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-indigo-500/15 text-indigo-300'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`
                  }
                >
                  {icon}
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-5 border-t border-[#1a1d2e] pt-3">
        {adminUser && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-indigo-400">{adminUser.name?.[0]?.toUpperCase() || 'A'}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">{adminUser.name}</p>
              <p className="text-[10px] text-slate-600 capitalize">{adminUser.role}</p>
            </div>
          </div>
        )}
        <div className="space-y-0.5">
        <a
          href="https://dashboard.vani.live"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Open Dashboard
        </a>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-400 hover:bg-white/5 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
        </div>
      </div>
    </aside>
  )
}
