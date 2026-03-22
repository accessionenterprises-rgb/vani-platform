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
  login:   (secret) => request('POST', '/admin/auth', { secret }),
  stats:   ()       => request('GET', '/admin/stats'),

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
}
