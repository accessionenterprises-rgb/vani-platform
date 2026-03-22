import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi } from '../api/client'

const TIER_GROUPS = {
  'A · Premium': ['A-double-seq', 'A-double-rev', 'A-seven', 'A-mirror'],
  'B · Notable': ['B-segments', 'B-fivefive', 'B-double-block', 'B-alternating', 'B-alt10', 'B-aab-triple', 'B-aba-triple', 'B-abb-triple', 'B-abc-triple'],
  'P · Prefix':  ['P-suffix-quad', 'P-seq5', 'P-seq6', 'P-seq7'],
  'TF · Toll-Free': ['TF-double-aaaa', 'TF-double-aabb', 'TF-double-seq'],
}
const ALL_TIERS = Object.values(TIER_GROUPS).flat()
const SERVICES = ['twilio', 'bandwidth', 'telnyx']
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const BLANK_SCHEDULE = {
  name: '',
  is_active: true,
  frequency: 'daily',
  hour_of_day: 2,
  day_of_week: 0,
  day_of_month: 1,
  countries: null,
  service: 'twilio',
  tiers: null,
}

const TIER_META = {
  'A-double-seq':   { label: 'A · Double + Seq',      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  'A-double-rev':   { label: 'A · Double + Mirror',   color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  'A-seven':        { label: 'A · NPA + 7 Identical', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  'A-mirror':       { label: 'A · Mirror Open',       color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  'B-segments':     { label: 'B · 3 Segments',        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'B-fivefive':     { label: 'B · 5+5 Split',         color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'B-double-block': { label: 'B · AAABBB',            color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'B-alternating':  { label: 'B · ABABAB',            color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'B-alt10':        { label: 'B · ABABABABAB',        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'B-aab-triple':   { label: 'B · AAB×3',             color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'B-aba-triple':   { label: 'B · ABA×3',             color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'B-abb-triple':   { label: 'B · ABB×3',             color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'B-abc-triple':   { label: 'B · ABC×3',             color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'P-suffix-quad':  { label: 'P · Suffix Quad',       color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' },
  'P-seq5':         { label: 'P · Seq 5-digit',       color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' },
  'P-seq6':         { label: 'P · Seq 6-digit',       color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' },
  'P-seq7':         { label: 'P · Seq 7-digit',       color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' },
  'TF-double-aaaa': { label: 'TF · Toll-Free AAAA',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  'TF-double-aabb': { label: 'TF · Toll-Free AABB',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  'TF-double-seq':  { label: 'TF · Toll-Free Seq',   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
}

const COUNTRY_FLAGS = {
  US: '🇺🇸', CA: '🇨🇦', PR: '🇵🇷', VI: '🇻🇮', GU: '🇬🇺',
  AS: '🇦🇸', MP: '🇲🇵', BM: '🇧🇲', KY: '🇰🇾', JM: '🇯🇲',
  TT: '🇹🇹', BB: '🇧🇧', BS: '🇧🇸', GD: '🇬🇩', DO: '🇩🇴',
}

// Provider for each scan — all Twilio for now, extensible later
const SERVICE_COLORS = {
  twilio: 'text-[#F22F46] bg-[#F22F46]/10 border-[#F22F46]/20',
  bandwidth: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  telnyx: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
}
function ServiceBadge({ service = 'twilio' }) {
  const color = SERVICE_COLORS[service] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide ${color}`}>
      {service}
    </span>
  )
}

function fmt(number) {
  const n = number.replace('+1', '')
  return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`
}

function TierBadge({ tier }) {
  const meta = TIER_META[tier] || { label: tier, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${meta.color}`}>
      {meta.label}
    </span>
  )
}

function ScoreBadge({ score, reason }) {
  if (score == null) return <span className="text-xs text-slate-700">—</span>
  const color = score >= 8
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : score >= 6
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  return (
    <span title={reason || ''} className={`text-xs font-semibold px-2 py-0.5 rounded border cursor-default ${color}`}>
      {score}/10
    </span>
  )
}

export default function NumberHunterPage() {
  const [results, setResults]         = useState([])
  const [totals, setTotals]           = useState({ available: 0, purchased: 0, topScored: 0 })
  const [scans, setScans]             = useState([])
  const [status, setStatus]           = useState({ running: {}, countries: [] })
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('available')
  const [country, setCountry]         = useState('')
  const [tierFilter, setTierFilter]   = useState('')
  const [scoreFilter, setScoreFilter] = useState('')   // '', '8', '6', 'unscored'
  const [scanning, setScanning]         = useState(false)
  const [scanCountries, setScanCountries] = useState(['US'])  // multi-select
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [purchasing, setPurchasing]     = useState(null)
  const [toast, setToast]             = useState(null)
  const [scanMsg, setScanMsg]         = useState(null)   // {type:'info'|'ok'|'err', text}
  const [schedules, setSchedules]     = useState([])
  const [showSchedule, setShowSchedule] = useState(false)
  const [editingSched, setEditingSched] = useState(null)  // null=new, obj=edit
  const [schedDraft, setSchedDraft]   = useState(BLANK_SCHEDULE)
  const [schedSaving, setSchedSaving] = useState(false)
  const pollRef  = useRef(null)
  const scanStart = useRef(null)
  const pickerRef = useRef(null)

  // Auto-resume: check server AND localStorage on page load
  useEffect(() => {
    const LS_KEY = 'vani_hunt_scanning'
    adminApi.hunterStatus().then(st => {
      const running = Object.keys((st || {}).running || {})
      if (running.length > 0) {
        // Server confirms scan is in flight — resume
        setStatus(st)
        setScanCountries(running)
        setScanning(true)
        setScanMsg({ type: 'info', text: `Scan in progress — resuming (${running.join(', ')})…` })
      } else {
        // Nothing running on server — check if we have a stale localStorage entry
        const saved = localStorage.getItem(LS_KEY)
        if (saved) {
          localStorage.removeItem(LS_KEY)
          try {
            const { countries } = JSON.parse(saved)
            setScanMsg({ type: 'err', text: `Previous scan (${countries.join(', ')}) was interrupted — server restarted. Start a new scan.` })
          } catch (_) {}
        }
      }
    }).catch(() => {})
  }, [])

  // Close country picker on outside click
  useEffect(() => {
    function handler(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setCountryPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function loadSchedules() {
    try { setSchedules(await adminApi.listSchedules() || []) } catch (_) {}
  }

  function openScheduleModal(sched = null) {
    if (sched) {
      setEditingSched(sched)
      setSchedDraft({
        name: sched.name || '',
        is_active: sched.is_active ?? true,
        frequency: sched.frequency || 'daily',
        hour_of_day: sched.hour_of_day ?? 2,
        day_of_week: sched.day_of_week ?? 0,
        day_of_month: sched.day_of_month ?? 1,
        countries: sched.countries || null,
        service: sched.service || 'twilio',
        tiers: sched.tiers || null,
      })
    } else {
      setEditingSched(null)
      setSchedDraft(BLANK_SCHEDULE)
    }
    setShowSchedule(true)
  }

  async function saveSchedule() {
    if (!schedDraft.name.trim()) return showToast('Schedule name required', 'err')
    setSchedSaving(true)
    try {
      if (editingSched) {
        await adminApi.updateSchedule(editingSched.id, schedDraft)
        showToast('Schedule updated')
      } else {
        await adminApi.createSchedule(schedDraft)
        showToast('Schedule created')
      }
      setShowSchedule(false)
      loadSchedules()
    } catch (e) {
      showToast(e.message, 'err')
    } finally {
      setSchedSaving(false)
    }
  }

  async function deleteSchedule(id) {
    if (!confirm('Delete this schedule?')) return
    try {
      await adminApi.deleteSchedule(id)
      showToast('Schedule deleted')
      loadSchedules()
    } catch (e) {
      showToast(e.message, 'err')
    }
  }

  async function load() {
    try {
      const [r, s, st, allAvail, allPurchased] = await Promise.all([
        adminApi.hunterResults(tab, country || null, tierFilter || null),
        adminApi.hunterScans(country || null),
        adminApi.hunterStatus(),
        adminApi.hunterResults('available', country || null, null),
        adminApi.hunterResults('purchased', country || null, null),
      ])
      setResults(r || [])
      setScans(s || [])
      setStatus(st || { running: {}, countries: [] })
      const av = allAvail || []
      const pu = allPurchased || []
      setTotals({
        available: av.length,
        purchased: pu.length,
        topScored: av.filter(x => x.ai_score >= 8).length,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
    if (tab === 'available' && !country && !tierFilter) loadSchedules()
  }, [tab, country, tierFilter])

  // Start polling as soon as scanning=true (don't wait for status.running to be populated)
  useEffect(() => {
    if (!scanning) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    pollRef.current = setInterval(async () => {
      try {
        const st = await adminApi.hunterStatus()
        setStatus(st)
        const hasRunning = Object.keys(st.running || {}).length > 0
        // Mark the moment we first see the scan actually running
        if (hasRunning && !scanStart.current) scanStart.current = Date.now()
        // Only stop when we've seen it running AND it stopped (avoids false-stop before scan starts)
        if (!hasRunning && scanStart.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
          scanStart.current = null
          localStorage.removeItem('vani_hunt_scanning')
          setScanning(false)
          const s = await adminApi.hunterScans(null)
          const last = s?.[0]
          if (last?.status === 'completed') {
            setScanMsg({ type: 'ok', text: `✓ Scan complete — ${last.found_count ?? 0} found, ${last.new_count ?? 0} new, ${last.gone_count ?? 0} gone` })
          } else if (last?.status === 'failed') {
            setScanMsg({ type: 'err', text: `✗ Scan failed: ${last.error || 'unknown error'}` })
          }
          load()
        }
      } catch (_) {}
    }, 2000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [scanning])

  async function handleScan() {
    if (!scanCountries.length) return
    setCountryPickerOpen(false)
    setScanMsg(null)
    setScanning(true)
    localStorage.setItem('vani_hunt_scanning', JSON.stringify({ countries: scanCountries }))
    try {
      const r = await adminApi.hunterScan(scanCountries)
      const label = r.countries?.length === 1
        ? `${r.countries[0]} — ${r.patterns?.toLocaleString() || 0} patterns`
        : `${r.countries?.join(', ')} — ${r.patterns?.toLocaleString() || 0} patterns total (${r.countries?.length} in parallel)`
      setScanMsg({ type: 'info', text: `Scanning ${label}` })
      const st = await adminApi.hunterStatus()
      setStatus(st)
    } catch (e) {
      localStorage.removeItem('vani_hunt_scanning')
      setScanMsg({ type: 'err', text: e.message })
      setScanning(false)
    }
  }

  async function handleScanAll() {
    setScanMsg(null)
    setScanning(true)
    try {
      await adminApi.hunterScanAll()
      setScanMsg({ type: 'info', text: 'All 15 countries scanning in parallel (up to 4 at once)' })
      const st = await adminApi.hunterStatus()
      setStatus(st)
    } catch (e) {
      setScanMsg({ type: 'err', text: e.message })
      setScanning(false)
    }
  }

  async function handleBuy(number) {
    if (!confirm(`Purchase ${fmt(number)} via Twilio?\n\nThis will charge the Twilio account (~$1/mo).`)) return
    setPurchasing(number)
    try {
      const r = await adminApi.hunterPurchase(number)
      showToast(`Purchased ${fmt(r.number)} — SID ${r.sid}`)
      // Remove from current list if we're on the available tab
      if (tab === 'available') {
        setResults(rs => rs.filter(x => x.number !== number))
        setTotals(t => ({ ...t, available: t.available - 1, purchased: t.purchased + 1 }))
      } else {
        setResults(rs => rs.map(x => x.number === number ? { ...x, status: 'purchased' } : x))
      }
    } catch (e) {
      showToast(e.message, 'err')
    } finally {
      setPurchasing(null)
    }
  }

  const runningCountries = Object.keys(status.running || {})
  const isRunning = runningCountries.length > 0
  const lastScan = scans[0]

  // Client-side score filter
  const filtered = results.filter(r => {
    if (!scoreFilter) return true
    if (scoreFilter === '8') return r.ai_score >= 8
    if (scoreFilter === '6') return r.ai_score >= 6 && r.ai_score < 8
    if (scoreFilter === 'unscored') return r.ai_score == null
    return true
  })

  const tierCounts = results.reduce((acc, r) => {
    acc[r.tier] = (acc[r.tier] || 0) + 1
    return acc
  }, {})

  return (
    <div className="p-8 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Number Hunter</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Memorable NANP numbers available on Twilio — scanned daily, AI-scored
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Multi-country picker */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => !isRunning && setCountryPickerOpen(o => !o)}
              disabled={isRunning}
              className="bg-[#12141f] border border-[#2a2d3a] hover:border-indigo-500/50 disabled:opacity-40 rounded-lg px-3 py-2 text-sm text-white flex items-center gap-2 min-w-[120px]"
            >
              <span className="flex-1 text-left truncate">
                {scanCountries.length === 0 ? 'No countries' :
                 scanCountries.length === Object.keys(COUNTRY_FLAGS).length ? 'All countries' :
                 scanCountries.length === 1 ? `${COUNTRY_FLAGS[scanCountries[0]] || ''} ${scanCountries[0]}` :
                 `${scanCountries.length} countries`}
              </span>
              <span className="text-slate-500 text-xs">▾</span>
            </button>
            {countryPickerOpen && (
              <div className="absolute top-full mt-1 right-0 z-40 bg-[#12141f] border border-[#2a2d3a] rounded-xl shadow-xl p-2 w-56 max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Select countries</span>
                  <button
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    onClick={() => setScanCountries(
                      scanCountries.length === Object.keys(COUNTRY_FLAGS).length ? [] : Object.keys(COUNTRY_FLAGS)
                    )}
                  >
                    {scanCountries.length === Object.keys(COUNTRY_FLAGS).length ? 'None' : 'All'}
                  </button>
                </div>
                {(status.countries?.length ? status.countries : Object.keys(COUNTRY_FLAGS)).map(c => (
                  <label key={c} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scanCountries.includes(c)}
                      onChange={() => setScanCountries(cs =>
                        cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]
                      )}
                      className="accent-indigo-500"
                    />
                    <span className="text-sm text-white">{COUNTRY_FLAGS[c] || ''} {c}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleScan}
            disabled={scanning || isRunning || !scanCountries.length}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <RadarIcon className="w-4 h-4" />
            Scan{scanCountries.length > 1 ? ` (${scanCountries.length})` : ''}
          </button>
          <button
            onClick={handleScanAll}
            disabled={scanning || isRunning}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Scan All
          </button>
          <button
            onClick={() => openScheduleModal()}
            className="flex items-center gap-2 bg-[#12141f] border border-[#2a2d3a] hover:border-indigo-500/50 text-slate-300 hover:text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <ClockIcon className="w-4 h-4" />
            Schedule{schedules.length > 0 && <span className="text-xs text-indigo-400 font-semibold ml-0.5">{schedules.length}</span>}
          </button>
        </div>
      </div>

      {/* Scan message (info / ok / err) */}
      {scanMsg && (
        <div className={`rounded-xl px-5 py-3 mb-4 text-sm font-medium border flex items-center gap-3 ${
          scanMsg.type === 'ok'  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
          scanMsg.type === 'err' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                                   'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
        }`}>
          {scanMsg.type === 'info' && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />}
          <span className="flex-1">{scanMsg.text}</span>
          <button onClick={() => setScanMsg(null)} className="text-current opacity-50 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      )}

      {/* Scan progress bars */}
      {(scanning || isRunning) && (
        <div className="bg-[#12141f] border border-[#1f2235] rounded-xl px-5 py-4 mb-5 space-y-3">
          {(isRunning ? runningCountries : scanCountries).map(c => {
            const p = status.running[c] || {}
            const pct = p.total ? Math.round((p.searched / p.total) * 100) : 0
            const elapsed = scanStart.current ? (Date.now() - scanStart.current) / 1000 : 0
            const rate = elapsed > 5 && p.searched > 0 ? p.searched / elapsed : null
            const remaining = rate && p.total ? Math.round((p.total - p.searched) / rate) : null
            const etaStr = remaining != null
              ? remaining > 3600 ? `~${Math.round(remaining/3600)}h left`
              : remaining > 60   ? `~${Math.round(remaining/60)}m left`
              :                    `~${remaining}s left`
              : ''
            return (
              <div key={c}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-white">
                    {COUNTRY_FLAGS[c] || ''} {c}
                    <ServiceBadge service={p.service || 'twilio'} />
                    <span className="text-xs text-slate-500 font-normal">
                      {p.total
                        ? `${p.searched?.toLocaleString() ?? 0} / ${p.total.toLocaleString()} patterns${p.found ? ` · ${p.found} found` : ''}`
                        : 'queued…'}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{pct}% {etaStr && `· ${etaStr}`}</span>
                </div>
                <div className="h-1.5 bg-[#1f2235] rounded-full overflow-hidden">
                  {pct > 0
                    ? <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    : <div className="h-full bg-indigo-500/30 rounded-full animate-pulse w-full" />
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Available"     value={totals.available}  color="text-emerald-400" />
        <StatCard label="Purchased"     value={totals.purchased}  color="text-indigo-400" />
        <StatCard label="Top Scored ≥8" value={totals.topScored}  color="text-amber-400" />
        <StatCard label="Last Scan"     value={lastScan ? new Date(lastScan.started_at).toLocaleDateString() : '—'} />
        <StatCard label="Countries"     value={status.countries?.length || 15} />
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Status tabs */}
        <div className="flex gap-1 bg-[#0d0f18] border border-[#1f2235] rounded-lg p-1">
          {['available', 'purchased'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-[#12141f] text-white shadow' : 'text-slate-500 hover:text-slate-300'
              }`}
            >{t}</button>
          ))}
        </div>

        {/* Country filter */}
        <select value={country} onChange={e => setCountry(e.target.value)}
          className="bg-[#12141f] border border-[#2a2d3a] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">All countries</option>
          {(status.countries || []).map(c => (
            <option key={c} value={c}>{COUNTRY_FLAGS[c] || ''} {c}</option>
          ))}
        </select>

        {/* Score filter */}
        <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)}
          className="bg-[#12141f] border border-[#2a2d3a] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">All scores</option>
          <option value="8">Score ≥ 8 (top)</option>
          <option value="6">Score 6–7</option>
          <option value="unscored">Not scored yet</option>
        </select>

        <span className="text-xs text-slate-600 ml-auto">{filtered.length} numbers</span>
      </div>

      {/* Tier pills */}
      {Object.keys(tierCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setTierFilter('')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              !tierFilter ? 'bg-white/10 border-white/20 text-white' : 'border-[#2a2d3a] text-slate-500 hover:text-slate-300'
            }`}
          >All ({results.length})</button>
          {Object.entries(tierCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
            <button key={t} onClick={() => setTierFilter(t === tierFilter ? '' : t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                tierFilter === t ? 'bg-white/10 border-white/20 text-white' : 'border-[#2a2d3a] text-slate-500 hover:text-slate-300'
              }`}
            >{TIER_META[t]?.label || t} ({n})</button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-slate-600 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#12141f] rounded-xl border border-[#1f2235]">
          <RadarIcon className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium mb-1">No numbers found</p>
          <p className="text-sm text-slate-600">Trigger a scan to populate this list</p>
        </div>
      ) : (
        <div className="bg-[#12141f] rounded-xl border border-[#1f2235] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f2235]">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Number</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Country</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Score</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Pattern</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">First Seen</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2235]">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-mono text-white font-medium">{fmt(r.number)}</div>
                    <div className="text-xs text-slate-600">{r.number}</div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs">{COUNTRY_FLAGS[r.country] || ''} {r.country}</td>
                  <td className="px-4 py-3.5"><ScoreBadge score={r.ai_score} reason={r.ai_reason} /></td>
                  <td className="px-4 py-3.5"><TierBadge tier={r.tier} /></td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{r.label}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-600">{new Date(r.first_seen).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    {r.status === 'purchased' ? (
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                        Purchased
                      </span>
                    ) : (
                      <button
                        onClick={() => handleBuy(r.number)}
                        disabled={purchasing === r.number}
                        className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20 disabled:opacity-50 transition-colors"
                      >
                        {purchasing === r.number ? 'Buying…' : 'Buy'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scan Logs */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-400">Scan Logs</h2>
          {scans.length > 0 && <span className="text-xs text-slate-600">{scans.length} runs</span>}
        </div>
        {scans.length === 0 ? (
          <div className="text-xs text-slate-600 py-4">No scans yet — trigger a scan to see logs here.</div>
        ) : (
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1f2235]">
                  <th className="text-left px-5 py-2.5 text-slate-500 font-medium">Country</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Started</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Duration</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Patterns</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Found</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">New</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Gone</th>
                  <th className="text-left px-5 py-2.5 text-slate-500 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2235]">
                {scans.slice(0, 20).map(s => {
                  const durSec = s.completed_at && s.started_at
                    ? Math.round((new Date(s.completed_at) - new Date(s.started_at)) / 1000)
                    : null
                  const durStr = durSec == null ? (s.status === 'running' ? 'running…' : '—')
                    : durSec >= 3600 ? `${Math.floor(durSec/3600)}h ${Math.floor((durSec%3600)/60)}m`
                    : durSec >= 60   ? `${Math.floor(durSec/60)}m ${durSec%60}s`
                    :                  `${durSec}s`
                  return (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{COUNTRY_FLAGS[s.country] || ''} {s.country}</span>
                          <ServiceBadge service={s.service || 'twilio'} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded border ${
                          s.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                          s.status === 'running'   ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' :
                                                     'text-red-400 bg-red-500/10 border-red-500/20'
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(s.started_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono">{durStr}</td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono">{s.total_patterns?.toLocaleString() ?? '—'}</td>
                      <td className="px-4 py-2.5 text-emerald-400 font-mono font-semibold">{s.found_count ?? '—'}</td>
                      <td className="px-4 py-2.5 text-sky-400 font-mono">{s.new_count ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono">{s.gone_count ?? '—'}</td>
                      <td className="px-5 py-2.5 text-slate-600 max-w-xs truncate">
                        {s.status === 'failed' && s.error
                          ? <span className="text-red-400">{s.error}</span>
                          : s.total_patterns && s.found_count != null
                          ? <span className="text-slate-600">{((s.found_count / s.total_patterns) * 100).toFixed(2)}% hit rate</span>
                          : null
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border z-50 ${
          toast.type === 'err'
            ? 'bg-red-500/15 border-red-500/30 text-red-300'
            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Schedule Modal */}
      {showSchedule && (
        <ScheduleModal
          schedules={schedules}
          draft={schedDraft}
          setDraft={setSchedDraft}
          editing={editingSched}
          saving={schedSaving}
          onNew={() => openScheduleModal()}
          onEdit={(s) => openScheduleModal(s)}
          onDelete={deleteSchedule}
          onSave={saveSchedule}
          onClose={() => setShowSchedule(false)}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-[#12141f] border border-[#1f2235] rounded-xl px-5 py-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  )
}

function RadarIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="2"/>
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
    </svg>
  )
}

function ClockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

// ── Schedule Modal ─────────────────────────────────────────────────────────────

function ScheduleModal({ schedules, draft, setDraft, editing, saving, onNew, onEdit, onDelete, onSave, onClose }) {
  const allCountries = Object.keys(COUNTRY_FLAGS)
  const allTiers = ALL_TIERS

  function setField(key, val) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  function toggleCountry(c) {
    const cur = draft.countries || []
    if (cur.includes(c)) {
      const next = cur.filter(x => x !== c)
      setField('countries', next.length ? next : null)
    } else {
      setField('countries', [...cur, c])
    }
  }

  function toggleTierGroup(tiers) {
    const cur = draft.tiers === null ? allTiers : (draft.tiers || [])
    const allIn = tiers.every(t => cur.includes(t))
    if (allIn) {
      const next = cur.filter(t => !tiers.includes(t))
      setField('tiers', next)
    } else {
      const next = [...new Set([...cur, ...tiers])]
      setField('tiers', next)
    }
  }

  function toggleTier(t) {
    const cur = draft.tiers === null ? allTiers : (draft.tiers || [])
    const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]
    setField('tiers', next)
  }

  const selectedCountries = draft.countries || allCountries
  const selectedTiers = draft.tiers === null ? allTiers : (draft.tiers || [])
  const allCountriesSel = !draft.countries
  const allTiersSel = draft.tiers === null

  function fmtNextRun(s) {
    if (!s.next_run_at) return '—'
    const d = new Date(s.next_run_at)
    const diff = d - Date.now()
    if (diff < 0) return 'overdue'
    if (diff < 3600000) return `in ${Math.round(diff/60000)}m`
    if (diff < 86400000) return `in ${Math.round(diff/3600000)}h`
    return `in ${Math.round(diff/86400000)}d`
  }

  const inputCls = 'bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full'
  const tabCls = (active) => `px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${active ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'}`

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[520px] h-full bg-[#0d0f18] border-l border-[#1f2235] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1f2235]">
          <div>
            <h2 className="text-white font-semibold">Scan Schedules</h2>
            <p className="text-xs text-slate-500 mt-0.5">Automate recurring number hunts</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Existing schedules */}
        {schedules.length > 0 && (
          <div className="px-6 py-4 border-b border-[#1f2235]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Schedules</p>
              <button onClick={onNew} className="text-xs text-indigo-400 hover:text-indigo-300">+ New</button>
            </div>
            <div className="space-y-2">
              {schedules.map(s => (
                <div key={s.id} className="flex items-center gap-3 bg-[#12141f] border border-[#1f2235] rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{s.name || 'Unnamed'}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        s.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                      }`}>{s.is_active ? 'active' : 'paused'}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.frequency} · {s.countries ? `${s.countries.length} countries` : 'all countries'} · {s.tiers ? `${s.tiers.length} tier(s)` : 'all tiers'} · next {fmtNextRun(s)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => onEdit(s)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/5">Edit</button>
                    <button onClick={() => onDelete(s.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10">Del</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="flex-1 px-6 py-5 space-y-6">
          <p className="text-sm font-semibold text-slate-300">{editing ? 'Edit Schedule' : 'New Schedule'}</p>

          {/* Name */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Name</label>
            <input
              className={inputCls}
              placeholder="e.g. Daily US Scan"
              value={draft.name}
              onChange={e => setField('name', e.target.value)}
            />
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`w-9 h-5 rounded-full transition-colors relative ${draft.is_active ? 'bg-indigo-500' : 'bg-slate-700'}`}
              onClick={() => setField('is_active', !draft.is_active)}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${draft.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-300">{draft.is_active ? 'Active' : 'Paused'}</span>
          </label>

          {/* Frequency */}
          <div>
            <label className="block text-xs text-slate-500 mb-2">Frequency</label>
            <div className="flex gap-1 bg-[#12141f] border border-[#1f2235] rounded-lg p-1">
              {['hourly', 'daily', 'weekly', 'monthly'].map(f => (
                <button key={f} onClick={() => setField('frequency', f)} className={tabCls(draft.frequency === f)}>
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Time options */}
          {draft.frequency !== 'hourly' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Hour of day (UTC)</label>
                <select className={inputCls} value={draft.hour_of_day} onChange={e => setField('hour_of_day', +e.target.value)}>
                  {Array.from({length: 24}, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2,'0')}:00 UTC</option>
                  ))}
                </select>
              </div>
              {draft.frequency === 'weekly' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Day of week</label>
                  <select className={inputCls} value={draft.day_of_week} onChange={e => setField('day_of_week', +e.target.value)}>
                    {DOW_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {draft.frequency === 'monthly' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Day of month</label>
                  <select className={inputCls} value={draft.day_of_month} onChange={e => setField('day_of_month', +e.target.value)}>
                    {Array.from({length: 28}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Service */}
          <div>
            <label className="block text-xs text-slate-500 mb-2">Provider</label>
            <div className="flex gap-2">
              {SERVICES.map(s => (
                <button
                  key={s}
                  onClick={() => setField('service', s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    draft.service === s
                      ? 'border-indigo-500 bg-indigo-500/15 text-white'
                      : 'border-[#2a2d3a] text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <ServiceBadge service={s} />
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Countries */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500">Countries</label>
              <button
                onClick={() => setField('countries', allCountriesSel ? [allCountries[0]] : null)}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                {allCountriesSel ? 'Select specific' : 'All countries'}
              </button>
            </div>
            {allCountriesSel ? (
              <div className="text-xs text-slate-500 bg-[#12141f] border border-[#1f2235] rounded-lg px-3 py-2">
                All 15 NANP countries will be scanned
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {allCountries.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleCountry(c)}
                    className={`text-xs px-2 py-1.5 rounded-lg border transition-colors text-center ${
                      selectedCountries.includes(c)
                        ? 'border-indigo-500/50 bg-indigo-500/15 text-white'
                        : 'border-[#2a2d3a] text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {COUNTRY_FLAGS[c]} {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Patterns / Tiers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500">Patterns</label>
              <button
                onClick={() => setField('tiers', allTiersSel ? [] : null)}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                {allTiersSel ? 'Select specific' : 'All patterns'}
              </button>
            </div>
            {allTiersSel ? (
              <div className="text-xs text-slate-500 bg-[#12141f] border border-[#1f2235] rounded-lg px-3 py-2">
                All pattern groups will be searched (~58k patterns for US)
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(TIER_GROUPS).map(([group, tiers]) => {
                  const allIn = tiers.every(t => selectedTiers.includes(t))
                  const someIn = tiers.some(t => selectedTiers.includes(t))
                  return (
                    <div key={group}>
                      <button
                        onClick={() => toggleTierGroup(tiers)}
                        className={`text-xs font-semibold px-2 py-1 rounded border mb-1.5 transition-colors ${
                          allIn ? 'border-indigo-500/50 text-indigo-300 bg-indigo-500/10'
                          : someIn ? 'border-amber-500/50 text-amber-300 bg-amber-500/10'
                          : 'border-[#2a2d3a] text-slate-500'
                        }`}
                      >
                        {group}
                      </button>
                      <div className="flex flex-wrap gap-1.5 ml-1">
                        {tiers.map(t => (
                          <button
                            key={t}
                            onClick={() => toggleTier(t)}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                              selectedTiers.includes(t)
                                ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                                : 'border-[#2a2d3a] text-slate-600 hover:text-slate-400'
                            }`}
                          >
                            {TIER_META[t]?.label || t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-[#1f2235]">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Schedule'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white border border-[#2a2d3a] rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
