import { useEffect, useState } from 'react'
import { adminApi } from '../api/client'

const STATUS = {
  healthy: { dot: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700', label: 'Healthy' },
  degraded:{ dot: 'bg-amber-500',   text: 'text-amber-700',   badge: 'bg-amber-50 text-amber-700',   label: 'Degraded' },
  down:    { dot: 'bg-red-500',     text: 'text-red-600',     badge: 'bg-red-50 text-red-600',     label: 'Down' },
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
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
          <p className="text-base text-gray-500 mt-1">
            {data ? `Last checked ${new Date(data.checked_at * 1000).toLocaleTimeString()}` : 'Checking services…'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-2 bg-gray-100 border border-gray-200 hover:border-violet-300 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-xl text-base transition-colors"
        >
          <svg viewBox="0 0 24 24" className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={1.8}>
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Overall banner */}
      {!loading && (
        <div className={`rounded-2xl border px-5 py-4 mb-6 flex items-center gap-3 ${
          allHealthy
            ? 'bg-emerald-50 border-emerald-200'
            : anyDown
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            allHealthy ? 'bg-emerald-500' : anyDown ? 'bg-red-500' : 'bg-amber-500'
          }`} />
          <p className="text-base font-medium text-gray-900">
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
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {services.map(svc => {
            const s = STATUS[svc.status] || STATUS.down
            return (
              <div key={svc.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  <div>
                    <p className="text-base font-medium text-gray-900">{svc.name}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{svc.url}</p>
                    {svc.error && <p className="text-sm text-red-500 mt-0.5">{svc.error}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  {svc.latency_ms != null && (
                    <span className="text-sm text-gray-500">{svc.latency_ms}ms</span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
                    {s.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Service links */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Links</h2>
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
              className="flex items-center justify-between text-base text-gray-500 hover:text-gray-900 transition-colors py-1"
            >
              {label}
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2}>
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
