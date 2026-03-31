import { useState } from 'react'
import { useTab } from '../hooks/useDrawer'
import { useTeam, useApiKeys, useBillingPlan } from '../hooks/useSettings'
import TabBar from '../components/shared/TabBar'
import Badge from '../components/shared/Badge'
import EmptyState from '../components/shared/EmptyState'
import { api } from '../api/client'

const TABS = [
  { key: 'account',   label: 'Account' },
  { key: 'team',      label: 'Team' },
  { key: 'keys',      label: 'API Keys' },
  { key: 'billing',   label: 'Billing' },
]

const PLAN_LIMITS = [
  { plan: 'Starter ✓', concurrent: 5,   minutes: '1,000 min/mo',  current: true },
  { plan: 'Growth',    concurrent: 20,  minutes: '10,000 min/mo', current: false },
  { plan: 'Enterprise',concurrent: 100, minutes: 'Unlimited/mo',  current: false },
]

const API_QUICK_REF = [
  { method: 'POST', path: '/calls/outbound',           desc: 'Trigger outbound call' },
  { method: 'POST', path: '/calls/:id/stop',           desc: 'Stop queued/active call' },
  { method: 'POST', path: '/campaigns',                desc: 'Create bulk campaign' },
  { method: 'POST', path: '/campaigns/:id/contacts',   desc: 'Upload contacts (CSV/JSON)' },
  { method: 'POST', path: '/campaigns/:id/start',      desc: 'Start dialing' },
  { method: 'GET',  path: '/analytics/overview',       desc: 'KPI dashboard data' },
  { method: 'GET',  path: '/agents/:id/tools',         desc: 'List agent tools' },
  { method: 'POST', path: '/agents/:id/tools',         desc: 'Add function calling tool' },
]

export default function SettingsPage() {
  const { activeTab, setTab } = useTab('tab', 'account')
  const { data: team = [], isLoading: loadingTeam, refetch: refetchTeam } = useTeam()
  const { data: keys = [], isLoading: loadingKeys, refetch: refetchKeys } = useApiKeys()
  const { data: billing, isLoading: loadingBilling } = useBillingPlan()

  // API Keys state
  const [keyName, setKeyName] = useState('')
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [copiedKey, setCopiedKey] = useState(false)

  // Team state
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'member' })
  const [inviting, setInviting] = useState(false)

  const tenantId = localStorage.getItem('vani_tenant') || '—'

  async function createKey(e) {
    e.preventDefault()
    if (!keyName.trim()) return
    setCreatingKey(true)
    try {
      const result = await api.createKey(keyName.trim())
      setNewKey(result?.key || result?.api_key || result?.full_key || null)
      setKeyName('')
      refetchKeys()
    } catch {}
    finally { setCreatingKey(false) }
  }

  async function inviteMember(e) {
    e.preventDefault()
    setInviting(true)
    try {
      await api.post('/team/invite', inviteForm)
      setInviteForm({ name: '', email: '', role: 'member' })
      refetchTeam()
    } catch {}
    finally { setInviting(false) }
  }

  function copyKey(k) {
    navigator.clipboard.writeText(k)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const usedMin = billing?.minutes_used ?? 0
  const limitMin = billing?.minutes_limit ?? 1000
  const pct = Math.min(100, (usedMin / limitMin) * 100)

  return (
    <div className="w-full h-full px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Settings</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Account, API keys, and telephony configuration</p>
        </div>
      </div>

      <TabBar tabs={TABS} active={activeTab} onChange={setTab} className="mb-6" />

      {/* ── Account ── */}
      {activeTab === 'account' && (
        <div className="space-y-4 max-w-2xl">
          {/* Info card */}
          <div className="glass p-5 space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-4" style={{ color: 'var(--text-muted)' }}>Account</h2>
            <InfoRow label="Email" value={billing?.email || localStorage.getItem('vani_email') || '—'} />
            <InfoRow label="Tenant ID" value={tenantId} mono />
            <InfoRow label="Plan" value={billing?.plan || 'starter'} />
            <InfoRow label="Concurrent Call Limit" value={`${billing?.concurrent_limit ?? 5} simultaneous calls`} />
          </div>

          {/* Plan limits */}
          <div className="glass p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-4" style={{ color: 'var(--text-muted)' }}>Plan Limits</h2>
            <div className="grid grid-cols-3 gap-3">
              {PLAN_LIMITS.map(p => (
                <div key={p.plan} className="rounded-xl p-4"
                  style={{
                    background: p.current ? 'var(--accent-dim)' : 'var(--surface-3)',
                    border: `1px solid ${p.current ? 'rgba(139,92,246,0.25)' : 'var(--border)'}`,
                  }}>
                  <p className="text-[13px] font-semibold mb-2" style={{ color: p.current ? 'var(--accent)' : 'var(--text)' }}>{p.plan}</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.concurrent} concurrent</p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{p.minutes}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Telephony endpoints */}
          <div className="glass p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-4" style={{ color: 'var(--text-muted)' }}>Telephony Endpoints</h2>
            <p className="text-[12px] mb-4" style={{ color: 'var(--text-secondary)' }}>Point your provider's inbound webhook to these URLs:</p>
            <div className="space-y-3">
              {[
                { label: 'Twilio', url: 'POST https://orchestrator.vani.live/telephony/inbound' },
                { label: 'Exotel (India)', url: 'POST https://orchestrator.vani.live/telephony/inbound/exotel' },
                { label: 'Outbound call answered callback', url: 'POST https://orchestrator.vani.live/telephony/outbound/answered/{call_id}' },
              ].map(ep => (
                <div key={ep.label}>
                  <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{ep.label}</p>
                  <code className="block text-[11px] px-3 py-2 rounded-lg font-mono" style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {ep.url}
                  </code>
                </div>
              ))}
            </div>
          </div>

          {/* API Quick Reference */}
          <div className="glass p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-4" style={{ color: 'var(--text-muted)' }}>API Quick Reference</h2>
            <div className="space-y-1">
              {API_QUICK_REF.map(r => (
                <div key={r.path} className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{ background: r.method === 'GET' ? 'var(--blue-dim)' : 'var(--green-dim)', color: r.method === 'GET' ? 'var(--blue)' : 'var(--green)' }}>
                    {r.method}
                  </span>
                  <code className="text-[12px] font-mono flex-1" style={{ color: 'var(--text)' }}>{r.path}</code>
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{r.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Team ── */}
      {activeTab === 'team' && (
        <div className="space-y-4 max-w-2xl">
          <div className="glass p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--text-muted)' }}>Team</h2>
            <p className="text-[12px] mb-4" style={{ color: 'var(--text-secondary)' }}>
              Invite teammates to collaborate. Admins can edit agents and settings. Members can run calls. Viewers can only view data.
            </p>
            <form onSubmit={inviteMember} className="flex items-center gap-2 flex-wrap">
              <input value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name" className="input text-[12px] flex-1 min-w-[120px]" />
              <input value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Email address" type="email" className="input text-[12px] flex-1 min-w-[160px]" />
              <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                className="input text-[12px] w-[100px]">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" disabled={inviting} className="btn-primary text-[12px] py-2 px-4 shrink-0">
                {inviting ? 'Inviting…' : 'Invite Member'}
              </button>
            </form>
          </div>

          {loadingTeam ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : team.length === 0 ? (
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No team members yet. Invite someone above.</p>
          ) : (
            <div className="glass overflow-hidden">
              <div className="grid grid-cols-4 gap-3 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                {['Name', 'Email', 'Role', 'Status'].map(h => (
                  <p key={h} className="text-[11px] font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--text-muted)' }}>{h}</p>
                ))}
              </div>
              {team.map((m, idx) => (
                <div key={m.id} className="grid grid-cols-4 gap-3 px-4 py-2.5"
                  style={{ borderBottom: idx < team.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      {m.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{m.name}</p>
                  </div>
                  <p className="text-[13px] truncate" style={{ color: 'var(--text-secondary)' }}>{m.email}</p>
                  <p className="text-[13px] capitalize" style={{ color: 'var(--text-secondary)' }}>{m.role}</p>
                  <Badge status={m.status || 'active'} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── API Keys ── */}
      {activeTab === 'keys' && (
        <div className="space-y-4 max-w-2xl">
          <div className="glass p-5">
            <h2 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text)' }}>API Keys</h2>
            <p className="text-[12px] mb-4" style={{ color: 'var(--text-secondary)' }}>
              Authenticate requests to the Vani API. Keys are shown once — store them securely.
            </p>
            <form onSubmit={createKey} className="flex items-center gap-2">
              <input value={keyName} onChange={e => setKeyName(e.target.value)}
                placeholder="Key name (e.g. Production)" className="input text-[12px] flex-1" />
              <button type="submit" disabled={creatingKey || !keyName.trim()} className="btn-primary text-[12px] py-2 px-4 shrink-0">
                {creatingKey ? 'Creating…' : 'Create Key'}
              </button>
            </form>
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
              Keys are hashed and stored securely. The full key is shown only once at creation.
            </p>

            {/* Newly created key */}
            {newKey && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.20)' }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--green)' }}>✓ Key created — copy it now, it won't be shown again</p>
                <div className="flex items-center gap-2">
                  <code className="text-[12px] font-mono flex-1 truncate" style={{ color: 'var(--text)' }}>{newKey}</code>
                  <button onClick={() => copyKey(newKey)} className="btn-ghost text-[11px] py-1 px-2 border shrink-0" style={{ borderColor: 'var(--border)' }}>
                    {copiedKey ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {loadingKeys ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : keys.length === 0 ? (
            <div className="glass p-5 flex flex-col items-center py-10 text-center">
              <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text)' }}>No API keys yet.</p>
              <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>Create a secret key to authenticate your API requests.</p>
              <button onClick={() => document.querySelector('input[placeholder*="Key name"]')?.focus()} className="btn-primary text-[12px] py-2 px-4">
                + Create your first key
              </button>
            </div>
          ) : (
            <div className="glass overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="grid gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 40px', width: '100%' }}>
                  {['Name', 'Created', 'Last Used', ''].map(h => (
                    <p key={h} className="text-[11px] font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--text-muted)' }}>{h}</p>
                  ))}
                </div>
              </div>
              <p className="px-4 py-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>{keys.length} key{keys.length !== 1 ? 's' : ''} active</p>
              {keys.map((k, idx) => (
                <div key={k.id} className="px-4 py-2.5"
                  style={{ borderBottom: idx < keys.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'grid', gridTemplateColumns: '1fr 120px 120px 40px', gap: 12, alignItems: 'center' }}>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{k.name}</p>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>vani_••••••••</span>
                  </div>
                  <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{fmtDate(k.created_at)}</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{k.last_used ? fmtDate(k.last_used) : 'Never'}</p>
                  <button className="text-[11px] hover:underline" style={{ color: 'var(--red)' }}>Delete</button>
                </div>
              ))}
            </div>
          )}

          {/* Quick start */}
          <div className="glass p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: 'var(--text-muted)' }}>Quick Start</h2>
            <pre className="rounded-xl p-4 text-[12px] font-mono leading-relaxed overflow-x-auto"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{`# Make your first API call
curl https://api.vani.live/v1/agents \\
  -H "Authorization: Bearer vani_YOUR_KEY"`}</pre>
            <a href="https://docs.vani.live" target="_blank" rel="noreferrer"
              className="text-[12px] font-medium hover:underline mt-2 inline-block" style={{ color: 'var(--accent)' }}>
              View API Documentation →
            </a>
          </div>
        </div>
      )}

      {/* ── Billing ── */}
      {activeTab === 'billing' && (
        <div className="space-y-4 max-w-2xl">
          {loadingBilling ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Current plan */}
              <div className="glass p-5">
                <h2 className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text)' }}>Current Plan</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="rounded-xl p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                    <p className="text-[11px] uppercase tracking-[0.04em] mb-1" style={{ color: 'var(--text-muted)' }}>Status</p>
                    <p className="text-[18px] font-bold" style={{ color: 'var(--text)' }}>{billing?.status || 'Unknown'}</p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                    <p className="text-[11px] uppercase tracking-[0.04em] mb-1" style={{ color: 'var(--text-muted)' }}>Included Minutes</p>
                    <p className="text-[18px] font-bold" style={{ color: 'var(--text)' }}>{(billing?.minutes_limit ?? 1000).toLocaleString()} min</p>
                  </div>
                </div>
                {/* Usage bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>Usage This Period</p>
                    <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{usedMin.toLocaleString()} / {limitMin.toLocaleString()} min</p>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: pct > 80 ? 'var(--red)' : 'var(--accent)' }} />
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{pct.toFixed(1)}% used</p>
                </div>
              </div>

              {/* Cost breakdown */}
              <div className="glass p-5">
                <h2 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text)' }}>Cost Breakdown</h2>
                {billing?.cost_breakdown ? (
                  <p style={{ color: 'var(--text-secondary)' }}>—</p>
                ) : (
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No cost data available for this period.</p>
                )}
              </div>

              {/* Invoices */}
              <div className="glass p-5">
                <h2 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text)' }}>Invoice History</h2>
                {billing?.invoices?.length ? (
                  <div>{/* invoice rows */}</div>
                ) : (
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No invoices yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`text-[13px] font-medium ${mono ? 'font-mono text-[11px]' : ''}`} style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
