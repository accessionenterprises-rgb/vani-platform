import { useLocation } from 'react-router-dom'
import { useVoiceSession } from '../../context/VoiceSessionContext'
import { useTheme } from '../../context/ThemeContext'

const PAGE_NAMES = {
  '/': 'Dashboard',
  '/agents': 'Agents',
  '/calls': 'Calls',
  '/campaigns': 'Campaigns',
  '/analytics': 'Analytics',
  '/numbers': 'Numbers',
  '/integrations': 'Integrations',
  '/settings': 'Settings',
}

function SunIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export default function TopBar() {
  const { pathname } = useLocation()
  const { session } = useVoiceSession()
  const { theme, toggle } = useTheme()
  const pageName = PAGE_NAMES[pathname] || PAGE_NAMES['/' + pathname.split('/')[1]] || 'Dashboard'
  const isLight = theme === 'light'

  return (
    <header
      className="vani-topbar h-14 shrink-0 flex items-center justify-between px-6 border-b"
      style={{
        background: isLight ? 'rgba(244,243,248,0.88)' : 'rgba(9,9,11,0.8)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottomColor: isLight ? 'rgba(100,80,200,0.08)' : 'rgba(255,255,255,0.04)',
      }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[14px]">
        <span className="font-semibold" style={{ color: 'var(--text)' }}>{pageName}</span>
      </div>

      {/* Center: Search trigger */}
      <button
        className="flex items-center gap-3 px-4 py-1.5 rounded-lg border transition-all group"
        style={{
          background: isLight ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.02)',
          borderColor: isLight ? 'rgba(100,80,200,0.12)' : 'rgba(255,255,255,0.06)',
        }}
      >
        <svg className="w-3.5 h-3.5 transition-colors" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span className="text-[13px] transition-colors" style={{ color: 'var(--text-muted)' }}>Search...</span>
        <kbd className="text-[10px] font-medium px-1.5 py-0.5 rounded border"
          style={{ color: 'var(--text-muted)', background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', borderColor: 'var(--border)' }}>
          ⌘K
        </kbd>
      </button>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Voice session indicator */}
        {session && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.20)' }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full opacity-60" style={{ background: 'var(--green)' }} />
              <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: 'var(--green)' }} />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--green)' }}>{session.type}</span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{ color: 'var(--text-muted)', background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(100,80,200,0.08)' : 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {isLight ? <MoonIcon /> : <SunIcon />}
        </button>

        {/* Notifications */}
        <button
          className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(100,80,200,0.08)' : 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center text-white text-[12px] font-bold cursor-pointer hover:ring-2 hover:ring-[rgba(139,92,246,0.30)] transition-all">
          V
        </div>
      </div>
    </header>
  )
}
