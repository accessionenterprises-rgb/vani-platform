import { useEffect, useState } from 'react'
import { adminApi } from '../api/client'

const STATUS = {
  healthy: { dot: 'bg-emerald-400', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400', label: 'Healthy' },
  degraded:{ dot: 'bg-amber-400',   text: 'text-amber-400',   badge: 'bg-amber-500/15 text-amber-400',   label: 'Degraded' },
  down:    { dot: 'bg-rose-400',     text: 'text-rose-400',     badge: 'bg-rose-500/15 text-rose-400',     label: 'Down' },
}

export default function SystemHealthPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setRefreshing(true)
    try {
      const d = await adminApi.health()
      setData(d)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const services = data?.services || []
  const allHealthy = services.every(s => s.status === 'healthy')
  const anyDown = services.some(s => s.status === 'down')

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">System Health</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data ? `Last checked ${new Date(data.checked_at * 1000).toLocaleTimeString()}` : 'Checking services…'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-2 bg-[#0d0f1a] border border-[#1a1d2e] hover:border-indigo-500/50 text-slate-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
        >
          <svg viewBox="0 0 24 24" className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={1.8}>
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Overall banner */}
      {!loading && (
        <div className={`rounded-xl border px-5 py-4 mb-6 flex items-center gap-3 ${
          allHealthy
            ? 'bg-emerald-500/8 border-emerald-500/20'
            : anyDown
              ? 'bg-rose-500/8 border-rose-500/20'
              : 'bg-amber-500/8 border-amber-500/20'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            allHealthy ? 'bg-emerald-400' : anyDown ? 'bg-rose-400' : 'bg-amber-400'
          }`} />
          <p className="text-sm font-medium text-white">
            {allHealthy
              ? 'All systems operational'
              : anyDown
                ? `${services.filter(s => s.status === 'down').length} service(s) down`
                : 'Degraded performance'}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {services.map(svc => {
            const s = STATUS[svc.status] || STATUS.down
            return (
              <div key={svc.name} className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  <div>
                    <p className="text-sm font-medium text-white">{svc.name}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{svc.url}</p>
                    {svc.error && <p className="text-xs text-rose-400 mt-0.5">{svc.error}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  {svc.latency_ms != null && (
                    <span className="text-xs text-slate-500">{svc.latency_ms}ms</span>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
                    {s.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Service links */}
      <div className="mt-8 bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Quick Links</h2>
        <div className="space-y-2">
          {[
            { label: 'API Docs', url: 'https://api.vani.live/docs' },
            { label: 'Dashboard', url: 'https://dashboard.vani.live' },
            { label: 'Railway (API)', url: 'https://railway.app' },
            { label: 'Supabase', url: 'https://supabase.com/dashboard/project/osimjsbgxhoqlrfutloh' },
            { label: 'Vercel', url: 'https://vercel.com/dashboard' },
          ].map(({ label, url }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-sm text-slate-400 hover:text-white transition-colors py-1"
            >
              {label}
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
