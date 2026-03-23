import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { section: 'Core', items: [
    { to: '/',           label: 'Dashboard',   icon: GridIcon },
    { to: '/agents',     label: 'Agents',      icon: BotIcon },
    { to: '/calls',      label: 'Calls',       icon: PhoneIcon },
    { to: '/analytics',  label: 'Analytics',   icon: ChartIcon },
  ]},
  { section: 'Outreach', items: [
    { to: '/dialer',     label: 'Dialer',      icon: DialerIcon },
    { to: '/campaigns',  label: 'Campaigns',   icon: MegaphoneIcon },
    { to: '/templates',  label: 'Templates',   icon: TemplateIcon },
  ]},
  { section: 'Platform', items: [
    { to: '/numbers',      label: 'Numbers',      icon: HashIcon },
    { to: '/channels',     label: 'Channels',     icon: ChannelsIcon },
    { to: '/playground',   label: 'Playground',   icon: BeakerIcon },
    { to: '/flow-builder', label: 'Flow Builder', icon: FlowIcon },
    { to: '/integrations', label: 'Integrations', icon: LinkIcon },
    { to: '/webhooks',     label: 'Webhooks',     icon: WebhookIcon },
  ]},
]

export default function Sidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <aside className="w-[232px] shrink-0 bg-[#FAFAF9] border-r border-[#E8E5E2] flex flex-col">
      {/* Brand */}
      <div className="px-5 h-16 flex items-center gap-3 border-b border-[#F0EDEA]">
        <div className="w-8 h-8 rounded-[10px] bg-[#2563EB] flex items-center justify-center shadow-sm shadow-blue-200">
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-white fill-current">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        </div>
        <span className="text-[#1A1816] font-bold text-[15px] tracking-[-0.02em]">Vani</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 pb-2 overflow-y-auto">
        {NAV.map(({ section, items }) => (
          <div key={section} className="mb-5">
            <p className="px-3 mb-1 text-[10px] font-semibold text-[#A8A29E] uppercase tracking-[0.08em]">{section}</p>
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] transition-all ${
                    isActive
                      ? 'bg-white text-[#1A1816] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-[#E8E5E2]'
                      : 'text-[#78716C] hover:text-[#44403C] hover:bg-white/60'
                  }`
                }
              >
                <Icon className="w-[16px] h-[16px] shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-[#F0EDEA]">
        <NavLink to="/settings" end
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] transition-all mb-1 ${
              isActive
                ? 'bg-white text-[#1A1816] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-[#E8E5E2]'
                : 'text-[#78716C] hover:text-[#44403C] hover:bg-white/60'
            }`
          }>
          <SettingsIcon className="w-[16px] h-[16px]" />
          Settings
        </NavLink>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] text-[#A8A29E] hover:text-[#78716C] hover:bg-white/60 transition-all"
        >
          <LogoutIcon className="w-[16px] h-[16px]" />
          Sign out
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
function DialerIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="9" cy="8" r="0.8" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none"/><circle cx="15" cy="8" r="0.8" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="0.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="0.8" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none"/></svg>
}
function MegaphoneIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
}
function TemplateIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
}
function HashIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
}
function ChannelsIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/><path d="M2 8.08V5a2 2 0 0 1 2-2h3"/><rect x="8" y="2" width="8" height="6" rx="1"/><path d="M16 8v8a2 2 0 0 1-2 2H8"/></svg>
}
function BeakerIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M9 3v9l-4.5 7.5A1 1 0 0 0 5.5 21h13a1 1 0 0 0 1-1.5L15 12V3"/></svg>
}
function FlowIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="6" height="4" rx="1"/><rect x="16" y="10" width="6" height="4" rx="1"/><rect x="2" y="17" width="6" height="4" rx="1"/><path d="M8 5h4a2 2 0 0 1 2 2v6"/><path d="M8 19h4a2 2 0 0 0 2-2v-5"/></svg>
}
function LinkIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
}
function WebhookIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
}
function SettingsIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
function LogoutIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
