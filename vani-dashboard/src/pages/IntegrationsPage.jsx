import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTab } from '../hooks/useDrawer'
import { useWebhooks } from '../hooks/useSettings'
import TabBar from '../components/shared/TabBar'
import Badge from '../components/shared/Badge'
import EmptyState from '../components/shared/EmptyState'

// ── Flow Builder ─────────────────────────────────────────────────────────────

const NODE_TYPES = [
  { type: 'speak',     emoji: '🔊', label: 'Speak',     color: '#8b5cf6' },
  { type: 'listen',    emoji: '👂', label: 'Listen',    color: '#3b82f6' },
  { type: 'branch',    emoji: '🔀', label: 'Branch',    color: '#f59e0b' },
  { type: 'transfer',  emoji: '↗️',  label: 'Transfer',  color: '#22c55e' },
  { type: 'end',       emoji: '⏹',  label: 'End',       color: '#ef4444' },
  { type: 'condition', emoji: '❓', label: 'Condition', color: '#a78bfa' },
  { type: 'webhook',   emoji: '🔗', label: 'Webhook',   color: '#06b6d4' },
]

const INIT_NODES = [
  { id: '1', type: 'speak',    label: 'mira-live',  x: 320, y: 60  },
  { id: '2', type: 'listen',   label: 'Listen',     x: 320, y: 180 },
  { id: '3', type: 'branch',   label: 'Branch',     x: 320, y: 300 },
  { id: '4', type: 'transfer', label: 'Transfer',   x: 480, y: 420 },
  { id: '5', type: 'end',      label: 'End',        x: 160, y: 420 },
]
const INIT_EDGES = [
  { id: 'e1', from: '1', to: '2' },
  { id: 'e2', from: '2', to: '3' },
  { id: 'e3', from: '3', to: '4' },
  { id: 'e4', from: '3', to: '5' },
]

function FlowBuilder() {
  const [nodes, setNodes] = useState(INIT_NODES)
  const [edges, setEdges] = useState(INIT_EDGES)
  const [zoom, setZoom] = useState(1)
  const [connecting, setConnecting] = useState(null) // fromNodeId
  const [agentName] = useState('mira-live')
  const dragRef = useRef(null)
  const canvasRef = useRef(null)

  function startDrag(e, nodeId) {
    e.stopPropagation()
    const node = nodes.find(n => n.id === nodeId)
    dragRef.current = { nodeId, startX: e.clientX - node.x, startY: e.clientY - node.y }
    const move = (ev) => {
      if (!dragRef.current) return
      const { nodeId, startX, startY } = dragRef.current
      setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, x: (ev.clientX - startX), y: (ev.clientY - startY) } : n))
    }
    const up = () => { dragRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function addNode(type) {
    const meta = NODE_TYPES.find(t => t.type === type)
    const newId = String(Date.now())
    const lastNode = nodes[nodes.length - 1]
    setNodes(ns => [...ns, { id: newId, type, label: meta.label, x: lastNode ? lastNode.x : 320, y: lastNode ? lastNode.y + 120 : 60 }])
    if (lastNode) setEdges(es => [...es, { id: `e${newId}`, from: lastNode.id, to: newId }])
  }

  function removeEdge(edgeId) {
    setEdges(es => es.filter(e => e.id !== edgeId))
  }

  function exportFlow() {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${agentName}-flow.json`; a.click()
  }

  function importFlow() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return
      const reader = new FileReader()
      reader.onload = ev => { try { const d = JSON.parse(ev.target.result); setNodes(d.nodes); setEdges(d.edges) } catch {} }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[520px] rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {/* Left panel */}
      <div className="w-[160px] shrink-0 flex flex-col p-3 gap-1 border-r" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] px-1 mb-2" style={{ color: 'var(--text-muted)' }}>Add Node</p>
        {NODE_TYPES.map(nt => (
          <button key={nt.type} onClick={() => addNode(nt.type)}
            className="flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all text-[12px] font-medium"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span className="text-[14px]">{nt.emoji}</span>
            {nt.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div ref={canvasRef} className="flex-1 relative overflow-hidden" style={{ background: 'var(--bg)', cursor: 'default' }}>
        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="var(--text-muted)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', position: 'absolute', inset: 0 }}>
          {/* Edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible', zIndex: 1 }}>
            {edges.map(edge => {
              const from = nodes.find(n => n.id === edge.from)
              const to = nodes.find(n => n.id === edge.to)
              if (!from || !to) return null
              const x1 = from.x + 80, y1 = from.y + 36
              const x2 = to.x + 80,   y2 = to.y
              const mx = (x1 + x2) / 2
              return (
                <g key={edge.id} className="pointer-events-auto" style={{ cursor: 'pointer' }} onClick={() => removeEdge(edge.id)}>
                  <path d={`M${x1},${y1} C${x1},${mx} ${x2},${mx} ${x2},${y2}`}
                    stroke="rgba(139,92,246,0.35)" strokeWidth="2" fill="none" strokeDasharray="6 3" />
                  <path d={`M${x1},${y1} C${x1},${mx} ${x2},${mx} ${x2},${y2}`}
                    stroke="transparent" strokeWidth="12" fill="none" />
                </g>
              )
            })}
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const meta = NODE_TYPES.find(t => t.type === node.type) || NODE_TYPES[0]
            return (
              <div key={node.id}
                onMouseDown={e => startDrag(e, node.id)}
                className="absolute select-none"
                style={{ left: node.x, top: node.y, zIndex: 2, cursor: 'grab', width: 160 }}>
                <div className="rounded-xl px-3 py-2.5 text-[12px] font-medium flex items-center gap-2"
                  style={{
                    background: `${meta.color}18`,
                    border: `1px solid ${meta.color}40`,
                    color: 'var(--text)',
                    boxShadow: `0 2px 8px ${meta.color}15`,
                  }}>
                  <span>{meta.emoji}</span>
                  <span className="flex-1 truncate">{node.label}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded font-semibold"
                    style={{ background: `${meta.color}25`, color: meta.color }}>
                    {meta.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Toolbar */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <button onClick={importFlow} className="btn-ghost text-[11px] py-1.5 px-3 border" style={{ borderColor: 'var(--border)' }}>Import</button>
          <button onClick={exportFlow} className="btn-ghost text-[11px] py-1.5 px-3 border" style={{ borderColor: 'var(--border)' }}>Export</button>
          <div className="flex items-center gap-1 rounded-lg border px-2 py-1" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="w-5 h-5 flex items-center justify-center text-[14px]" style={{ color: 'var(--text-secondary)' }}>+</button>
            <span className="text-[11px] w-9 text-center" style={{ color: 'var(--text-muted)' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="w-5 h-5 flex items-center justify-center text-[14px]" style={{ color: 'var(--text-secondary)' }}>−</button>
          </div>
        </div>

        {/* Status bar */}
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3 z-10">
          <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: 'var(--surface-1)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {nodes.length} nodes · {edges.length} connections · Drag nodes to move · Click edge to delete
          </span>
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { key: 'apps', label: 'Apps' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'flow', label: 'Flow Builder' },
]

const FILTER_CATS = ['All', 'Automation', 'CRM', 'Data', 'Notifications', 'Productivity']

const INTEGRATIONS = [
  {
    name: 'Zapier',
    emoji: '⚡',
    category: 'Automation',
    status: 'available',
    description: 'Trigger Zaps when calls start, end, or fail. Push call data to 5,000+ apps.',
  },
  {
    name: 'Make (Integromat)',
    emoji: '🔧',
    category: 'Automation',
    status: 'available',
    description: 'Build visual workflows triggered by Vani call events.',
  },
  {
    name: 'HubSpot',
    emoji: '🟠',
    category: 'CRM',
    status: 'soon',
    description: 'Log calls and transcripts as HubSpot activities. Create contacts from inbound callers.',
    note: 'Native connector coming soon — use webhooks in the meantime.',
  },
  {
    name: 'Salesforce',
    emoji: '☁️',
    category: 'CRM',
    status: 'soon',
    description: 'Sync call logs and AI summaries to Salesforce opportunities and contacts.',
    note: 'Native connector coming soon — use webhooks in the meantime.',
  },
  {
    name: 'Google Sheets',
    emoji: '📊',
    category: 'Data',
    status: 'available',
    description: 'Export call logs and extracted data to Google Sheets automatically.',
  },
  {
    name: 'Slack',
    emoji: '💬',
    category: 'Notifications',
    status: 'available',
    description: 'Get Slack alerts for new calls, escalations, and failed calls.',
  },
  {
    name: 'Notion',
    emoji: '📝',
    category: 'Productivity',
    status: 'available',
    description: 'Add call summaries and transcripts to a Notion database.',
  },
  {
    name: 'Pabbly Connect',
    emoji: '🔌',
    category: 'Automation',
    status: 'available',
    description: 'India-friendly automation platform. Connect Vani to 1,000+ apps.',
  },
]

export default function IntegrationsPage() {
  const navigate = useNavigate()
  const { activeTab, setTab } = useTab('tab', 'apps')
  const { data: webhooks = [], isLoading: loadingWebhooks } = useWebhooks()
  const [activeCat, setActiveCat] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = INTEGRATIONS.filter(i => {
    const matchCat = activeCat === 'All' || i.category === activeCat
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="w-full h-full px-6 py-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>Integrations</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Connect Vani to your stack using webhooks and native connectors.{' '}
            <a href="#" className="hover:underline transition-colors" style={{ color: 'var(--accent)' }}>API docs →</a>
          </p>
        </div>
      </div>

      <TabBar tabs={TABS} active={activeTab} onChange={setTab} className="mb-6" />

      {/* Apps Tab */}
      {activeTab === 'apps' && (
        <div>
          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            {/* Category pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {FILTER_CATS.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                  style={{
                    background: activeCat === cat ? 'var(--accent-dim)' : 'transparent',
                    color: activeCat === cat ? 'var(--accent)' : 'var(--text-muted)',
                    border: `1px solid ${activeCat === cat ? 'rgba(139,92,246,0.25)' : 'transparent'}`,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="ml-auto relative">
              <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="input pl-9 w-[180px] text-[12px]"
              />
            </div>
          </div>

          {/* Integration cards */}
          {filtered.length === 0 ? (
            <EmptyState title="No integrations found" description="Try a different search or category" />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(intg => (
                <div key={intg.name} className="glass glass-glow p-5 flex flex-col gap-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[22px]"
                        style={{ background: 'var(--accent-dim)', border: '1px solid rgba(139,92,246,0.12)' }}>
                        {intg.emoji}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>{intg.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{intg.category}</span>
                          {intg.status === 'available' ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
                              Available
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                              Soon
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {intg.description}
                  </p>

                  {/* Note for "soon" */}
                  {intg.note && (
                    <p className="text-[11px] leading-relaxed px-3 py-2 rounded-lg"
                      style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(234,179,8,0.15)' }}>
                      {intg.note}
                    </p>
                  )}

                  {/* Footer link */}
                  {intg.status === 'available' && (
                    <div className="mt-auto pt-1">
                      <a href="#" className="text-[12px] font-medium hover:underline transition-colors"
                        style={{ color: 'var(--accent)' }}>
                        Setup guide →
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Webhook callout */}
          <div className="mt-6 glass p-5 flex items-start gap-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[18px]"
              style={{ background: 'var(--accent-dim)', border: '1px solid rgba(139,92,246,0.12)' }}>
              🔗
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Using the Webhook API</p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                All integrations can be powered by Vani's webhook system. Configure webhooks at Settings → Webhooks
                to receive real-time event payloads for <code className="px-1 py-0.5 rounded text-[11px]"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>call.started</code>,{' '}
                <code className="px-1 py-0.5 rounded text-[11px]"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>call.ended</code>, and{' '}
                <code className="px-1 py-0.5 rounded text-[11px]"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>call.analyzed</code> events.
              </p>
            </div>
            <button
              onClick={() => { setTab('webhooks') }}
              className="btn-primary shrink-0 text-[12px] py-2 px-4"
            >
              Configure webhooks →
            </button>
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>Webhooks</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Subscribe to call events. Payload is signed with HMAC-SHA256.</p>
            </div>
            <button className="btn-primary text-[12px] py-2 px-4">+ Add Webhook</button>
          </div>

          {loadingWebhooks ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : webhooks.length === 0 ? (
            <EmptyState icon="🔗" title="No webhooks yet" description="Subscribe to call events to integrate with your systems" />
          ) : (
            <div className="glass overflow-hidden">
              <div className="grid grid-cols-4 gap-3 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                {['URL', 'Events', 'Created', 'Status'].map(h => (
                  <p key={h} className="text-[11px] font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--text-muted)' }}>{h}</p>
                ))}
              </div>
              {webhooks.map((w, idx) => (
                <div key={w.id} className="grid grid-cols-4 gap-3 px-4 py-2.5"
                  style={{ borderBottom: idx < webhooks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <p className="text-[13px] font-mono truncate" style={{ color: 'var(--text)' }}>{w.url || '—'}</p>
                  <p className="text-[13px] truncate" style={{ color: 'var(--text-secondary)' }}>{Array.isArray(w.events) ? w.events.join(', ') : w.events || '—'}</p>
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{w.created_at ? new Date(w.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}</p>
                  <Badge status={w.active ? 'active' : 'inactive'} />
                </div>
              ))}
            </div>
          )}

          {/* Example payload */}
          <div className="glass p-5">
            <p className="text-[13px] font-semibold mb-3" style={{ color: 'var(--text)' }}>Example Payload</p>
            <pre className="rounded-xl p-4 text-[11px] font-mono leading-relaxed overflow-x-auto"
              style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{`{
  "event": "call.analyzed",
  "timestamp": "2026-03-21T12:00:00Z",
  "data": {
    "call_id": "uuid",
    "sentiment": "positive",
    "intent": "booking",
    "summary": "Customer booked a table for 4 at 8pm Friday.",
    "resolved": true
  }
}`}</pre>
          </div>
        </div>
      )}

      {/* Flow Builder Tab */}
      {activeTab === 'flow' && <FlowBuilder />}
    </div>
  )
}
