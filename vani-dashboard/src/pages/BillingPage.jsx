import { useEffect, useState } from 'react'
import { api } from '../api/client'

const COST_COLORS = {
  telephony: '#2563EB',
  stt: '#8B5CF6',
  llm: '#F59E0B',
  tts: '#10B981',
}

export default function BillingPage() {
  const [plan, setPlan]         = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    Promise.allSettled([
      api.getBillingPlan(),
      api.getBillingInvoices(),
    ]).then(([planRes, invRes]) => {
      if (planRes.status === 'fulfilled') setPlan(planRes.value)
      if (invRes.status === 'fulfilled') setInvoices(invRes.value?.invoices || invRes.value || [])
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const usage = plan?.usage || {}
  const minutesUsed = usage.minutes_used || 0
  const minutesIncluded = usage.minutes_included || plan?.minutes_included || 1000
  const usagePct = Math.min(100, (minutesUsed / minutesIncluded) * 100)

  const costBreakdown = plan?.cost_breakdown || usage.cost_breakdown || {}
  const totalCost = Object.values(costBreakdown).reduce((s, v) => s + (v || 0), 0)
  const costEntries = [
    { key: 'telephony', label: 'Telephony', value: costBreakdown.telephony || 0 },
    { key: 'stt', label: 'Speech-to-Text', value: costBreakdown.stt || 0 },
    { key: 'llm', label: 'LLM', value: costBreakdown.llm || 0 },
    { key: 'tts', label: 'Text-to-Speech', value: costBreakdown.tts || 0 },
  ]

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-5xl">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-[#1A1816]">Billing</h1>
          <p className="text-base text-[#A8A29E] mt-0.5">Manage your plan, usage, and invoices</p>
        </div>

        {error && (
          <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {/* Plan + Usage row */}
        <div className="grid grid-cols-2 gap-5 mb-6">
          {/* Current plan */}
          <div className="bg-white rounded-xl border border-[#E8E5E2] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-[#1A1816]">Current Plan</h2>
              {plan?.plan_name && (
                <span className="text-sm font-semibold bg-[#2563EB]/10 text-[#2563EB] px-3 py-1 rounded-full">
                  {plan.plan_name}
                </span>
              )}
            </div>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-[#A8A29E]">Status</dt>
                <dd className="text-sm font-medium">
                  <span className={`px-2 py-0.5 rounded-full text-sm ${
                    plan?.status === 'active' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                  }`}>
                    {plan?.status || 'Unknown'}
                  </span>
                </dd>
              </div>
              {plan?.billing_cycle && (
                <div className="flex justify-between">
                  <dt className="text-sm text-[#A8A29E]">Billing Cycle</dt>
                  <dd className="text-sm text-[#44403C]">{plan.billing_cycle}</dd>
                </div>
              )}
              {plan?.price !== undefined && (
                <div className="flex justify-between">
                  <dt className="text-sm text-[#A8A29E]">Price</dt>
                  <dd className="text-sm font-medium text-[#1A1816]">${plan.price}/mo</dd>
                </div>
              )}
              {plan?.next_billing_date && (
                <div className="flex justify-between">
                  <dt className="text-sm text-[#A8A29E]">Next Billing</dt>
                  <dd className="text-sm text-[#44403C]">{new Date(plan.next_billing_date).toLocaleDateString()}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sm text-[#A8A29E]">Included Minutes</dt>
                <dd className="text-sm text-[#44403C]">{minutesIncluded.toLocaleString()} min</dd>
              </div>
            </dl>
          </div>

          {/* Usage meter */}
          <div className="bg-white rounded-xl border border-[#E8E5E2] p-6">
            <h2 className="text-base font-medium text-[#1A1816] mb-4">Usage This Period</h2>
            <div className="mb-5">
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-bold text-[#1A1816]">{minutesUsed.toLocaleString()}</span>
                <span className="text-sm text-[#A8A29E]">/ {minutesIncluded.toLocaleString()} min</span>
              </div>
              <div className="h-3 bg-[#F5F5F4] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-[#2563EB]'}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <p className="text-sm text-[#A8A29E] mt-1.5">{usagePct.toFixed(1)}% used</p>
            </div>
            {usage.calls_count !== undefined && (
              <div className="flex gap-4 pt-3 border-t border-[#E8E5E2]">
                <div>
                  <p className="text-sm text-[#A8A29E]">Total Calls</p>
                  <p className="text-lg font-semibold text-[#1A1816]">{usage.calls_count}</p>
                </div>
                {usage.avg_duration_sec !== undefined && (
                  <div>
                    <p className="text-sm text-[#A8A29E]">Avg Duration</p>
                    <p className="text-lg font-semibold text-[#1A1816]">{Math.round(usage.avg_duration_sec)}s</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="bg-white rounded-xl border border-[#E8E5E2] p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-medium text-[#1A1816]">Cost Breakdown</h2>
            {totalCost > 0 && (
              <span className="text-lg font-bold text-[#1A1816]">${totalCost.toFixed(2)}</span>
            )}
          </div>

          {totalCost > 0 ? (
            <>
              {/* Horizontal stacked bar */}
              <div className="h-6 rounded-full overflow-hidden flex mb-5">
                {costEntries.filter(e => e.value > 0).map(e => (
                  <div
                    key={e.key}
                    style={{ width: `${(e.value / totalCost) * 100}%`, backgroundColor: COST_COLORS[e.key] }}
                    className="h-full transition-all"
                    title={`${e.label}: $${e.value.toFixed(2)}`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="grid grid-cols-4 gap-4">
                {costEntries.map(e => (
                  <div key={e.key} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COST_COLORS[e.key] }} />
                    <div>
                      <p className="text-sm text-[#78716C]">{e.label}</p>
                      <p className="text-base font-semibold text-[#1A1816]">${e.value.toFixed(2)}</p>
                      {totalCost > 0 && (
                        <p className="text-[12px] text-[#A8A29E]">{((e.value / totalCost) * 100).toFixed(0)}%</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[#A8A29E] text-center py-6">No cost data available for this period.</p>
          )}
        </div>

        {/* Invoice history */}
        <div className="bg-white rounded-xl border border-[#E8E5E2] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E8E5E2]">
            <h2 className="text-base font-medium text-[#1A1816]">Invoice History</h2>
          </div>
          {invoices.length === 0 ? (
            <div className="p-10 text-center text-[#A8A29E] text-sm">No invoices yet.</div>
          ) : (
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-[#E8E5E2]">
                  {['Date', 'Invoice #', 'Amount', 'Status', ''].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-sm font-medium text-[#A8A29E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDEA]">
                {invoices.map((inv, i) => (
                  <tr key={inv.id || i} className="hover:bg-[#FAFAF9] transition-colors">
                    <td className="px-6 py-3.5 text-sm text-[#44403C]">
                      {inv.date ? new Date(inv.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-[#78716C] font-mono">{inv.invoice_number || inv.id?.slice(0, 12) || '—'}</td>
                    <td className="px-6 py-3.5 text-sm font-medium text-[#1A1816]">
                      ${(inv.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`text-sm px-2 py-0.5 rounded-full ${
                        inv.status === 'paid' ? 'bg-emerald-500/15 text-emerald-500' :
                        inv.status === 'pending' ? 'bg-amber-500/15 text-amber-500' :
                        'bg-[#F5F5F4] text-[#78716C]'
                      }`}>
                        {inv.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {inv.pdf_url && (
                        <a href={inv.pdf_url} target="_blank" rel="noreferrer"
                          className="text-sm text-[#2563EB] hover:text-[#3B82F6]">
                          Download
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
