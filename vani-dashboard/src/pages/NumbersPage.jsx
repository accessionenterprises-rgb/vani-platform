import { useEffect, useState } from 'react'
import { api } from '../api/client'

const COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'IN', label: 'India' },
  { code: 'SG', label: 'Singapore' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
]

export default function NumbersPage() {
  const [numbers, setNumbers]   = useState([])
  const [agents, setAgents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)   // null | 'buy' | 'manual'
  const [syncing, setSyncing]   = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [error, setError]       = useState('')

  useEffect(() => {
    Promise.all([api.listNumbers(), api.listAgents()])
      .then(([n, a]) => { setNumbers(n || []); setAgents(a || []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    setError('')
    try {
      const res = await api.syncTwilioNumbers()
      setSyncResult(res)
      if (res.numbers?.length > 0) {
        const fresh = res.numbers.map(n => ({ ...n }))
        setNumbers(prev => [...fresh, ...prev])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleAssign(numberId, agentId) {
    try {
      const updated = await api.updateNumber(numberId, { agent_id: agentId || null })
      setNumbers(n => n.map(x => x.id === numberId ? { ...x, agent_id: updated.agent_id } : x))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this number from Vani? It will NOT be released from Twilio.')) return
    await api.deleteNumber(id).catch(e => setError(e.message))
    setNumbers(n => n.filter(x => x.id !== id))
  }

  const agentName = (id) => agents.find(a => a.id === id)?.name || null

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-4xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-7">
          <div>
            <h1 className="text-xl font-semibold text-white">Phone Numbers</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage numbers and connect them to your agents</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-white/5 hover:bg-white/8 border border-[#2a2d3a] hover:border-[#3a3d4a] px-4 py-2 rounded-lg transition-all disabled:opacity-50">
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {syncing ? 'Syncing…' : 'Sync from Twilio'}
            </button>
            <button
              onClick={() => { setModal('manual'); setError('') }}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-white/5 hover:bg-white/8 border border-[#2a2d3a] px-4 py-2 rounded-lg transition-colors">
              <span className="text-lg leading-none">+</span>
              Add Manually
            </button>
            <button
              onClick={() => { setModal('buy'); setError('') }}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
              Buy Number
            </button>
          </div>
        </div>

        {/* Sync result banner */}
        {syncResult && (
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl border mb-5 text-sm ${
            syncResult.synced > 0
              ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
              : 'bg-slate-500/8 border-slate-500/20 text-slate-400'
          }`}>
            <span>
              {syncResult.synced > 0
                ? `${syncResult.synced} number${syncResult.synced > 1 ? 's' : ''} imported from Twilio.${syncResult.skipped > 0 ? ` ${syncResult.skipped} already existed.` : ''}`
                : `All Twilio numbers already synced (${syncResult.skipped} found).`}
            </span>
            <button onClick={() => setSyncResult(null)} className="text-slate-500 hover:text-slate-300 ml-4">✕</button>
          </div>
        )}

        {error && (
          <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400 mb-5">
            {error}
            <button onClick={() => setError('')} className="ml-3 text-red-500 hover:text-red-400">✕</button>
          </div>
        )}

        {/* Numbers list */}
        {loading ? (
          <div className="text-center py-10 text-slate-600 text-sm">Loading…</div>
        ) : numbers.length === 0 ? (
          <div className="text-center py-16 bg-[#0d0f18] rounded-2xl border border-[#1f2235]">
            <div className="w-14 h-14 rounded-2xl bg-[#1f2235] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73A16 16 0 0 0 15.27 16.09l1.92-1.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <p className="text-slate-300 font-medium text-sm">No numbers yet</p>
            <p className="text-xs text-slate-600 mt-1.5 mb-5">Buy a new number or sync your existing Twilio numbers</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setModal('buy')}
                className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Buy a Number
              </button>
              <button onClick={handleSync} disabled={syncing}
                className="text-slate-300 bg-white/5 border border-[#2a2d3a] text-sm px-4 py-2 rounded-lg hover:bg-white/8 transition-colors disabled:opacity-50">
                Sync from Twilio
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#0d0f18] rounded-2xl border border-[#1f2235] divide-y divide-[#1a1d2e]">
            {numbers.map(num => {
              const name = agentName(num.agent_id)
              return (
                <div key={num.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl bg-[#1f2235] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73A16 16 0 0 0 15.27 16.09l1.92-1.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white font-mono">{num.number}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{num.provider}</p>
                  </div>

                  {/* Agent assign dropdown */}
                  <div className="flex items-center gap-2">
                    <select
                      value={num.agent_id || ''}
                      onChange={e => handleAssign(num.id, e.target.value)}
                      className="bg-[#12141f] border border-[#2a2d3a] text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors max-w-[180px]">
                      <option value="">— Unassigned —</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>

                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full shrink-0 ${
                    num.status === 'active'
                      ? 'bg-emerald-500/12 text-emerald-400'
                      : 'bg-slate-500/12 text-slate-500'
                  }`}>
                    {num.status}
                  </span>

                  <button onClick={() => handleDelete(num.id)}
                    className="text-xs text-red-400/60 hover:text-red-400 bg-red-500/0 hover:bg-red-500/8 px-2.5 py-1.5 rounded-lg transition-colors shrink-0">
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Buy Number Modal ── */}
      {modal === 'buy' && (
        <BuyModal
          agents={agents}
          onBought={num => {
            setNumbers(prev => [num, ...prev])
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Manual Add Modal ── */}
      {modal === 'manual' && (
        <ManualModal
          agents={agents}
          onAdded={num => {
            setNumbers(prev => [num, ...prev])
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ─── Buy Modal ────────────────────────────────────────────────────────────────

function BuyModal({ agents, onBought, onClose }) {
  const [country, setCountry]       = useState('US')
  const [type, setType]             = useState('local')
  const [areaCode, setAreaCode]     = useState('')
  const [contains, setContains]     = useState('')
  const [results, setResults]       = useState([])
  const [selected, setSelected]     = useState(null)
  const [agentId, setAgentId]       = useState('')
  const [searching, setSearching]   = useState(false)
  const [buying, setBuying]         = useState(false)
  const [error, setError]           = useState('')
  const [searched, setSearched]     = useState(false)

  async function search() {
    setError('')
    setSearching(true)
    setSelected(null)
    try {
      const params = { country, number_type: type, limit: 20 }
      if (type === 'local' && areaCode.trim()) params.area_code = areaCode.trim()
      if (contains.trim()) params.contains = contains.trim()
      const res = await api.searchTwilioNumbers(params)
      setResults(res || [])
      setSearched(true)
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        setError('Could not reach the API. Please try again in a moment.')
      } else {
        setError(err.message)
      }
    } finally {
      setSearching(false)
    }
  }

  async function buy() {
    if (!selected || !agentId) return
    setError('')
    setBuying(true)
    try {
      const num = await api.buyTwilioNumber({ phone_number: selected.phone_number, agent_id: agentId })
      onBought(num)
    } catch (err) {
      setError(err.message)
    } finally {
      setBuying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0f18] border border-[#1f2235] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1f2235] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Buy a Phone Number</h2>
            <p className="text-xs text-slate-500 mt-0.5">Search and purchase from Twilio's inventory</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Search controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Country</label>
              <select value={country} onChange={e => setCountry(e.target.value)}
                className="w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none transition-colors">
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Number Type</label>
              <div className="flex rounded-lg border border-[#2a2d3a] overflow-hidden">
                {[
                  { id: 'local',     label: 'Local' },
                  { id: 'toll_free', label: 'Toll-Free' },
                  { id: 'mobile',    label: 'Mobile' },
                ].map(t => (
                  <button key={t.id} type="button" onClick={() => setType(t.id)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                      type === t.id
                        ? 'bg-indigo-500/15 text-indigo-300'
                        : 'bg-[#080a12] text-slate-500 hover:text-slate-300'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Area Code
                <span className="text-slate-600 font-normal ml-1">— US/CA only</span>
              </label>
              <input
                value={areaCode}
                onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="415"
                disabled={type !== 'local'}
                className="w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors disabled:opacity-40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Contains
                <span className="text-slate-600 font-normal ml-1">— e.g. 1234 or 800</span>
              </label>
              <input
                value={contains}
                onChange={e => setContains(e.target.value)}
                placeholder="optional pattern"
                className="w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button onClick={search} disabled={searching}
            className="w-full flex items-center justify-center gap-2 bg-[#12141f] hover:bg-[#1a1d2e] border border-[#2a2d3a] hover:border-[#3a3d4a] text-slate-200 text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50">
            {searching ? (
              <><div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />Searching Twilio…</>
            ) : (
              <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Search Available Numbers</>
            )}
          </button>

          {/* Results */}
          {searched && results.length === 0 && !searching && (
            <p className="text-xs text-slate-600 text-center py-4">No numbers found. Try a different area code or type.</p>
          )}

          {results.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">{results.length} numbers available</p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {results.map(n => (
                  <button key={n.phone_number} type="button"
                    onClick={() => setSelected(s => s?.phone_number === n.phone_number ? null : n)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                      selected?.phone_number === n.phone_number
                        ? 'bg-indigo-500/10 border-indigo-500/40'
                        : 'bg-[#080a12] border-[#2a2d3a] hover:border-[#3a3d4a]'
                    }`}>
                    <div>
                      <span className={`text-sm font-mono font-medium ${selected?.phone_number === n.phone_number ? 'text-indigo-300' : 'text-white'}`}>
                        {n.phone_number}
                      </span>
                      {(n.locality || n.region) && (
                        <span className="text-xs text-slate-500 ml-2">
                          {[n.locality, n.region].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {n.capabilities.voice && (
                        <span className="text-[9px] text-slate-600 bg-slate-700/30 px-1.5 py-0.5 rounded">Voice</span>
                      )}
                      {n.capabilities.sms && (
                        <span className="text-[9px] text-slate-600 bg-slate-700/30 px-1.5 py-0.5 rounded">SMS</span>
                      )}
                      {selected?.phone_number === n.phone_number && (
                        <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="2 6.5 4.5 9 10 3" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Agent assignment + confirm */}
          {selected && (
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-indigo-300">
                Selected: <span className="font-mono">{selected.phone_number}</span>
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Assign to Agent <span className="text-red-400">*</span></label>
                <select value={agentId} onChange={e => setAgentId(e.target.value)}
                  className="w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none transition-colors">
                  <option value="">Select an agent…</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg">
                <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-xs text-amber-400">
                  This will charge your Twilio account — typically ~$1.15/month for US local numbers.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1f2235] shrink-0">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={buy}
            disabled={!selected || !agentId || buying}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
            {buying
              ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Purchasing…</>
              : <>Purchase Number</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Manual Add Modal ─────────────────────────────────────────────────────────

function ManualModal({ agents, onAdded, onClose }) {
  const [form, setForm]   = useState({ number: '', agent_id: '', provider: 'twilio', sip_uri: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const num = await api.addNumber(form)
      onAdded(num)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0f18] border border-[#1f2235] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1f2235]">
          <h2 className="text-base font-semibold text-white">Add Number Manually</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">✕</button>
        </div>
        <form onSubmit={handleAdd} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone Number</label>
            <input value={form.number} onChange={e => setForm(f => ({...f, number: e.target.value}))}
              required placeholder="+14155552671"
              className="w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Assign to Agent</label>
            <select value={form.agent_id} onChange={e => setForm(f => ({...f, agent_id: e.target.value}))}
              required
              className="w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none transition-colors">
              <option value="">Select agent…</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Provider</label>
              <select value={form.provider} onChange={e => setForm(f => ({...f, provider: e.target.value}))}
                className="w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none transition-colors">
                <option value="twilio">Twilio</option>
                <option value="exotel">Exotel</option>
                <option value="plivo">Plivo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">SIP URI <span className="text-slate-600 font-normal">(optional)</span></label>
              <input value={form.sip_uri} onChange={e => setForm(f => ({...f, sip_uri: e.target.value}))}
                placeholder="sip:+1@sip.twilio.com"
                className="w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors" />
            </div>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">
              {saving ? 'Adding…' : 'Add Number'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
