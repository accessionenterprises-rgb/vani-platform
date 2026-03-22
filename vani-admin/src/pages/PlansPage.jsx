import { useEffect, useState } from 'react'
import { adminApi } from '../api/client'

export default function PlansPage() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.listPlans().then(setPlans).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const colors = {
    starter:    { border: 'border-slate-700', badge: 'bg-slate-500/15 text-slate-400' },
    growth:     { border: 'border-indigo-500/40', badge: 'bg-indigo-500/15 text-indigo-400' },
    enterprise: { border: 'border-amber-500/40', badge: 'bg-amber-500/15 text-amber-400' },
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Plans</h1>
        <p className="text-sm text-slate-500 mt-1">Current plan definitions and tenant distribution.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => {
          const c = colors[plan.slug] || colors.starter
          return (
            <div key={plan.slug} className={`bg-[#0d0f1a] border ${c.border} rounded-xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.badge}`}>
                  {plan.name}
                </span>
                <span className="text-2xl font-bold text-white">{plan.tenant_count}</span>
              </div>

              <p className="text-xs text-slate-600 mb-3">tenants</p>

              <div className="space-y-2 pt-3 border-t border-[#1a1d2e]">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Max agents</span>
                  <span className="text-slate-300">{plan.max_agents === -1 ? 'Unlimited' : plan.max_agents}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Calls/month</span>
                  <span className="text-slate-300">{plan.max_calls_per_month === -1 ? 'Unlimited' : plan.max_calls_per_month?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Concurrent calls</span>
                  <span className="text-slate-300">{plan.max_concurrent_calls === -1 ? 'Unlimited' : plan.max_concurrent_calls}</span>
                </div>
              </div>

              {plan.features && plan.features.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#1a1d2e]">
                  <p className="text-xs text-slate-600 mb-2">Features</p>
                  <div className="flex flex-wrap gap-1">
                    {plan.features.map(f => (
                      <span key={f} className="text-[10px] bg-[#1a1d2e] text-slate-500 px-2 py-0.5 rounded">
                        {f.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-700 mt-6">
        Plan limits are enforced at the orchestrator level. To change plan definitions, update PLAN_DEFINITIONS in vani-api/app/routers/admin.py.
      </p>
    </div>
  )
}
