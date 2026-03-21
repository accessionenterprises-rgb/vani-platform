import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

const PLAN_LIMITS = { starter: 5, growth: 20, enterprise: 100 }

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
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Account, API keys, and telephony configuration</p>
        </div>

        {/* Account */}
        <Section title="Account">
          <div className="space-y-3">
            <InfoRow label="Email" value={user?.email || '—'} />
            <InfoRow label="Tenant ID" value={<span className="font-mono text-xs">{user?.id || '—'}</span>} />
            <InfoRow label="Plan" value={
              <span className={`font-medium ${plan === 'enterprise' ? 'text-amber-400' : plan === 'growth' ? 'text-indigo-400' : 'text-slate-300'} capitalize`}>
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
              <div key={p.name} className={`rounded-lg border p-3 ${p.highlight ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-[#1f2235]'}`}>
                <p className={`text-xs font-semibold mb-2 ${p.highlight ? 'text-indigo-400' : 'text-slate-400'}`}>
                  {p.name} {p.highlight ? '✓' : ''}
                </p>
                <p className="text-xs text-slate-500">{p.conc} concurrent</p>
                <p className="text-xs text-slate-500">{p.minutes}/mo</p>
              </div>
            ))}
          </div>
        </Section>

        {/* API Keys */}
        <Section title="API Keys" className="mt-5">
          <p className="text-xs text-slate-500 mb-4">
            Use API keys to authenticate requests from your applications. Keys are shown once.
          </p>

          <form onSubmit={handleCreate} className="flex items-center gap-3 mb-5">
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Production)"
              className="flex-1 bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button type="submit" disabled={creating || !newKeyName.trim()}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap">
              {creating ? 'Creating…' : 'Create Key'}
            </button>
          </form>

          {error && <p className="text-xs text-red-400 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          {createdKey && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-4">
              <p className="text-xs font-medium text-emerald-400 mb-2">
                Copy your key now — it will never be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-[#0d0f18] rounded px-3 py-2 text-emerald-300 font-mono overflow-x-auto">
                  {createdKey.key}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(createdKey.key) }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-3 py-2 rounded-lg whitespace-nowrap transition-colors">
                  Copy
                </button>
              </div>
              <button onClick={() => setCreatedKey(null)} className="text-xs text-slate-500 mt-2 hover:text-slate-400">
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-6 text-slate-600 text-sm">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-6 text-slate-600 text-sm">No API keys yet.</div>
          ) : (
            <div className="divide-y divide-[#1f2235] border border-[#1f2235] rounded-lg overflow-hidden">
              {keys.map(k => (
                <div key={k.id} className="flex items-center gap-4 px-4 py-3.5 bg-[#0d0f18]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{k.name}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Created {formatDate(k.created_at)}
                      {k.last_used && ` · Last used ${formatDate(k.last_used)}`}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-600 bg-[#12141f] px-2 py-1 rounded">
                    vani_••••••••
                  </span>
                  <button onClick={() => handleDelete(k.id)}
                    className="text-xs text-red-400/70 hover:text-red-400 transition-colors">
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Telephony endpoints */}
        <Section title="Telephony Endpoints" className="mt-5">
          <p className="text-xs text-slate-500 mb-3">
            Point your provider's inbound webhook to these URLs:
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Twilio</p>
              <code className="block text-xs bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-4 py-2.5 text-indigo-300 font-mono">
                POST https://orchestrator.vani.live/telephony/inbound
              </code>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Exotel (India)</p>
              <code className="block text-xs bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-4 py-2.5 text-indigo-300 font-mono">
                POST https://orchestrator.vani.live/telephony/inbound/exotel
              </code>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Outbound call answered callback</p>
              <code className="block text-xs bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-4 py-2.5 text-indigo-300 font-mono">
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
                <span className={`text-xs font-mono font-bold w-10 ${method === 'GET' ? 'text-blue-400' : 'text-emerald-400'}`}>
                  {method}
                </span>
                <code className="text-xs text-slate-400 font-mono flex-1">{path}</code>
                <span className="text-xs text-slate-600">{desc}</span>
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
    <div className={`bg-[#12141f] rounded-xl border border-[#1f2235] p-6 ${className}`}>
      <h2 className="text-sm font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  )
}
function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-300">{value}</span>
    </div>
  )
}
function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
