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
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const colors = {
    starter:    { border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600' },
    growth:     { border: 'border-violet-200', badge: 'bg-violet-50 text-violet-700' },
    enterprise: { border: 'border-amber-200', badge: 'bg-amber-50 text-amber-700' },
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">Plans</h1>
        <p className="text-base text-gray-500 mt-1">Current plan definitions and tenant distribution.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => {
          const c = colors[plan.slug] || colors.starter
          return (
            <div key={plan.slug} className={`bg-white border ${c.border} rounded-2xl shadow-sm p-5`}>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${c.badge}`}>
                  {plan.name}
                </span>
                <span className="text-xl font-bold text-gray-900">{plan.tenant_count}</span>
              </div>

              <p className="text-sm text-gray-400 mb-3">tenants</p>

              <div className="space-y-2 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Max agents</span>
                  <span className="text-gray-700">{plan.max_agents === -1 ? 'Unlimited' : plan.max_agents}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Calls/month</span>
                  <span className="text-gray-700">{plan.max_calls_per_month === -1 ? 'Unlimited' : plan.max_calls_per_month?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Concurrent calls</span>
                  <span className="text-gray-700">{plan.max_concurrent_calls === -1 ? 'Unlimited' : plan.max_concurrent_calls}</span>
                </div>
              </div>

              {plan.features && plan.features.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-400 mb-2">Features</p>
                  <div className="flex flex-wrap gap-1">
                    {plan.features.map(f => (
                      <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
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

      <p className="text-sm text-gray-400 mt-6">
        Plan limits are enforced at the orchestrator level. To change plan definitions, update PLAN_DEFINITIONS in vani-api/app/routers/admin.py.
      </p>
    </div>
  )
}
