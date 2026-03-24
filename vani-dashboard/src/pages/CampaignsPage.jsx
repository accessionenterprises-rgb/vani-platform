import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const STATUS_COLORS = {
  draft:      'text-[#78716C] bg-slate-500/10',
  scheduled:  'text-blue-400 bg-blue-500/10',
  running:    'text-emerald-400 bg-emerald-500/10',
  paused:     'text-amber-400 bg-amber-500/10',
  completed:  'text-[#2563EB] bg-[#2563EB]/10',
  cancelled:  'text-red-400 bg-red-500/10',
}

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles',
  'Australia/Sydney', 'UTC',
]

export default function CampaignsPage() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [agents, setAgents] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [form, setForm] = useState({
    name: '', agent_id: '', from_number: '',
    max_attempts: 3, retry_delay_min: 60,
    call_window_start: '', call_window_end: '',
    timezone: 'Asia/Kolkata',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([api.listCampaigns(), api.listAgents()])
      .then(([cList, aList]) => { setCampaigns(cList); setAgents(aList) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name || !form.agent_id) { setError('Name and agent required'); return }
    setError('')
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        agent_id: form.agent_id,
        from_number: form.from_number || undefined,
        max_attempts: Number(form.max_attempts),
        retry_delay_min: Number(form.retry_delay_min),
        timezone: form.timezone,
        call_window_start: form.call_window_start || undefined,
        call_window_end: form.call_window_end || undefined,
      }
      const c = await api.createCampaign(payload)
      navigate(`/campaigns/${c.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAction(e, id, action) {
    e.stopPropagation()
    try {
      await api[`${action}Campaign`](id)
      const updated = await api.listCampaigns()
      setCampaigns(updated)
    } catch (err) {
      alert(err.message)
    }
  }

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-5xl">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1816]">Campaigns</h1>
            <p className="text-base text-[#A8A29E] mt-0.5">Bulk outbound calling at scale</p>
          </div>
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-base font-medium px-4 py-2 rounded-lg transition-colors">
            <span className="text-xl leading-none">+</span> New Campaign
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="bg-white rounded-xl border border-[#E8E5E2] p-6 mb-5">
            <h2 className="text-base font-semibold text-[#1A1816] mb-5">New Campaign</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#78716C] mb-1.5">Campaign Name</label>
                  <input value={form.name} onChange={e => upd('name', e.target.value)}
                    placeholder="Q2 Follow-ups"
                    className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB] transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#78716C] mb-1.5">Agent</label>
                  <select value={form.agent_id} onChange={e => upd('agent_id', e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-base text-[#1A1816] focus:outline-none focus:border-[#2563EB] transition-colors">
                    <option value="">Select agent…</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#78716C] mb-1.5">
                  From Number <span className="text-[#A8A29E] font-normal">— optional, uses agent default</span>
                </label>
                <input value={form.from_number} onChange={e => upd('from_number', e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB] transition-colors" />
              </div>

              {/* Advanced toggle */}
              <button type="button" onClick={() => setShowAdvanced(a => !a)}
                className="text-sm text-[#A8A29E] hover:text-[#44403C] flex items-center gap-1.5 transition-colors">
                <span>{showAdvanced ? '▾' : '▸'}</span>
                Advanced — retry logic &amp; call window
              </button>

              {showAdvanced && (
                <div className="bg-[#FAFAF9] rounded-xl border border-[#E8E5E2] p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#78716C] mb-1.5">
                        Max Attempts <span className="text-[#A8A29E] font-normal">per contact</span>
                      </label>
                      <select value={form.max_attempts} onChange={e => upd('max_attempts', e.target.value)}
                        className="w-full bg-white border border-[#E8E5E2] rounded-lg px-3 py-2 text-base text-[#1A1816] focus:outline-none focus:border-[#2563EB]">
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}×</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#78716C] mb-1.5">
                        Retry Delay <span className="text-[#A8A29E] font-normal">on no-answer / busy / voicemail</span>
                      </label>
                      <select value={form.retry_delay_min} onChange={e => upd('retry_delay_min', e.target.value)}
                        className="w-full bg-white border border-[#E8E5E2] rounded-lg px-3 py-2 text-base text-[#1A1816] focus:outline-none focus:border-[#2563EB]">
                        {[15, 30, 60, 120, 240, 480, 1440].map(n => (
                          <option key={n} value={n}>{n < 60 ? `${n} min` : `${n / 60} hr`}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#78716C] mb-1.5">
                      Call Window <span className="text-[#A8A29E] font-normal">— leave blank to dial 24/7</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input type="time" value={form.call_window_start} onChange={e => upd('call_window_start', e.target.value)}
                        className="bg-white border border-[#E8E5E2] rounded-lg px-3 py-2 text-base text-[#1A1816] focus:outline-none focus:border-[#2563EB]" />
                      <span className="text-[#A8A29E] text-sm shrink-0">to</span>
                      <input type="time" value={form.call_window_end} onChange={e => upd('call_window_end', e.target.value)}
                        className="bg-white border border-[#E8E5E2] rounded-lg px-3 py-2 text-base text-[#1A1816] focus:outline-none focus:border-[#2563EB]" />
                      <select value={form.timezone} onChange={e => upd('timezone', e.target.value)}
                        className="bg-white border border-[#E8E5E2] rounded-lg px-3 py-2 text-base text-[#44403C] focus:outline-none focus:border-[#2563EB] flex-1">
                        {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-base transition-colors">
                  {saving ? 'Creating…' : 'Create Campaign'}
                </button>
                <button type="button" onClick={() => { setCreating(false); setError(''); setShowAdvanced(false) }}
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
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-[#E8E5E2]">
            <p className="text-[#78716C] font-medium mb-1">No campaigns yet</p>
            <p className="text-base text-[#A8A29E]">Create a campaign to start bulk outbound calling</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E8E5E2] divide-y divide-[#F0EDEA]">
            {campaigns.map(c => (
              <div key={c.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[#FAFAF9] cursor-pointer transition-colors"
                onClick={() => navigate(`/campaigns/${c.id}`)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <p className="text-base font-medium text-[#1A1816]">{c.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] || 'text-[#78716C] bg-slate-500/10'}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[#A8A29E]">
                    <span>{c.total_contacts} contacts</span>
                    <span>·</span>
                    <span className="text-emerald-400">{c.answered} answered</span>
                    <span>·</span>
                    <span>{c.called} called</span>
                    <span>·</span>
                    <span>retry ×{c.max_attempts}</span>
                    {c.call_window_start && (
                      <>
                        <span>·</span>
                        <span className="text-[#A8A29E]">{c.call_window_start}–{c.call_window_end}</span>
                      </>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-24">
                  <div className="h-1 bg-[#F5F5F4] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${c.total_contacts ? (c.called / c.total_contacts * 100) : 0}%` }}
                      className="h-full bg-[#2563EB] rounded-full transition-all"
                    />
                  </div>
                  <p className="text-sm text-[#A8A29E] mt-1 text-right">
                    {c.total_contacts ? Math.round(c.called / c.total_contacts * 100) : 0}%
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  {c.status === 'running' && (
                    <button onClick={e => handleAction(e, c.id, 'pause')}
                      className="text-sm text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors">
                      Pause
                    </button>
                  )}
                  {c.status === 'paused' && (
                    <button onClick={e => handleAction(e, c.id, 'start')}
                      className="text-sm text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors">
                      Resume
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
