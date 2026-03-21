import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

const STATUS_COLORS = {
  draft:      'text-slate-400 bg-slate-500/10',
  scheduled:  'text-blue-400 bg-blue-500/10',
  running:    'text-emerald-400 bg-emerald-500/10',
  paused:     'text-amber-400 bg-amber-500/10',
  completed:  'text-indigo-400 bg-indigo-500/10',
  cancelled:  'text-red-400 bg-red-500/10',
}

const CONTACT_STATUS_COLORS = {
  pending:   'text-slate-400',
  calling:   'text-blue-400',
  completed: 'text-emerald-400',
  failed:    'text-red-400',
  retry:     'text-amber-400',
  dnc:       'text-red-500',
  voicemail: 'text-purple-400',
  skipped:   'text-slate-600',
}

export default function CampaignDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    api.getCampaign(id)
      .then(setCampaign)
      .catch(() => navigate('/campaigns'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    if (!id) return
    setContactsLoading(true)
    const params = {}
    if (statusFilter) params.status = statusFilter
    api.getCampaignContacts(id, params)
      .then(setContacts)
      .catch(console.error)
      .finally(() => setContactsLoading(false))
  }, [id, statusFilter])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    setUploadSuccess('')
    try {
      const result = await api.uploadCampaignContacts(id, file)
      setUploadSuccess(`Uploaded ${result.inserted} contacts (${result.total} total)`)
      const updated = await api.getCampaign(id)
      setCampaign(updated)
      const c = await api.getCampaignContacts(id, statusFilter ? { status: statusFilter } : {})
      setContacts(c)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleAction(action) {
    setActionLoading(true)
    try {
      await api[`${action}Campaign`](id)
      const updated = await api.getCampaign(id)
      setCampaign(updated)
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-slate-600">Loading…</div>
  if (!campaign) return null

  const pct = campaign.total_contacts
    ? Math.round((campaign.called / campaign.total_contacts) * 100)
    : 0

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <button onClick={() => navigate('/campaigns')} className="text-slate-500 hover:text-slate-300 text-sm">
            ← Campaigns
          </button>
          <span className="text-slate-700">/</span>
          <h1 className="text-xl font-semibold text-white">{campaign.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[campaign.status] || 'text-slate-400 bg-slate-500/10'}`}>
            {campaign.status}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <StatCard label="Total" value={campaign.total_contacts} />
          <StatCard label="Called" value={campaign.called} color="indigo" />
          <StatCard label="Answered" value={campaign.answered} color="emerald" />
          <StatCard label="Progress" value={`${pct}%`} color="indigo" />
          <StatCard label="Max Attempts" value={campaign.max_attempts} />
        </div>

        {/* Progress bar */}
        <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-white">Dialing Progress</h2>
            <span className="text-xs text-slate-500">{campaign.called} / {campaign.total_contacts} contacts called</span>
          </div>
          <div className="h-2 bg-[#1f2235] rounded-full overflow-hidden">
            <div
              style={{ width: `${pct}%` }}
              className="h-full bg-indigo-500 rounded-full transition-all"
            />
          </div>
          {/* Config chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            <ConfigChip label="Retry delay" value={`${campaign.retry_delay_min}min`} />
            {campaign.call_window_start && (
              <ConfigChip label="Window" value={`${campaign.call_window_start}–${campaign.call_window_end}`} />
            )}
            <ConfigChip label="Timezone" value={campaign.timezone} />
          </div>
        </div>

        {/* Actions + upload */}
        <div className="flex items-center gap-3 mb-5">
          {campaign.status === 'draft' || campaign.status === 'paused' ? (
            <button
              disabled={actionLoading || !campaign.total_contacts}
              onClick={() => handleAction('start')}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">
              {actionLoading ? 'Starting…' : '▶ Start Campaign'}
            </button>
          ) : campaign.status === 'running' ? (
            <button
              disabled={actionLoading}
              onClick={() => handleAction('pause')}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-medium px-4 py-2 rounded-lg text-sm transition-colors">
              ⏸ Pause
            </button>
          ) : null}

          {!['completed', 'cancelled'].includes(campaign.status) && (
            <button
              disabled={actionLoading}
              onClick={() => handleAction('cancel')}
              className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 font-medium px-4 py-2 rounded-lg text-sm transition-colors">
              Cancel
            </button>
          )}

          {/* Upload contacts */}
          {['draft', 'paused'].includes(campaign.status) && (
            <label className="cursor-pointer flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-[#2a2d3a] text-slate-300 px-4 py-2 rounded-lg text-sm transition-colors">
              <span>{uploading ? 'Uploading…' : '↑ Upload Contacts'}</span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {uploadError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{uploadError}</p>
        )}
        {uploadSuccess && (
          <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4">{uploadSuccess}</p>
        )}

        {/* Upload hint */}
        {campaign.status === 'draft' && campaign.total_contacts === 0 && (
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-6 mb-5 text-center">
            <p className="text-slate-400 text-sm mb-1">No contacts yet</p>
            <p className="text-xs text-slate-600">
              Upload a CSV with columns: <span className="text-slate-500 font-mono">phone, name, [any_variable]</span>
              <br />Extra columns become available as <span className="text-slate-500 font-mono">{'{first_name}'}</span> variables in your agent prompt.
            </p>
          </div>
        )}

        {/* Contact list */}
        {campaign.total_contacts > 0 && (
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235]">
            <div className="px-5 py-4 border-b border-[#1f2235] flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Contacts</h2>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-2 py-1 text-xs text-slate-400 focus:outline-none">
                <option value="">All statuses</option>
                {['pending', 'calling', 'completed', 'failed', 'retry', 'dnc', 'voicemail', 'skipped'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {contactsLoading ? (
              <div className="py-8 text-center text-slate-600 text-sm">Loading…</div>
            ) : contacts.length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-sm">No contacts match this filter</div>
            ) : (
              <div className="divide-y divide-[#1f2235]">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-mono">{c.phone}</p>
                      {c.name && <p className="text-xs text-slate-500">{c.name}</p>}
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className={`font-medium capitalize ${CONTACT_STATUS_COLORS[c.status] || 'text-slate-400'}`}>
                        {c.status}
                      </span>
                      {c.attempts > 0 && (
                        <span className="text-slate-600">{c.attempts}× tried</span>
                      )}
                      {c.last_outcome && (
                        <span className="text-slate-600 capitalize">{c.last_outcome.replace('-', ' ')}</span>
                      )}
                      {c.status === 'retry' && c.next_retry_at && (
                        <span className="text-amber-400/70">
                          retry {formatRelative(c.next_retry_at)}
                        </span>
                      )}
                      {c.call_id && (
                        <button
                          onClick={() => navigate(`/calls/${c.call_id}`)}
                          className="text-indigo-400 hover:text-indigo-300">
                          View call →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colorMap = {
    indigo: 'text-indigo-400',
    emerald: 'text-emerald-400',
  }
  return (
    <div className="bg-[#12141f] rounded-xl border border-[#1f2235] px-4 py-3.5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${colorMap[color] || 'text-white'}`}>{value}</p>
    </div>
  )
}

function ConfigChip({ label, value }) {
  return (
    <span className="text-xs text-slate-500 bg-white/[0.04] border border-white/5 px-2.5 py-0.5 rounded">
      {label}: <span className="text-slate-400">{value}</span>
    </span>
  )
}

function formatRelative(isoStr) {
  if (!isoStr) return ''
  const diff = new Date(isoStr) - new Date()
  if (diff <= 0) return 'soon'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  return `in ${Math.round(mins / 60)}h`
}
