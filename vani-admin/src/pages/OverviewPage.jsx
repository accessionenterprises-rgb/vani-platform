import { useEffect, useState } from 'react'
import { adminApi } from '../api/client'

function KpiCard({ label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    green:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber:  'bg-amber-500/10 border-amber-500/20 text-amber-400',
    rose:   'bg-rose-500/10 border-rose-500/20 text-rose-400',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-2">{label}</p>
      <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}

export default function OverviewPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.stats().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const t = stats?.tenants || {}
  const a = stats?.agents || {}
  const c = stats?.calls || {}

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Platform Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time metrics across all tenants.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total Tenants" value={t.total} sub={`${t.disabled || 0} disabled`} color="indigo" />
        <KpiCard label="Active Agents" value={a.active} sub={`${a.total} total`} color="green" />
        <KpiCard label="Calls Today" value={c.today} sub={`${c.active_now || 0} live now`} color="amber" />
        <KpiCard label="Total Minutes" value={c.total_minutes} sub={`${c.total} calls ever`} color="rose" />
      </div>

      {/* Plan breakdown */}
      {t.by_plan && Object.keys(t.by_plan).length > 0 && (
        <div className="bg-[#0d0f1a] border border-[#1a1d2e] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Tenants by Plan</h2>
          <div className="space-y-2">
            {Object.entries(t.by_plan).sort(([,a],[,b]) => b - a).map(([plan, count]) => (
              <div key={plan} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-24 capitalize">{plan}</span>
                <div className="flex-1 bg-[#1a1d2e] rounded-full h-1.5">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full"
                    style={{ width: `${t.total ? (count / t.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
