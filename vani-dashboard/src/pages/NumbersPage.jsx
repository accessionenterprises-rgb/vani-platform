import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function NumbersPage() {
  const [numbers, setNumbers] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ number: '', agent_id: '', provider: 'twilio', sip_uri: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([api.listNumbers(), api.listAgents()])
      .then(([n, a]) => { setNumbers(n || []); setAgents(a || []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const num = await api.addNumber(form)
      setNumbers(n => [num, ...n])
      setAdding(false)
      setForm({ number: '', agent_id: '', provider: 'twilio', sip_uri: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this number?')) return
    await api.deleteNumber(id)
    setNumbers(n => n.filter(x => x.id !== id))
  }

  const agentName = (id) => agents.find(a => a.id === id)?.name || id?.slice(0, 8) + '…'

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-4xl">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-semibold text-white">Phone Numbers</h1>
            <p className="text-sm text-slate-500 mt-0.5">Connect numbers to your agents</p>
          </div>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <span className="text-lg leading-none">+</span> Add Number
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-6 mb-5">
            <h2 className="text-sm font-semibold text-white mb-5">Add Phone Number</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone Number</label>
                  <input value={form.number} onChange={e => setForm(f => ({...f, number: e.target.value}))}
                    required placeholder="+14155552671"
                    className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Assign to Agent</label>
                  <select value={form.agent_id} onChange={e => setForm(f => ({...f, agent_id: e.target.value}))}
                    required
                    className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    <option value="">Select agent…</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Provider</label>
                  <select value={form.provider} onChange={e => setForm(f => ({...f, provider: e.target.value}))}
                    className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    <option value="twilio">Twilio</option>
                    <option value="exotel">Exotel</option>
                    <option value="plivo">Plivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">SIP URI <span className="text-slate-600 font-normal">(optional)</span></label>
                  <input value={form.sip_uri} onChange={e => setForm(f => ({...f, sip_uri: e.target.value}))}
                    placeholder="sip:+1234@sip.twilio.com"
                    className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
              {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">
                  {saving ? 'Adding…' : 'Add Number'}
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
        ) : numbers.length === 0 ? (
          <div className="text-center py-16 bg-[#12141f] rounded-xl border border-[#1f2235]">
            <p className="text-slate-400 font-medium mb-1">No numbers yet</p>
            <p className="text-sm text-slate-600">Add a Twilio or Exotel number to start receiving calls</p>
          </div>
        ) : (
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] divide-y divide-[#1f2235]">
            {numbers.map(num => (
              <div key={num.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73A16 16 0 0 0 15.27 16.09l1.92-1.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{num.number}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {num.provider} · Agent: {agentName(num.agent_id)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${num.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                    {num.status}
                  </span>
                  <button onClick={() => handleDelete(num.id)}
                    className="text-xs text-red-400/70 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
