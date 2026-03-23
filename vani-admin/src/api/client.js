const BASE = 'https://api.vani.live'

function getToken() {
  return localStorage.getItem('vani_admin_token')
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('vani_admin_token')
    window.location.href = '/login'
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    const detail = err.detail
    const msg = Array.isArray(detail)
      ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
      : (typeof detail === 'string' ? detail : null)
    throw new Error(msg || `HTTP ${res.status}`)
  }

  if (res.status === 204) return null
  return res.json()
}

export const adminApi = {
  login:     (email, password) => request('POST', '/admin/auth', { email, password }),
  me:        ()                => request('GET', '/admin/auth/me'),
  stats:     ()                => request('GET', '/admin/stats'),

  // Admin user management (superadmin only)
  listAdmins:   ()             => request('GET', '/admin/admins'),
  createAdmin:  (data)         => request('POST', '/admin/admins', data),
  updateAdmin:  (id, data)     => request('PATCH', `/admin/admins/${id}`, data),
  deleteAdmin:  (id)           => request('DELETE', `/admin/admins/${id}`),
  bootstrap:    (data)         => request('POST', '/admin/bootstrap', data),

  // Tenants
  listTenants:  (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null))).toString()
    return request('GET', `/admin/tenants${qs ? '?' + qs : ''}`)
  },
  getTenant:    (id)        => request('GET', `/admin/tenants/${id}`),
  updateTenant: (id, data)  => request('PATCH', `/admin/tenants/${id}`, data),
  deleteTenant: (id)        => request('DELETE', `/admin/tenants/${id}`),

  // Agents
  listAgents:   (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null))).toString()
    return request('GET', `/admin/agents${qs ? '?' + qs : ''}`)
  },
  updateAgent:  (id, data)  => request('PATCH', `/admin/agents/${id}`, data),
  deleteAgent:  (id)        => request('DELETE', `/admin/agents/${id}`),

  // Config
  listConfig:   ()       => request('GET', '/admin/config'),
  updateConfig: (data)   => request('PATCH', '/admin/config', data),

  // Health
  health:       ()       => request('GET', '/admin/health'),

  // Plans
  listPlans:    ()       => request('GET', '/admin/plans'),

  // Impersonation
  impersonate:  (id)     => request('POST', `/admin/tenants/${id}/impersonate`),

  // Calls
  listCalls:    (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null))).toString()
    return request('GET', `/admin/calls${qs ? '?' + qs : ''}`)
  },

  // Number Hunter
  hunterResults:  (status, country, tier) => {
    const p = new URLSearchParams()
    if (status)  p.set('status', status)
    if (country) p.set('country', country)
    if (tier)    p.set('tier', tier)
    const qs = p.toString()
    return request('GET', `/admin/hunter/results${qs ? '?' + qs : ''}`)
  },
  hunterScans:    (country) => {
    const qs = country ? `?country=${country}` : ''
    return request('GET', `/admin/hunter/scans${qs}`)
  },
  hunterStatus:   ()        => request('GET',  '/admin/hunter/status'),
  hunterScan:     (countries, service = 'twilio') => {
    const list = Array.isArray(countries) ? countries : [countries]
    return request('POST', '/admin/hunter/scan', { countries: list, service })
  },
  hunterScanAll:  ()        => request('POST', '/admin/hunter/scan-all'),
  hunterPurchase: (number)  => request('POST', '/admin/hunter/purchase', { number }),
  hunterClearScans:   ()   => request('DELETE', '/admin/hunter/scans'),
  hunterClearResults: ()   => request('DELETE', '/admin/hunter/results'),

  // Schedules
  listSchedules:   ()         => request('GET',    '/admin/hunter/schedules'),
  createSchedule:  (data)     => request('POST',   '/admin/hunter/schedules', data),
  updateSchedule:  (id, data) => request('PUT',    `/admin/hunter/schedules/${id}`, data),
  deleteSchedule:  (id)       => request('DELETE', `/admin/hunter/schedules/${id}`),
}
