import { useState } from 'react'
import { useTab } from '../hooks/useDrawer'
import { useNumbers } from '../hooks/useNumbers'
import TabBar from '../components/shared/TabBar'
import Badge from '../components/shared/Badge'
import EmptyState from '../components/shared/EmptyState'
import { api } from '../api/client'

const TABS = [
  { key: 'numbers', label: 'My Numbers' },
  { key: 'hunter',  label: 'Hunter' },
  { key: 'channels', label: 'Channels' },
]

const CHANNELS = [
  {
    icon: '📞',
    label: 'Voice (Phone)',
    status: 'Live',
    statusColor: 'green',
    description: 'Inbound + outbound calls via Twilio/Exotel. Configure in Numbers.',
    action: 'Manage numbers →',
  },
  {
    icon: '💬',
    label: 'Web Chat Widget',
    status: 'Beta',
    statusColor: 'blue',
    description: 'Embeddable chat widget for any website. Text-based AI conversations.',
    action: 'Configure →',
  },
  {
    icon: '📱',
    label: 'SMS',
    status: 'Soon',
    statusColor: 'amber',
    description: 'Two-way SMS conversations powered by your AI agents.',
    action: 'Setup →',
  },
]

const WIDGET_THEMES = ['Dark', 'Light', 'Purple']
const WIDGET_POSITIONS = ['Bottom Right', 'Bottom Left', 'Top Right', 'Top Left']

export default function NumbersPage() {
  const { activeTab, setTab } = useTab('tab', 'numbers')
  const { data: numbers = [], isLoading, refetch } = useNumbers()
  const [syncing, setSyncing] = useState('')
  const [widgetTheme, setWidgetTheme] = useState('dark')
  const [widgetPosition, setWidgetPosition] = useState('bottom-right')
  const [greeting, setGreeting] = useState('Hi! How can I help you today?')
  const [copied, setCopied] = useState(false)

  const tenantId = localStorage.getItem('vani_tenant') || 'YOUR_TENANT_ID'

  async function syncProvider(provider) {
    setSyncing(provider)
    try {
      if (provider === 'twilio') await api.syncTwilioNumbers()
      else if (provider === 'telnyx') await api.syncTelnyxNumbers()
      refetch()
    } catch {}
    finally { setSyncing('') }
  }

  const embedCode = `<!-- Vani Chat Widget -->
<script>
  window.VaniConfig = {
    tenantId: "${tenantId}",
    theme: "${widgetTheme}",
    position: "${widgetPosition}",
    greeting: "${greeting}",
  };
  (function(d,s,id){
    var js,fjs=d.getElementsByTagName(s)[0];
    if(d.getElementById(id)) return;
    js=d.createElement(s); js.id=id;
    js.src="https://widget.vani.live/v1/loader.js";
    fjs.parentNode.insertBefore(js,fjs);
  }(document,'script','vani-widget'));
<\/script>`

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full h-full px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Numbers</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Phone numbers, hunting, and channels</p>
        </div>
      </div>

      <TabBar tabs={TABS} active={activeTab} onChange={setTab} className="mb-6" />

      {/* ── My Numbers ── */}
      {activeTab === 'numbers' && (
        <div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <p className="text-[14px] font-semibold mr-2" style={{ color: 'var(--text)' }}>Phone Numbers</p>
            <p className="text-[12px] mr-auto" style={{ color: 'var(--text-muted)' }}>Manage numbers and connect them to your agents</p>
            <button onClick={() => syncProvider('twilio')} disabled={!!syncing}
              className="btn-ghost text-[12px] py-1.5 px-3 flex items-center gap-1.5 border"
              style={{ borderColor: 'var(--border)' }}>
              {syncing === 'twilio' ? <span className="w-3 h-3 border border-[#8b5cf6] border-t-transparent rounded-full animate-spin inline-block" /> : null}
              Sync Twilio
            </button>
            <button onClick={() => syncProvider('telnyx')} disabled={!!syncing}
              className="btn-ghost text-[12px] py-1.5 px-3 flex items-center gap-1.5 border"
              style={{ borderColor: 'var(--border)' }}>
              {syncing === 'telnyx' ? <span className="w-3 h-3 border border-[#8b5cf6] border-t-transparent rounded-full animate-spin inline-block" /> : null}
              Sync Telnyx
            </button>
            <button className="btn-ghost text-[12px] py-1.5 px-3 border" style={{ borderColor: 'var(--border)' }}>+ Add Manually</button>
            <button className="btn-primary text-[12px] py-1.5 px-3">Buy Number</button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : numbers.length === 0 ? (
            <EmptyState icon="📞" title="No numbers yet" description="Buy or connect a phone number to start receiving calls" action={() => {}} actionLabel="Buy a number" />
          ) : (
            <div className="glass overflow-hidden">
              <div className="grid gap-3 px-4 py-2.5 border-b" style={{ gridTemplateColumns: '1fr 100px 120px 80px 80px', borderColor: 'var(--border)' }}>
                {['Number', 'Provider', 'Agent', 'Status', ''].map(h => (
                  <p key={h} className="text-[11px] font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--text-muted)' }}>{h}</p>
                ))}
              </div>
              {numbers.map((n, idx) => (
                <div key={n.id}
                  className="grid gap-3 px-4 py-3 transition-colors"
                  style={{
                    gridTemplateColumns: '1fr 100px 120px 80px 80px',
                    borderBottom: idx < numbers.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                  <p className="text-[13px] font-mono font-medium" style={{ color: 'var(--text)' }}>{n.number || n.phone || '—'}</p>
                  <p className="text-[12px] capitalize" style={{ color: 'var(--text-secondary)' }}>{n.provider || '—'}</p>
                  <p className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{n.agent_name || n.agent_id || '—'}</p>
                  <div><Badge status={n.status || 'active'} /></div>
                  <button className="text-[11px] transition-colors hover:underline" style={{ color: 'var(--red)', textAlign: 'left' }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hunter ── */}
      {activeTab === 'hunter' && (
        <EmptyState icon="🔍" title="Number Hunter" description="Search and buy phone numbers from Twilio, Telnyx, or Exotel directly within Vani." actionLabel="Coming soon" />
      )}

      {/* ── Channels ── */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          {/* Channel cards */}
          <div className="grid grid-cols-3 gap-3">
            {CHANNELS.map(ch => (
              <div key={ch.label} className="glass p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ch.icon}</span>
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{ch.label}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                        style={{
                          background: ch.statusColor === 'green' ? 'var(--green-dim)' : ch.statusColor === 'blue' ? 'var(--blue-dim)' : 'var(--amber-dim)',
                          color: ch.statusColor === 'green' ? 'var(--green)' : ch.statusColor === 'blue' ? 'var(--blue)' : 'var(--amber)',
                        }}>
                        {ch.status}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{ch.description}</p>
                <a href="#" className="text-[12px] font-medium hover:underline mt-auto" style={{ color: 'var(--accent)' }}>{ch.action}</a>
              </div>
            ))}
          </div>

          {/* Widget config */}
          <div className="glass p-5">
            <p className="text-[15px] font-semibold mb-4" style={{ color: 'var(--text)' }}>Widget Configuration</p>
            <div className="grid grid-cols-2 gap-6">
              {/* Left: controls */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-2 block" style={{ color: 'var(--text-muted)' }}>Theme</label>
                  <div className="flex gap-2">
                    {WIDGET_THEMES.map(t => (
                      <button key={t} onClick={() => setWidgetTheme(t.toLowerCase())}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                        style={{
                          background: widgetTheme === t.toLowerCase() ? 'var(--accent-dim)' : 'transparent',
                          color: widgetTheme === t.toLowerCase() ? 'var(--accent)' : 'var(--text-muted)',
                          border: `1px solid ${widgetTheme === t.toLowerCase() ? 'rgba(139,92,246,0.25)' : 'var(--border)'}`,
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-2 block" style={{ color: 'var(--text-muted)' }}>Position</label>
                  <select value={widgetPosition} onChange={e => setWidgetPosition(e.target.value)}
                    className="input w-full text-[12px]">
                    {WIDGET_POSITIONS.map(p => (
                      <option key={p} value={p.toLowerCase().replace(' ', '-')}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-2 block" style={{ color: 'var(--text-muted)' }}>Greeting Message</label>
                  <input value={greeting} onChange={e => setGreeting(e.target.value)}
                    className="input w-full text-[12px]" placeholder="Hi! How can I help you today?" />
                </div>

                {/* Preview bubble */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-2 block" style={{ color: 'var(--text-muted)' }}>Preview</label>
                  <div className="relative rounded-xl overflow-hidden flex items-end justify-end p-4"
                    style={{ background: 'var(--surface-3)', minHeight: 100, border: '1px solid var(--border)' }}>
                    <div className="max-w-[200px]">
                      <div className="px-3 py-2 rounded-2xl rounded-br-sm text-[12px] mb-2"
                        style={{ background: widgetTheme === 'dark' ? '#1c1c1f' : '#ffffff', color: widgetTheme === 'dark' ? '#fafafa' : '#09090b', border: '1px solid var(--border)' }}>
                        {greeting || 'Hi! How can I help you today?'}
                      </div>
                      <p className="text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>Your website</p>
                    </div>
                    <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center shadow-lg" style={{ boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M3 8v8"/><path d="M7 5v14"/><path d="M11 2v20"/><path d="M15 6v12"/><path d="M19 9v6"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: embed code */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--text-muted)' }}>Embed Code</label>
                  <button onClick={copyEmbed} className="btn-ghost text-[11px] py-1 px-2.5 border" style={{ borderColor: 'var(--border)' }}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div className="rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-x-auto"
                  style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)', whiteSpace: 'pre' }}>
                  {embedCode}
                </div>
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  Paste this snippet before the <code style={{ color: 'var(--accent)' }}>&lt;/body&gt;</code> tag on every page where you want the widget to appear.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
