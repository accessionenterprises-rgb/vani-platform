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
            <h1 className="text-2xl font-semibold text-[#1A1816]">Webhooks</h1>
            <p className="text-base text-[#A8A29E] mt-0.5">
              Subscribe to call events. Payload is signed with HMAC-SHA256.
            </p>
          </div>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-base font-medium px-4 py-2 rounded-lg transition-colors">
            <span className="text-xl leading-none">+</span> Add Webhook
          </button>
        </div>

        {/* Secret banner */}
        {createdSecret && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 mb-5">
            <p className="text-sm font-semibold text-emerald-400 mb-2">
              Save your signing secret — shown only once.
            </p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-sm bg-[#FAFAF9] rounded-lg px-3 py-2.5 text-emerald-300 font-mono overflow-x-auto">
                {createdSecret}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(createdSecret) }}
                className="text-sm text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-lg whitespace-nowrap transition-colors">
                Copy
              </button>
            </div>
            <p className="text-sm text-[#A8A29E] mt-2">
              Verify: <code className="text-[#78716C]">HMAC-SHA256(secret, request_body)</code> == <code className="text-[#78716C]">X-Vaani-Signature</code> header
            </p>
            <button onClick={() => setCreatedSecret(null)} className="text-sm text-[#A8A29E] mt-2 hover:text-[#78716C]">
              Dismiss
            </button>
          </div>
        )}

        {/* Add form */}
        {adding && (
          <div className="bg-white rounded-xl border border-[#E8E5E2] p-6 mb-5">
            <h2 className="text-base font-semibold text-[#1A1816] mb-5">New Webhook</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#78716C] mb-1.5">Endpoint URL</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  required placeholder="https://your-server.com/webhook"
                  className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB] transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#78716C] mb-2.5">Events to subscribe</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_EVENTS.map(ev => (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        form.events.includes(ev)
                          ? 'bg-[#2563EB]/20 text-[#2563EB] border border-indigo-500/40'
                          : 'bg-[#F5F5F4] text-[#A8A29E] border border-transparent hover:text-[#44403C]'
                      }`}>
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-base transition-colors">
                  {saving ? 'Creating…' : 'Create Webhook'}
                </button>
                <button type="button" onClick={() => { setAdding(false); setError('') }}
                  className="text-[#78716C] hover:text-[#44403C] text-base px-4 py-2 rounded-lg hover:bg-[#F5F5F4] transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-10 text-[#A8A29E] text-base">Loading…</div>
        ) : hooks.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-[#E8E5E2]">
            <p className="text-[#78716C] font-medium mb-1">No webhooks yet</p>
            <p className="text-base text-[#A8A29E]">Subscribe to call events to integrate with your systems</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E8E5E2] divide-y divide-[#F0EDEA]">
            {hooks.map(hook => (
              <div key={hook.id} className="flex items-start gap-4 px-5 py-4">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${hook.active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-[#1A1816] font-mono truncate">{hook.url}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(hook.events || []).map(ev => (
                      <span key={ev} className="text-sm bg-[#2563EB]/10 text-[#2563EB] px-2 py-0.5 rounded">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleToggle(hook.id, hook.active)}
                    className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                      hook.active
                        ? 'text-[#78716C] bg-[#F5F5F4] hover:text-[#44403C]'
                        : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15'
                    }`}>
                    {hook.active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => handleDelete(hook.id)}
                    className="text-sm text-red-400/70 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payload example */}
        <div className="mt-6 bg-white rounded-xl border border-[#E8E5E2] p-5">
          <h2 className="text-base font-medium text-[#1A1816] mb-3">Example Payload</h2>
          <pre className="text-sm text-[#78716C] font-mono overflow-x-auto">{`{
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
