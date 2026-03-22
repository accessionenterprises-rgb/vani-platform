import { useEffect, useState } from 'react'
import { api } from '../api/client'

const ALL_EVENTS = ['call.started', 'call.ended', 'call.analyzed']

export default function WebhooksPage() {
  const [hooks, setHooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ url: '', events: [] })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [createdSecret, setCreatedSecret] = useState(null)

  useEffect(() => {
    api.listWebhooks().then(data => setHooks(Array.isArray(data) ? data : []))
      .catch(console.error).finally(() => setLoading(false))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.url || form.events.length === 0) {
      setError('URL and at least one event required')
      return
    }
    setError('')
    setSaving(true)
    try {
      const created = await api.createWebhook({ url: form.url, events: form.events })
      setCreatedSecret(created.secret)
      setHooks(h => [{ ...created, secret: null }, ...h])
      setAdding(false)
      setForm({ url: '', events: [] })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this webhook?')) return
    await api.deleteWebhook(id).catch(console.error)
    setHooks(h => h.filter(x => x.id !== id))
  }

  async function handleToggle(id, active) {
    await api.updateWebhook(id, { active: !active }).catch(console.error)
    setHooks(h => h.map(x => x.id === id ? { ...x, active: !active } : x))
  }

  function toggleEvent(ev) {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }))
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-4xl">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-semibold text-white">Webhooks</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Subscribe to call events. Payload is signed with HMAC-SHA256.
            </p>
          </div>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <span className="text-lg leading-none">+</span> Add Webhook
          </button>
        </div>

        {/* Secret banner */}
        {createdSecret && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 mb-5">
            <p className="text-xs font-semibold text-emerald-400 mb-2">
              Save your signing secret — shown only once.
            </p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-xs bg-[#0d0f18] rounded-lg px-3 py-2.5 text-emerald-300 font-mono overflow-x-auto">
                {createdSecret}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(createdSecret) }}
                className="text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-lg whitespace-nowrap transition-colors">
                Copy
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Verify: <code className="text-slate-400">HMAC-SHA256(secret, request_body)</code> == <code className="text-slate-400">X-Vaani-Signature</code> header
            </p>
            <button onClick={() => setCreatedSecret(null)} className="text-xs text-slate-600 mt-2 hover:text-slate-400">
              Dismiss
            </button>
          </div>
        )}

        {/* Add form */}
        {adding && (
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-6 mb-5">
            <h2 className="text-sm font-semibold text-white mb-5">New Webhook</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Endpoint URL</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  required placeholder="https://your-server.com/webhook"
                  className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2.5">Events to subscribe</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_EVENTS.map(ev => (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        form.events.includes(ev)
                          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                          : 'bg-white/[0.04] text-slate-500 border border-transparent hover:text-slate-300'
                      }`}>
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">
                  {saving ? 'Creating…' : 'Create Webhook'}
                </button>
                <button type="button" onClick={() => { setAdding(false); setError('') }}
                  className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-10 text-slate-600 text-sm">Loading…</div>
        ) : hooks.length === 0 ? (
          <div className="text-center py-16 bg-[#12141f] rounded-xl border border-[#1f2235]">
            <p className="text-slate-400 font-medium mb-1">No webhooks yet</p>
            <p className="text-sm text-slate-600">Subscribe to call events to integrate with your systems</p>
          </div>
        ) : (
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] divide-y divide-[#1f2235]">
            {hooks.map(hook => (
              <div key={hook.id} className="flex items-start gap-4 px-5 py-4">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${hook.active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white font-mono truncate">{hook.url}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(hook.events || []).map(ev => (
                      <span key={ev} className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleToggle(hook.id, hook.active)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      hook.active
                        ? 'text-slate-400 bg-white/5 hover:text-slate-200'
                        : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15'
                    }`}>
                    {hook.active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => handleDelete(hook.id)}
                    className="text-xs text-red-400/70 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payload example */}
        <div className="mt-6 bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
          <h2 className="text-sm font-medium text-white mb-3">Example Payload</h2>
          <pre className="text-xs text-slate-400 font-mono overflow-x-auto">{`{
  "event": "call.analyzed",
  "timestamp": "2026-03-21T12:00:00Z",
  "data": {
    "call_id": "uuid",
    "sentiment": "positive",
    "intent": "booking",
    "summary": "Customer booked a table for 4 at 8pm Friday.",
    "resolved": true
  }
}`}</pre>
        </div>
      </div>
    </div>
  )
}
