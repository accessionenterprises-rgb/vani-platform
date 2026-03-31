import { useState } from 'react'
import { useTab } from '../hooks/useDrawer'
import { useAnalyticsOverview } from '../hooks/useAnalytics'
import TabBar from '../components/shared/TabBar'
import EmptyState from '../components/shared/EmptyState'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'quality', label: 'Quality' },
  { key: 'latency', label: 'Latency' },
]

const PERIODS = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
]

export default function AnalyticsPage() {
  const { activeTab, setTab } = useTab('tab', 'overview')
  const [period, setPeriod] = useState(7)
  const { data: overview, isLoading } = useAnalyticsOverview(period)

  return (
    <div className="w-full h-full px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#fafafa] tracking-[-0.02em]">Analytics</h1>
          <p className="text-[13px] text-[#52525b] mt-0.5">Call performance and agent insights</p>
        </div>
        {/* Period pills */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                period === p.value
                  ? 'bg-[#8b5cf6] text-white'
                  : 'text-[#52525b] hover:text-[#a1a1aa]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <TabBar tabs={TABS} active={activeTab} onChange={setTab} className="mb-6" />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : overview ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <KPICard label="Total Calls" value={overview.total_calls ?? 0} />
                <KPICard label="Success Rate" value={`${overview.success_rate ?? 0}%`} />
                <KPICard label="Avg Duration" value={fmtDur(overview.avg_duration_sec)} />
                <KPICard label="Active Now" value={overview.active_now ?? 0} pulse={overview.active_now > 0} />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="glass p-4">
                  <p className="text-[11px] text-[#52525b] uppercase tracking-[0.04em] mb-1">Completed</p>
                  <p className="text-[20px] font-bold text-[#22c55e]">{overview.completed ?? 0}</p>
                </div>
                <div className="glass p-4">
                  <p className="text-[11px] text-[#52525b] uppercase tracking-[0.04em] mb-1">Failed</p>
                  <p className="text-[20px] font-bold text-[#ef4444]">{overview.failed ?? 0}</p>
                </div>
                <div className="glass p-4">
                  <p className="text-[11px] text-[#52525b] uppercase tracking-[0.04em] mb-1">Inbound / Outbound</p>
                  <p className="text-[20px] font-bold text-[#fafafa]">
                    {overview.inbound ?? 0} <span className="text-[12px] text-[#52525b] font-normal">/</span> {overview.outbound ?? 0}
                  </p>
                </div>
              </div>

              {/* Chart placeholder */}
              <div className="glass p-6">
                <p className="text-[13px] font-semibold text-[#a1a1aa] uppercase tracking-[0.04em] mb-4">Call Volume</p>
                <div className="flex items-center justify-center py-12 text-[13px] text-[#52525b]">
                  Charts coming soon
                </div>
              </div>
            </>
          ) : (
            <EmptyState title="No analytics data" description="Data will appear once calls are made" />
          )}
        </div>
      )}

      {/* Quality Tab */}
      {activeTab === 'quality' && (
        <EmptyState title="QA" description="QA — being migrated" />
      )}

      {/* Latency Tab */}
      {activeTab === 'latency' && (
        <EmptyState title="Latency" description="Latency — being migrated" />
      )}
    </div>
  )
}

function KPICard({ label, value, pulse }) {
  return (
    <div className="glass p-4">
      <p className="text-[11px] text-[#52525b] uppercase tracking-[0.04em] mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-[20px] font-bold text-[#fafafa]">{value}</p>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute h-full w-full rounded-full bg-[#8b5cf6] opacity-60" />
            <span className="relative h-2 w-2 rounded-full bg-[#8b5cf6]" />
          </span>
        )}
      </div>
    </div>
  )
}

function fmtDur(sec) {
  if (!sec) return '--'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}
