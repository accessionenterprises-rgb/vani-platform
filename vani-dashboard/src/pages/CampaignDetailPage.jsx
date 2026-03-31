import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

const STATUS_COLORS = {
  draft:      'text-[#a1a1aa] bg-slate-500/10',
  scheduled:  'text-blue-400 bg-[rgba(139,92,246,0.08)]0/10',
  running:    'text-emerald-400 bg-emerald-500/10',
  paused:     'text-amber-400 bg-amber-500/10',
  completed:  'text-[#2563EB] bg-[#2563EB]/10',
  cancelled:  'text-red-400 bg-red-500/10',
}

const CONTACT_STATUS_COLORS = {
  pending:   'text-[#a1a1aa]',
  calling:   'text-blue-400',
  completed: 'text-emerald-400',
  failed:    'text-red-400',
  retry:     'text-amber-400',
  dnc:       'text-red-500',
  voicemail: 'text-purple-400',
  skipped:   'text-[#71717a]',
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

  if (loading) return <div className="flex-1 flex items-center justify-center text-[#71717a]">Loading…</div>
  if (!campaign) return null

  const pct = campaign.total_contacts
    ? Math.round((campaign.called / campaign.total_contacts) * 100)
    : 0

  return (
    <div className="flex-1 overflow-auto bg-[#09090b]">
      <div className="px-8 py-7 w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <button onClick={() => navigate('/campaigns')} className="text-[#71717a] hover:text-[#e4e4e7] text-base">
            ← Campaigns
          </button>
          <span className="text-[rgba(255,255,255,0.12)]">/</span>
          <h1 className="text-2xl font-semibold text-[#fafafa]">{campaign.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[campaign.status] || 'text-[#a1a1aa] bg-slate-500/10'}`}>
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
        <div className="bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)] p-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-medium text-[#fafafa]">Dialing Progress</h2>
            <span className="text-sm text-[#71717a]">{campaign.called} / {campaign.total_contacts} contacts called</span>
          </div>
          <div className="h-2 bg-[#1c1c1f] rounded-full overflow-hidden">
            <div
              style={{ width: `${pct}%` }}
              className="h-full bg-[#2563EB] rounded-full transition-all"
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
              className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-base transition-colors">
              {actionLoading ? 'Starting…' : '▶ Start Campaign'}
            </button>
          ) : campaign.status === 'running' ? (
            <button
              disabled={actionLoading}
              onClick={() => handleAction('pause')}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-medium px-4 py-2 rounded-lg text-base transition-colors">
              ⏸ Pause
            </button>
          ) : null}

          {!['completed', 'cancelled'].includes(campaign.status) && (
            <button
              disabled={actionLoading}
              onClick={() => handleAction('cancel')}
              className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 font-medium px-4 py-2 rounded-lg text-base transition-colors">
              Cancel
            </button>
          )}

          {/* Upload contacts */}
          {['draft', 'paused'].includes(campaign.status) && (
            <label className="cursor-pointer flex items-center gap-2 bg-[#1c1c1f] hover:bg-[#E8E5E2] border border-[rgba(255,255,255,0.06)] text-[#e4e4e7] px-4 py-2 rounded-lg text-base transition-colors">
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
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{uploadError}</p>
        )}
        {uploadSuccess && (
          <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4">{uploadSuccess}</p>
        )}

        {/* Upload hint */}
        {campaign.status === 'draft' && campaign.total_contacts === 0 && (
          <div className="bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)] p-6 mb-5 text-center">
            <p className="text-[#a1a1aa] text-base mb-1">No contacts yet</p>
            <p className="text-sm text-[#71717a]">
              Upload a CSV with columns: <span className="text-[#71717a] font-mono">phone, name, [any_variable]</span>
              <br />Extra columns become available as <span className="text-[#71717a] font-mono">{'{first_name}'}</span> variables in your agent prompt.
            </p>
          </div>
        )}

        {/* Contact list */}
        {campaign.total_contacts > 0 && (
          <div className="bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)]">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <h2 className="text-base font-medium text-[#fafafa]">Contacts</h2>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-[#09090b] border border-[rgba(255,255,255,0.06)] rounded-lg px-2 py-1 text-sm text-[#a1a1aa] focus:outline-none">
                <option value="">All statuses</option>
                {['pending', 'calling', 'completed', 'failed', 'retry', 'dnc', 'voicemail', 'skipped'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {contactsLoading ? (
              <div className="py-8 text-center text-[#71717a] text-base">Loading…</div>
            ) : contacts.length === 0 ? (
              <div className="py-8 text-center text-[#71717a] text-base">No contacts match this filter</div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-base text-[#fafafa] font-mono">{c.phone}</p>
                      {c.name && <p className="text-sm text-[#71717a]">{c.name}</p>}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`font-medium capitalize ${CONTACT_STATUS_COLORS[c.status] || 'text-[#a1a1aa]'}`}>
                        {c.status}
                      </span>
                      {c.attempts > 0 && (
                        <span className="text-[#71717a]">{c.attempts}× tried</span>
                      )}
                      {c.last_outcome && (
                        <span className="text-[#71717a] capitalize">{c.last_outcome.replace('-', ' ')}</span>
                      )}
                      {c.status === 'retry' && c.next_retry_at && (
                        <span className="text-amber-400/70">
                          retry {formatRelative(c.next_retry_at)}
                        </span>
                      )}
                      {c.call_id && (
                        <button
                          onClick={() => navigate(`/calls/${c.call_id}`)}
                          className="text-[#2563EB] hover:text-[#8b5cf6]">
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
    indigo: 'text-[#2563EB]',
    emerald: 'text-emerald-400',
  }
  return (
    <div className="bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)] px-4 py-3.5">
      <p className="text-sm text-[#71717a] mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${colorMap[color] || 'text-[#fafafa]'}`}>{value}</p>
    </div>
  )
}

function ConfigChip({ label, value }) {
  return (
    <span className="text-sm text-[#71717a] bg-[#1c1c1f] border border-[rgba(255,255,255,0.06)] px-2.5 py-0.5 rounded">
      {label}: <span className="text-[#a1a1aa]">{value}</span>
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
