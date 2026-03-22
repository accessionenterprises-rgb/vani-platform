const BASE = import.meta.env.VITE_API_URL || 'https://api.vani.live'

function getToken() {
  return localStorage.getItem('vani_token')
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
    localStorage.removeItem('vani_token')
    localStorage.removeItem('vani_tenant')
    window.location.href = '/login'
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Auth
  login:  (email, password) => request('POST', '/auth/login', { email, password }),
  signup: (email, password, name) => request('POST', '/auth/signup', { email, password, name }),
  me:     () => request('GET', '/auth/me'),

  // Agents
  listAgents:   ()          => request('GET', '/agents'),
  getAgent:     (id)        => request('GET', `/agents/${id}`),
  createAgent:  (data)      => request('POST', '/agents', data),
  updateAgent:  (id, data)  => request('PATCH', `/agents/${id}`, data),
  deleteAgent:  (id)        => request('DELETE', `/agents/${id}`),
  listAgentVersions: (id)             => request('GET', `/agents/${id}/versions`),
  restoreAgentVersion: (id, versionId) => request('POST', `/agents/${id}/versions/${versionId}/restore`),

  // KB
  listKb:      (agentId)          => request('GET', `/agents/${agentId}/kb`),
  deleteKbDoc: (agentId, docId)   => request('DELETE', `/agents/${agentId}/kb/${docId}`),

  // Tools (function calling)
  listTools:   (agentId)         => request('GET', `/agents/${agentId}/tools`),
  createTool:  (agentId, data)   => request('POST', `/agents/${agentId}/tools`, data),
  updateTool:  (agentId, id, d)  => request('PATCH', `/agents/${agentId}/tools/${id}`, d),
  deleteTool:  (agentId, id)     => request('DELETE', `/agents/${agentId}/tools/${id}`),

  // Calls
  listCalls: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/calls${qs ? '?' + qs : ''}`)
  },
  getCall:          (id) => request('GET', `/calls/${id}`),
  getTranscript:    (id) => request('GET', `/calls/${id}/transcript`),
  stopCall:         (id) => request('POST', `/calls/${id}/stop`),
  getMonitorToken:  (id) => request('GET', `/calls/${id}/monitor-token`),

  // Outbound
  triggerOutbound: (data) => request('POST', '/calls/outbound', data),

  // Campaigns
  listCampaigns:   ()        => request('GET', '/campaigns'),
  createCampaign:  (data)    => request('POST', '/campaigns', data),
  getCampaign:     (id)      => request('GET', `/campaigns/${id}`),
  startCampaign:   (id)      => request('POST', `/campaigns/${id}/start`),
  pauseCampaign:   (id)      => request('POST', `/campaigns/${id}/pause`),
  cancelCampaign:  (id)      => request('POST', `/campaigns/${id}/cancel`),
  getCampaignContacts: (id, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/campaigns/${id}/contacts${qs ? '?' + qs : ''}`)
  },
  uploadCampaignContacts: (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    const headers = {}
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    return fetch(`${BASE}/campaigns/${id}/contacts`, { method: 'POST', headers, body: formData })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(err.detail || `HTTP ${res.status}`)
        }
        return res.json()
      })
  },

  // DNC (Do-Not-Call) list
  listDNC:   (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/dnc${qs ? '?' + qs : ''}`)
  },
  addDNC:    (phone, reason) => request('POST', '/dnc', { phone, reason }),
  removeDNC: (phone)         => request('DELETE', `/dnc/${encodeURIComponent(phone)}`),
  checkDNC:  (phone)         => request('GET', `/dnc/check?phone=${encodeURIComponent(phone)}`),
  importDNC: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const headers = {}
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    return fetch(`${BASE}/dnc/import`, { method: 'POST', headers, body: formData })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(err.detail || `HTTP ${res.status}`)
        }
        return res.json()
      })
  },

  // Analytics
  analyticsOverview:   (period = 7) => request('GET', `/analytics/overview?period=${period}`),
  analyticsCalls:      (period = 7) => request('GET', `/analytics/calls?period=${period}`),
  analyticsAgents:     (period = 7) => request('GET', `/analytics/agents?period=${period}`),
  analyticsIntents:    (period = 7) => request('GET', `/analytics/intents?period=${period}`),
  analyticsProviders:  (period = 7) => request('GET', `/analytics/providers?period=${period}`),

  // Numbers
  listNumbers:  ()     => request('GET', '/numbers'),
  addNumber:    (data) => request('POST', '/numbers', data),
  deleteNumber: (id)   => request('DELETE', `/numbers/${id}`),

  // API Keys
  listKeys:  ()     => request('GET', '/api-keys'),
  createKey: (name) => request('POST', '/api-keys', { name }),
  deleteKey: (id)   => request('DELETE', `/api-keys/${id}`),

  // Webhooks
  listWebhooks:   ()        => request('GET', '/webhooks'),
  createWebhook:  (data)    => request('POST', '/webhooks', data),
  updateWebhook:  (id, data)=> request('PATCH', `/webhooks/${id}`, data),
  deleteWebhook:  (id)      => request('DELETE', `/webhooks/${id}`),

  // Products (kiosk showcase catalog)
  listProducts:   (agentId)           => request('GET',    `/agents/${agentId}/products`),
  createProduct:  (agentId, data)     => request('POST',   `/agents/${agentId}/products`, data),
  updateProduct:  (agentId, id, data) => request('PATCH',  `/agents/${agentId}/products/${id}`, data),
  deleteProduct:  (agentId, id)       => request('DELETE', `/agents/${agentId}/products/${id}`),

  // Playground (text chat)
  playgroundChat:        (data)       => request('POST', '/playground/chat', data),
  playgroundClearSession:(session_id) => request('DELETE', `/playground/chat/${session_id}`),

  // Dialer
  getDialerToken: () => request('GET', '/dialer/token'),
}
