import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

const PLAN_LIMITS = { starter: 5, growth: 20, enterprise: 100 }

// ── Team Management ─────────────────────────────────────────────────────────
function TeamSection() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteName, setInviteName]     = useState('')
  const [inviteRole, setInviteRole]     = useState('member')
  const [inviting, setInviting]         = useState(false)
  const [inviteError, setInviteError]   = useState('')

  useEffect(() => {
    api.listTeam().then(setMembers).catch(console.error).finally(() => setLoading(false))
  }, [])

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteName.trim()) return
    setInviteError('')
    setInviting(true)
    try {
      const m = await api.inviteMember({ email: inviteEmail.trim(), name: inviteName.trim(), role: inviteRole })
      setMembers(ms => [...ms, m])
      setInviteEmail('')
      setInviteName('')
    } catch (err) { setInviteError(err.message) }
    finally { setInviting(false) }
  }

  async function handleRoleChange(id, role) {
    await api.updateMember(id, role)
    setMembers(ms => ms.map(m => m.id === id ? { ...m, role } : m))
  }

  async function handleRemove(id) {
    if (!confirm('Remove this team member?')) return
    await api.removeMember(id)
    setMembers(ms => ms.filter(m => m.id !== id))
  }

  const ROLE_COLORS = { admin: 'text-[#2563EB] bg-[#2563EB]/10', member: 'text-emerald-400 bg-emerald-500/10', viewer: 'text-[#78716C] bg-slate-500/10' }

  return (
    <Section title="Team" className="mt-5">
      <p className="text-sm text-[#A8A29E] mb-4">
        Invite teammates to collaborate in this workspace. Admins can edit agents and settings. Members can run calls. Viewers can only view data.
      </p>

      <form onSubmit={handleInvite} className="grid grid-cols-5 gap-2 mb-5">
        <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name"
          className="col-span-2 bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]" />
        <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address"
          className="col-span-2 bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]" />
        <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
          className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-2 py-2 text-sm text-[#1A1816] focus:outline-none focus:border-[#2563EB]">
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
        <button type="submit" disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
          className="col-span-5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {inviting ? 'Inviting…' : 'Invite Member'}
        </button>
      </form>

      {inviteError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{inviteError}</p>}

      {loading ? (
        <div className="text-center py-4 text-sm text-[#A8A29E]">Loading…</div>
      ) : members.length === 0 ? (
        <div className="text-center py-4 text-sm text-[#A8A29E]">No team members yet. Invite someone above.</div>
      ) : (
        <div className="divide-y divide-[#F0EDEA] border border-[#E8E5E2] rounded-lg overflow-hidden">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-[#FAFAF9]">
              <div className="w-8 h-8 rounded-full bg-[#2563EB]/20 flex items-center justify-center text-sm font-semibold text-[#2563EB] shrink-0">
                {m.name[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#44403C]">{m.name}</p>
                <p className="text-[13px] text-[#A8A29E]">{m.email}</p>
              </div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                m.status === 'invited' ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'
              }`}>
                {m.status}
              </span>
              <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)}
                className={`text-sm px-2 py-0.5 rounded font-medium bg-transparent border-0 focus:outline-none cursor-pointer ${ROLE_COLORS[m.role] || 'text-[#78716C]'}`}>
                <option value="admin">admin</option>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
              <button onClick={() => handleRemove(m.id)}
                className="text-sm text-red-400/70 hover:text-red-400 transition-colors ml-1">Remove</button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listKeys()
      .then(setKeys)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setError('')
    setCreating(true)
    try {
      const key = await api.createKey(newKeyName.trim())
      setCreatedKey(key)
      setKeys(k => [key, ...k])
      setNewKeyName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Revoke this API key?')) return
    await api.deleteKey(id)
    setKeys(k => k.filter(x => x.id !== id))
  }

  const plan = user?.plan || 'starter'
  const maxConcurrent = PLAN_LIMITS[plan] || 5

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-3xl">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-[#1A1816]">Settings</h1>
          <p className="text-base text-[#A8A29E] mt-0.5">Account, API keys, and telephony configuration</p>
        </div>

        {/* Account */}
        <Section title="Account">
          <div className="space-y-3">
            <InfoRow label="Email" value={user?.email || '—'} />
            <InfoRow label="Tenant ID" value={<span className="font-mono text-sm">{user?.id || '—'}</span>} />
            <InfoRow label="Plan" value={
              <span className={`font-medium ${plan === 'enterprise' ? 'text-amber-400' : plan === 'growth' ? 'text-[#2563EB]' : 'text-[#44403C]'} capitalize`}>
                {plan}
              </span>
            } />
            <InfoRow label="Concurrent Call Limit" value={
              <span className="text-emerald-400 font-medium">{maxConcurrent} simultaneous calls</span>
            } />
          </div>
        </Section>

        {/* Plan comparison */}
        <Section title="Plan Limits" className="mt-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'Starter', conc: 5, minutes: '1,000 min', highlight: plan === 'starter' },
              { name: 'Growth', conc: 20, minutes: '10,000 min', highlight: plan === 'growth' },
              { name: 'Enterprise', conc: 100, minutes: 'Unlimited', highlight: plan === 'enterprise' },
            ].map(p => (
              <div key={p.name} className={`rounded-lg border p-3 ${p.highlight ? 'border-indigo-500/40 bg-[#2563EB]/5' : 'border-[#E8E5E2]'}`}>
                <p className={`text-sm font-semibold mb-2 ${p.highlight ? 'text-[#2563EB]' : 'text-[#78716C]'}`}>
                  {p.name} {p.highlight ? '✓' : ''}
                </p>
                <p className="text-sm text-[#A8A29E]">{p.conc} concurrent</p>
                <p className="text-sm text-[#A8A29E]">{p.minutes}/mo</p>
              </div>
            ))}
          </div>
        </Section>

        {/* API Keys */}
        <Section title="API Keys" className="mt-5">
          <p className="text-sm text-[#A8A29E] mb-4">
            Use API keys to authenticate requests from your applications. Keys are shown once.
          </p>

          <form onSubmit={handleCreate} className="flex items-center gap-3 mb-5">
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Production)"
              className="flex-1 bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB] transition-colors"
            />
            <button type="submit" disabled={creating || !newKeyName.trim()}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-base transition-colors whitespace-nowrap">
              {creating ? 'Creating…' : 'Create Key'}
            </button>
          </form>

          {error && <p className="text-sm text-red-400 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          {createdKey && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-emerald-400 mb-2">
                Copy your key now — it will never be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-[#FAFAF9] rounded px-3 py-2 text-emerald-300 font-mono overflow-x-auto">
                  {createdKey.key}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(createdKey.key) }}
                  className="text-sm text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-3 py-2 rounded-lg whitespace-nowrap transition-colors">
                  Copy
                </button>
              </div>
              <button onClick={() => setCreatedKey(null)} className="text-sm text-[#A8A29E] mt-2 hover:text-[#78716C]">
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-6 text-[#A8A29E] text-base">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-6 text-[#A8A29E] text-base">No API keys yet.</div>
          ) : (
            <div className="divide-y divide-[#F0EDEA] border border-[#E8E5E2] rounded-lg overflow-hidden">
              {keys.map(k => (
                <div key={k.id} className="flex items-center gap-4 px-4 py-3.5 bg-[#FAFAF9]">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-[#44403C]">{k.name}</p>
                    <p className="text-sm text-[#A8A29E] mt-0.5">
                      Created {formatDate(k.created_at)}
                      {k.last_used && ` · Last used ${formatDate(k.last_used)}`}
                    </p>
                  </div>
                  <span className="text-sm font-mono text-[#A8A29E] bg-white px-2 py-1 rounded">
                    vani_••••••••
                  </span>
                  <button onClick={() => handleDelete(k.id)}
                    className="text-sm text-red-400/70 hover:text-red-400 transition-colors">
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Team Management */}
        <TeamSection />

        {/* Telephony endpoints */}
        <Section title="Telephony Endpoints" className="mt-5">
          <p className="text-sm text-[#A8A29E] mb-3">
            Point your provider's inbound webhook to these URLs:
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-[#A8A29E] mb-1">Twilio</p>
              <code className="block text-sm bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-4 py-2.5 text-[#3B82F6] font-mono">
                POST https://orchestrator.vani.live/telephony/inbound
              </code>
            </div>
            <div>
              <p className="text-sm text-[#A8A29E] mb-1">Exotel (India)</p>
              <code className="block text-sm bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-4 py-2.5 text-[#3B82F6] font-mono">
                POST https://orchestrator.vani.live/telephony/inbound/exotel
              </code>
            </div>
            <div>
              <p className="text-sm text-[#A8A29E] mb-1">Outbound call answered callback</p>
              <code className="block text-sm bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-4 py-2.5 text-[#3B82F6] font-mono">
                POST https://orchestrator.vani.live/telephony/outbound/answered/{'{call_id}'}
              </code>
            </div>
          </div>
        </Section>

        {/* Quick reference */}
        <Section title="API Quick Reference" className="mt-5">
          <div className="space-y-2">
            {[
              ['POST', '/calls/outbound', 'Trigger outbound call'],
              ['POST', '/calls/:id/stop', 'Stop queued/active call'],
              ['POST', '/campaigns', 'Create bulk campaign'],
              ['POST', '/campaigns/:id/contacts', 'Upload contacts (CSV/JSON)'],
              ['POST', '/campaigns/:id/start', 'Start dialing'],
              ['GET',  '/analytics/overview', 'KPI dashboard data'],
              ['GET',  '/agents/:id/tools', 'List agent tools'],
              ['POST', '/agents/:id/tools', 'Add function calling tool'],
            ].map(([method, path, desc]) => (
              <div key={path} className="flex items-center gap-3">
                <span className={`text-sm font-mono font-bold w-10 ${method === 'GET' ? 'text-blue-400' : 'text-emerald-400'}`}>
                  {method}
                </span>
                <code className="text-sm text-[#78716C] font-mono flex-1">{path}</code>
                <span className="text-sm text-[#A8A29E]">{desc}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-[#E8E5E2] p-6 ${className}`}>
      <h2 className="text-base font-semibold text-[#1A1816] mb-4">{title}</h2>
      {children}
    </div>
  )
}
function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#A8A29E]">{label}</span>
      <span className="text-sm text-[#44403C]">{value}</span>
    </div>
  )
}
function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
