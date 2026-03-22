import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

const TIER_META = {
  'S-ten':          { label: 'S · Ten Identical',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  'A-double-seq':   { label: 'A · Double + Seq',     color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  'A-double-rev':   { label: 'A · Double + Mirror',  color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  'A-seven':        { label: 'A · NPA + 7 Identical',color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  'A-mirror':       { label: 'A · Mirror Open',      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  'B-segments':     { label: 'B · 3 Segments',       color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'B-fivefive':     { label: 'B · 5+5 Split',        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'TF-double-aaaa': { label: 'TF · Toll-Free AAAA',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  'TF-double-aabb': { label: 'TF · Toll-Free AABB',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  'TF-double-seq':  { label: 'TF · Toll-Free Seq',   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
}

const COUNTRY_FLAGS = {
  US: '🇺🇸', CA: '🇨🇦', PR: '🇵🇷', VI: '🇻🇮', GU: '🇬🇺',
  AS: '🇦🇸', MP: '🇲🇵', BM: '🇧🇲', KY: '🇰🇾', JM: '🇯🇲',
  TT: '🇹🇹', BB: '🇧🇧', BS: '🇧🇸', GD: '🇬🇩', DO: '🇩🇴',
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
  const [results, setResults]       = useState([])
  const [scans, setScans]           = useState([])
  const [status, setStatus]         = useState({ running: {}, countries: [] })
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('available')    // available | purchased
  const [country, setCountry]       = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [scanning, setScanning]     = useState(false)
  const [scanCountry, setScanCountry] = useState('US')
  const [purchasing, setPurchasing] = useState(null)  // number being purchased
  const [toast, setToast]           = useState(null)
  const pollRef = useRef(null)

  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    try {
      const [r, s, st] = await Promise.all([
        api.hunterResults(tab, country || null, tierFilter || null),
        api.hunterScans(country || null),
        api.hunterStatus(),
      ])
      setResults(r || [])
      setScans(s || [])
      setStatus(st || { running: {}, countries: [] })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [tab, country, tierFilter])

  // Poll status while a scan is running
  useEffect(() => {
    const hasRunning = Object.keys(status.running || {}).length > 0
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        try {
          const st = await api.hunterStatus()
          setStatus(st)
          const stillRunning = Object.keys(st.running || {}).length > 0
          if (!stillRunning) {
            clearInterval(pollRef.current)
            pollRef.current = null
            setScanning(false)
            load()  // refresh results after scan finishes
          }
        } catch (_) {}
      }, 3000)
    }
    return () => {
      if (!hasRunning && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [status])

  async function handleScan() {
    setScanning(true)
    try {
      const r = await api.hunterScan(scanCountry)
      showToast(`Scanning ${r.country} — ${r.patterns?.toLocaleString() || 0} patterns queued`)
      const st = await api.hunterStatus()
      setStatus(st)
    } catch (e) {
      showToast(e.message, 'err')
      setScanning(false)
    }
  }

  async function handleBuy(number) {
    if (!confirm(`Purchase ${fmt(number)} via Twilio?\n\nThis will charge your Twilio account (~$1/mo).`)) return
    setPurchasing(number)
    try {
      const r = await api.hunterPurchase(number)
      showToast(`Purchased ${fmt(r.number)} — SID ${r.sid}`)
      setResults(rs => rs.map(x => x.number === number ? { ...x, status: 'purchased' } : x))
    } catch (e) {
      showToast(e.message, 'err')
    } finally {
      setPurchasing(null)
    }
  }

  const runningCountries = Object.keys(status.running || {})
  const isRunning = runningCountries.length > 0

  const lastScan = scans[0]
  const tierCounts = results.reduce((acc, r) => {
    acc[r.tier] = (acc[r.tier] || 0) + 1
    return acc
  }, {})

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-6xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Number Hunter</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Scans Twilio daily for memorable NANP numbers — finds patterns, tracks availability
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={scanCountry}
              onChange={e => setScanCountry(e.target.value)}
              className="bg-[#12141f] border border-[#2a2d3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {(status.countries || []).map(c => (
                <option key={c} value={c}>{COUNTRY_FLAGS[c] || ''} {c}</option>
              ))}
            </select>
            <button
              onClick={handleScan}
              disabled={scanning || isRunning}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {isRunning ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning {runningCountries.join(', ')}…
                </>
              ) : (
                <>
                  <RadarIcon className="w-4 h-4" />
                  Scan Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scan progress */}
        {isRunning && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-5 py-3 mb-5 flex items-center gap-4">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <div className="flex-1 text-sm text-indigo-300">
              {runningCountries.map(c => {
                const p = status.running[c] || {}
                return (
                  <span key={c} className="mr-6">
                    {COUNTRY_FLAGS[c] || ''} <strong>{c}</strong>
                    {p.total ? ` — ${p.searched?.toLocaleString()}/${p.total?.toLocaleString()} patterns` : ''}
                    {p.found ? `, ${p.found} found` : ''}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <StatCard label="Available" value={results.filter(r => r.status === 'available').length} color="text-emerald-400" />
          <StatCard label="Purchased" value={results.filter(r => r.status === 'purchased').length} color="text-indigo-400" />
          <StatCard label="Top Scored (≥8)" value={results.filter(r => r.ai_score >= 8).length} color="text-amber-400" />
          <StatCard label="Last Scan" value={lastScan ? new Date(lastScan.started_at).toLocaleDateString() : '—'} />
          <StatCard label="Countries" value={status.countries?.length || 15} />
        </div>

        {/* Tier breakdown pills */}
        {Object.keys(tierCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => setTierFilter('')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!tierFilter ? 'bg-white/10 border-white/20 text-white' : 'border-[#2a2d3a] text-slate-500 hover:text-slate-300'}`}
            >
              All ({results.length})
            </button>
            {Object.entries(tierCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
              <button
                key={t}
                onClick={() => setTierFilter(t === tierFilter ? '' : t)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  tierFilter === t
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'border-[#2a2d3a] text-slate-500 hover:text-slate-300'
                }`}
              >
                {TIER_META[t]?.label || t} ({n})
              </button>
            ))}
          </div>
        )}

        {/* Tabs + country filter */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex gap-1 bg-[#0d0f18] border border-[#1f2235] rounded-lg p-1">
            {['available', 'purchased'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  tab === t
                    ? 'bg-[#12141f] text-white shadow'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="bg-[#12141f] border border-[#2a2d3a] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All countries</option>
            {(status.countries || []).map(c => (
              <option key={c} value={c}>{COUNTRY_FLAGS[c] || ''} {c}</option>
            ))}
          </select>
          <span className="text-xs text-slate-600 ml-auto">{results.length} numbers</span>
        </div>

        {/* Results table */}
        {loading ? (
          <div className="text-center py-16 text-slate-600 text-sm">Loading…</div>
        ) : results.length === 0 ? (
          <div className="text-center py-20 bg-[#12141f] rounded-xl border border-[#1f2235]">
            <RadarIcon className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">
              {tab === 'available' ? 'No memorable numbers found yet' : 'No purchased numbers'}
            </p>
            <p className="text-sm text-slate-600">
              {tab === 'available'
                ? 'Run a scan to discover available memorable numbers in Twilio\'s inventory'
                : 'Numbers you buy through the hunter will appear here'}
            </p>
          </div>
        ) : (
          <div className="bg-[#12141f] rounded-xl border border-[#1f2235] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f2235]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Number</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Country</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Tier</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Pattern</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">First Seen</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2235]">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="font-mono text-white font-medium">{fmt(r.number)}</div>
                      <div className="text-xs text-slate-600">{r.number}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">
                      {COUNTRY_FLAGS[r.country] || ''} {r.country}
                    </td>
                    <td className="px-4 py-3.5">
                      <TierBadge tier={r.tier} />
                    </td>
                    <td className="px-4 py-3.5">
                      <ScoreBadge score={r.ai_score} reason={r.ai_reason} />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{r.label}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {new Date(r.first_seen).toLocaleDateString()}
                    </td>
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

        {/* Recent scans */}
        {scans.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-slate-400 mb-3">Recent Scans</h2>
            <div className="bg-[#12141f] rounded-xl border border-[#1f2235] divide-y divide-[#1f2235]">
              {scans.slice(0, 10).map(s => (
                <div key={s.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <span className="font-medium text-white">{COUNTRY_FLAGS[s.country] || ''} {s.country}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    s.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                    s.status === 'running'   ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' :
                                               'text-red-400 bg-red-500/10 border-red-500/20'
                  }`}>{s.status}</span>
                  <span className="text-slate-500 text-xs">{new Date(s.started_at).toLocaleString()}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {s.found_count ?? 0} found · {s.new_count ?? 0} new · {s.gone_count ?? 0} gone
                    {s.total_patterns ? ` / ${s.total_patterns?.toLocaleString()} patterns` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border z-50 ${
          toast.type === 'err'
            ? 'bg-red-500/15 border-red-500/30 text-red-300'
            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
        }`}>
          {toast.msg}
        </div>
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
