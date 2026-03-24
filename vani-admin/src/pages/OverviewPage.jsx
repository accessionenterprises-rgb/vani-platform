import { useEffect, useState } from 'react'
import { adminApi } from '../api/client'

/* ── Tiny sparkline (pure SVG, no deps) ─────────────────────────────── */
function Sparkline({ data = [], color = '#7C3AED', height = 32, width = 80 }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`
  ).join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - ((data[data.length - 1] - min) / range) * height} r="2.5" fill={color} />
    </svg>
  )
}

/* ── Animated pulse ring (live indicator) ────────────────────────────── */
function LivePulse() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
    </span>
  )
}

/* ── Audio waveform animation ────────────────────────────────────────── */
function WaveformBars({ active = false }) {
  const bars = [3, 5, 2, 6, 4, 7, 3, 5, 2, 4, 6, 3, 5, 7, 4, 2, 6, 5, 3, 4]
  return (
    <div className="flex items-end gap-[2px] h-8">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all duration-300 ${active ? 'bg-violet-400' : 'bg-gray-200'}`}
          style={{
            height: active ? `${h * 4}px` : '4px',
            animationName: active ? 'waveform' : 'none',
            animationDuration: `${0.5 + (i % 5) * 0.15}s`,
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ))}
      <style>{`
        @keyframes waveform {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

/* ── KPI Card ────────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon, accent, accentText, trend, sparkData }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center`}>
          {icon}
        </div>
        {sparkData && <Sparkline data={sparkData} color={accentText} height={36} width={90} />}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[40px] font-bold text-gray-900 tracking-tight leading-none">{value ?? '—'}</p>
          <p className="text-base font-medium text-gray-400 mt-2">{label}</p>
        </div>
        {trend !== undefined && (
          <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
            trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      {sub && <p className="text-sm text-gray-400 mt-1.5">{sub}</p>}
    </div>
  )
}

/* ── Plan distribution bar ───────────────────────────────────────────── */
function PlanBar({ plan, count, total, color }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-4">
      <span className="text-base font-medium text-gray-700 w-24 capitalize">{plan}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right">
        <span className="text-base font-semibold text-gray-900">{count}</span>
        <span className="text-sm text-gray-400 ml-1">{pct}%</span>
      </div>
    </div>
  )
}

/* ── Activity feed item ──────────────────────────────────────────────── */
function ActivityItem({ icon, iconBg, title, subtitle, time }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base text-gray-800 font-medium truncate">{title}</p>
        <p className="text-sm text-gray-400">{subtitle}</p>
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap">{time}</span>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function OverviewPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.stats().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const t = stats?.tenants || {}
  const a = stats?.agents || {}
  const c = stats?.calls || {}

  // Mock sparkline data (replace with real data when available)
  const tenantSpark = [2, 3, 3, 4, 5, 5, 6, 7, 8, t.total || 10]
  const agentSpark = [5, 8, 6, 9, 7, 10, 12, 11, 14, a.active || 15]
  const callSpark = [20, 35, 28, 45, 38, 52, 48, 60, 55, c.today || 40]
  const minuteSpark = [100, 150, 120, 200, 180, 250, 220, 300, 280, c.total_minutes || 350]

  const planColors = {
    starter: 'bg-gray-400',
    growth: 'bg-violet-500',
    enterprise: 'bg-amber-500',
  }

  const liveCalls = c.active_now || 0

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="text-base font-medium text-gray-400 mb-1.5">Dashboard</p>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Platform Overview</h1>
        </div>
        {/* Live calls indicator */}
        <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm">
          <WaveformBars active={liveCalls > 0} />
          <div className="ml-2">
            <div className="flex items-center gap-2">
              {liveCalls > 0 && <LivePulse />}
              <span className="text-xl font-semibold text-gray-900">{liveCalls}</span>
            </div>
            <p className="text-sm text-gray-400">Live calls</p>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <KpiCard
          label="Total Tenants"
          value={t.total}
          sub={`${t.disabled || 0} disabled`}
          accent="bg-violet-50"
          accentText="#7C3AED"
          sparkData={tenantSpark}
          icon={<svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-violet-600" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
        />
        <KpiCard
          label="Active Agents"
          value={a.active}
          sub={`${a.total} total`}
          accent="bg-emerald-50"
          accentText="#059669"
          sparkData={agentSpark}
          icon={<svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>}
        />
        <KpiCard
          label="Calls Today"
          value={c.today}
          sub={`${liveCalls} live now`}
          accent="bg-blue-50"
          accentText="#2563EB"
          sparkData={callSpark}
          icon={<svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
        />
        <KpiCard
          label="Total Minutes"
          value={c.total_minutes}
          sub={`${c.total} calls ever`}
          accent="bg-amber-50"
          accentText="#D97706"
          sparkData={minuteSpark}
          icon={<svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
      </div>

      {/* Two-column layout: Plans + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Plan Breakdown — 3 cols */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">Tenants by Plan</h2>
            <span className="text-sm text-gray-400">{t.total} total</span>
          </div>
          {t.by_plan && Object.keys(t.by_plan).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(t.by_plan).sort(([,a],[,b]) => b - a).map(([plan, count]) => (
                <PlanBar key={plan} plan={plan} count={count} total={t.total} color={planColors[plan] || 'bg-gray-400'} />
              ))}
            </div>
          ) : (
            <p className="text-base text-gray-400 py-8 text-center">No tenant data yet</p>
          )}

          {/* Quick stats row */}
          <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xl font-semibold text-gray-900">{a.total || 0}</p>
              <p className="text-sm text-gray-400">Total Agents</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-gray-900">{c.total || 0}</p>
              <p className="text-sm text-gray-400">Total Calls</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-gray-900">{t.disabled || 0}</p>
              <p className="text-sm text-gray-400">Disabled</p>
            </div>
          </div>
        </div>

        {/* Activity Feed — 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <span className="text-sm text-violet-600 font-medium cursor-pointer hover:text-violet-700">View all</span>
          </div>
          <div className="divide-y divide-gray-50">
            <ActivityItem
              icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3"/></svg>}
              iconBg="bg-emerald-50"
              title="Call completed"
              subtitle="Agent: Sales Bot · 4m 32s"
              time="2m ago"
            />
            <ActivityItem
              icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>}
              iconBg="bg-violet-50"
              title="New tenant registered"
              subtitle="acme-corp · Growth plan"
              time="15m ago"
            />
            <ActivityItem
              icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>}
              iconBg="bg-blue-50"
              title="Agent deployed"
              subtitle="Support Agent · tenant-xyz"
              time="1h ago"
            />
            <ActivityItem
              icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              iconBg="bg-amber-50"
              title="High latency detected"
              subtitle="LiveKit · p95: 820ms"
              time="3h ago"
            />
            <ActivityItem
              icon={<svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.8}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              iconBg="bg-emerald-50"
              title="Call completed"
              subtitle="Agent: Booking Bot · 2m 18s"
              time="4h ago"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
