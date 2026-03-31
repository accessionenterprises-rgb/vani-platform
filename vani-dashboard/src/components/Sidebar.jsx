import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useVoiceSession } from '../context/VoiceSessionContext'
import { useTheme } from '../context/ThemeContext'

const NAV = [
  { section: 'Core', items: [
    { to: '/',           label: 'Dashboard',   icon: GridIcon },
    { to: '/agents',     label: 'Agents',      icon: BotIcon },
    { to: '/calls',      label: 'Calls',       icon: PhoneIcon },
    { to: '/campaigns',  label: 'Campaigns',   icon: MegaphoneIcon },
    { to: '/analytics',  label: 'Analytics',   icon: ChartIcon },
  ]},
  { section: 'Platform', items: [
    { to: '/numbers',       label: 'Numbers',       icon: HashIcon },
    { to: '/integrations',  label: 'Integrations',  icon: LinkIcon },
  ]},
]

export default function Sidebar() {
  const { logout } = useAuth()
  const { session } = useVoiceSession()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const isLight = theme === 'light'

  // Keyboard shortcut: [ to toggle sidebar
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        setCollapsed(c => !c)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const w = collapsed ? 'w-[56px]' : 'w-[240px]'

  return (
    <aside className={`vani-sidebar ${w} shrink-0 flex flex-col border-r transition-all duration-200 ease-out`}
      style={{
        background: isLight ? 'rgba(249,248,253,0.95)' : 'rgba(15,15,17,0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRightColor: isLight ? 'rgba(100,80,200,0.08)' : 'rgba(255,255,255,0.04)',
      }}>

      {/* Brand */}
      <div className="h-14 flex items-center gap-3 px-4 border-b"
        style={{ borderBottomColor: isLight ? 'rgba(100,80,200,0.08)' : 'rgba(255,255,255,0.04)' }}>
        <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center shadow-lg shadow-[rgba(139,92,246,0.2)] shrink-0">
          <svg viewBox="0 0 24 24" className="w-[16px] h-[16px] text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8v8"/><path d="M7 5v14"/><path d="M11 2v20"/><path d="M15 6v12"/><path d="M19 9v6"/>
          </svg>
        </div>
        {!collapsed && <span className="font-bold text-[17px] tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Vani</span>}
      </div>

      {/* Voice session indicator */}
      {session && !collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-[#22c55e] opacity-60" />
              <span className="relative h-2 w-2 rounded-full bg-[#22c55e]" />
            </span>
            <span className="text-[11px] font-medium text-[#22c55e] uppercase tracking-wider">{session.type}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 pt-4 pb-2 overflow-y-auto">
        {NAV.map(({ section, items }) => (
          <div key={section} className="mb-5">
            {!collapsed && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>{section}</p>
            )}
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'} py-[9px] rounded-lg text-[14px] transition-all duration-150 relative group mb-0.5 ${
                    isActive ? 'font-medium' : ''
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                })}
                onMouseEnter={e => { if (!e.currentTarget.dataset.active) e.currentTarget.style.background = isLight ? 'rgba(100,80,200,0.06)' : 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!e.currentTarget.dataset.active) e.currentTarget.style.background = 'transparent' }}
              >
                {({ isActive }) => (
                  <>
                    {/* Active glow background */}
                    {isActive && (
                      <div className="absolute inset-0 rounded-lg bg-[rgba(139,92,246,0.12)] breathe"
                        style={{ boxShadow: '0 0 20px rgba(139,92,246,0.10), inset 0 0 12px rgba(139,92,246,0.05)' }} />
                    )}
                    {/* Active left bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-[#8b5cf6]" />
                    )}
                    <Icon className={`w-[16px] h-[16px] shrink-0 relative z-10 ${isActive ? 'text-[#8b5cf6]' : ''}`} />
                    {!collapsed && <span className="relative z-10">{label}</span>}
                    {/* Tooltip for collapsed mode */}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[#161618] border border-[rgba(255,255,255,0.08)] text-[12px] text-[#fafafa] font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        {label}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t" style={{ borderImage: 'linear-gradient(to right, rgba(139,92,246,0.1), transparent) 1' }}>
        <NavLink to="/settings" end
          className={({ isActive }) =>
            `flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'} py-[9px] rounded-lg text-[14px] transition-all mb-0.5 relative group ${
              isActive
                ? 'text-[#8b5cf6] font-medium bg-[rgba(139,92,246,0.08)]'
                : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[rgba(255,255,255,0.04)]'
            }`
          }>
          <SettingsIcon className="w-[16px] h-[16px] shrink-0" />
          {!collapsed && <span>Settings</span>}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[#161618] border border-[rgba(255,255,255,0.08)] text-[12px] text-[#fafafa] font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Settings
            </div>
          )}
        </NavLink>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className={`w-full flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'} py-[9px] rounded-lg text-[14px] text-[#52525b] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.04)] transition-all relative group`}
        >
          <LogoutIcon className="w-[16px] h-[16px] shrink-0" />
          {!collapsed && <span>Sign out</span>}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[#161618] border border-[rgba(255,255,255,0.08)] text-[12px] text-[#fafafa] font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Sign out
            </div>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-end px-3'} py-2 mt-1 text-[#52525b] hover:text-[#a1a1aa] transition-colors`}
          title="Toggle sidebar [  ]"
        >
          <svg className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="11,17 6,12 11,7" /><polyline points="18,17 13,12 18,7" />
          </svg>
        </button>
      </div>
    </aside>
  )
}

// ─── Icons (1.8 stroke, round caps) ─────────────────────────────────────────

function GridIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
}
function BotIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><circle cx="8" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1" fill="currentColor" stroke="none"/></svg>
}
function PhoneIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 7.36 7.36l1.91-1.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
}
function ChartIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function MegaphoneIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
}
function HashIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
}
function LinkIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
}
function SettingsIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
function LogoutIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
