import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

/**
 * Visual Flow Builder — drag-and-drop call flow editor.
 * No external library — pure React + CSS transforms.
 */

const NODE_TYPES = {
  start:      { label: 'Start',          color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' },
  speak:      { label: 'Speak',          color: 'bg-[#2563EB]/20 border-indigo-500/40 text-[#2563EB]' },
  listen:     { label: 'Listen',         color: 'bg-blue-500/20 border-blue-500/40 text-blue-400' },
  branch:     { label: 'Branch',         color: 'bg-amber-500/20 border-amber-500/40 text-amber-400' },
  transfer:   { label: 'Transfer',       color: 'bg-orange-500/20 border-orange-500/40 text-orange-400' },
  end:        { label: 'End',            color: 'bg-red-500/20 border-red-500/40 text-red-400' },
  condition:  { label: 'Condition',      color: 'bg-purple-500/20 border-purple-500/40 text-purple-400' },
  webhook:    { label: 'Webhook',        color: 'bg-teal-500/20 border-teal-500/40 text-teal-400' },
}

const DEFAULT_FLOW = {
  nodes: [
    { id: 'start',    type: 'start',    x: 60,  y: 40,  label: 'Start',          content: '' },
    { id: 'greet',    type: 'speak',    x: 60,  y: 150, label: 'Greet caller',   content: 'Welcome! How can I help you today?' },
    { id: 'listen1',  type: 'listen',   x: 60,  y: 260, label: 'Listen',         content: 'Wait for user intent' },
    { id: 'branch1',  type: 'branch',   x: 60,  y: 370, label: 'Route intent',   content: 'booking | support | other' },
    { id: 'end',      type: 'end',      x: 60,  y: 480, label: 'End call',       content: 'Thank you, goodbye!' },
  ],
  edges: [
    { from: 'start',   to: 'greet' },
    { from: 'greet',   to: 'listen1' },
    { from: 'listen1', to: 'branch1' },
    { from: 'branch1', to: 'end' },
  ],
}

let nodeCounter = 100

export default function FlowBuilderPage() {
  const [agents, setAgents]         = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [nodes, setNodes]           = useState(DEFAULT_FLOW.nodes)
  const [edges, setEdges]           = useState(DEFAULT_FLOW.edges)
  const [selectedNode, setSelectedNode] = useState(null)
  const [dragging, setDragging]     = useState(null)  // { id, offsetX, offsetY }
  const [connecting, setConnecting] = useState(null)  // id of source node
  const [zoom, setZoom]             = useState(1)
  const [pan, setPan]               = useState({ x: 20, y: 20 })
  const [saved, setSaved]           = useState(false)
  const canvasRef = useRef(null)
  const panRef    = useRef(null)

  useEffect(() => {
    api.listAgents().then(list => {
      const active = list.filter(a => a.active)
      setAgents(active)
      if (active.length) setSelectedAgent(active[0].id)
    }).catch(console.error)
  }, [])

  const node = nodes.find(n => n.id === selectedNode)

  function addNode(type) {
    const id = `node_${++nodeCounter}`
    setNodes(ns => [...ns, { id, type, x: 200 - pan.x / zoom, y: 200 - pan.y / zoom, label: NODE_TYPES[type].label, content: '' }])
    setSelectedNode(id)
  }

  function deleteNode(id) {
    if (id === 'start') return
    setNodes(ns => ns.filter(n => n.id !== id))
    setEdges(es => es.filter(e => e.from !== id && e.to !== id))
    if (selectedNode === id) setSelectedNode(null)
  }

  function updateNode(id, patch) {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n))
  }

  function handleCanvasMouseMove(e) {
    if (!dragging) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / zoom - dragging.offsetX
    const y = (e.clientY - rect.top  - pan.y) / zoom - dragging.offsetY
    updateNode(dragging.id, { x: Math.max(0, x), y: Math.max(0, y) })
  }

  function handleNodeMouseDown(e, id) {
    e.stopPropagation()
    if (connecting) {
      if (connecting !== id) {
        setEdges(es => {
          const exists = es.find(ed => ed.from === connecting && ed.to === id)
          return exists ? es : [...es, { from: connecting, to: id }]
        })
      }
      setConnecting(null)
      return
    }
    const nodeEl = e.currentTarget
    const rect   = nodeEl.getBoundingClientRect()
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const nodeX = (rect.left - canvasRect.left - pan.x) / zoom
    const nodeY = (rect.top  - canvasRect.top  - pan.y) / zoom
    const clickX = (e.clientX - canvasRect.left - pan.x) / zoom
    const clickY = (e.clientY - canvasRect.top  - pan.y) / zoom
    setDragging({ id, offsetX: clickX - nodeX, offsetY: clickY - nodeY })
    setSelectedNode(id)
  }

  function deleteEdge(from, to) {
    setEdges(es => es.filter(e => !(e.from === from && e.to === to)))
  }

  function exportFlow() {
    const data = JSON.stringify({ nodes, edges }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'flow.json'; a.click()
    URL.revokeObjectURL(url)
  }

  function importFlow(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const { nodes: n, edges: eg } = JSON.parse(ev.target.result)
        setNodes(n); setEdges(eg); setSaved(false)
      } catch { alert('Invalid flow file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Get center of a node for edge drawing
  function nodeCenter(id) {
    const n = nodes.find(x => x.id === id)
    if (!n) return { x: 0, y: 0 }
    return { x: n.x * zoom + pan.x + 80, y: n.y * zoom + pan.y + 28 }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#E8E5E2] bg-white shrink-0">
        <h1 className="text-base font-semibold text-[#1A1816]">Flow Builder</h1>
        <span className="text-[#D6D3D1]">|</span>

        {/* Agent selector */}
        <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
          className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-2.5 py-1.5 text-sm text-[#1A1816] focus:outline-none focus:border-[#2563EB]">
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <span className="text-[#D6D3D1]">|</span>

        {/* Add node buttons */}
        {Object.entries(NODE_TYPES).filter(([k]) => k !== 'start').map(([type, cfg]) => (
          <button key={type} onClick={() => addNode(type)}
            className={`text-sm px-2.5 py-1 rounded border ${cfg.color} transition-opacity hover:opacity-80`}>
            + {cfg.label}
          </button>
        ))}

        <span className="text-[#D6D3D1]">|</span>

        {connecting && (
          <span className="text-sm text-amber-400 animate-pulse">Click a node to connect → (or click here to cancel)</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Zoom */}
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="text-sm text-[#78716C] hover:text-[#1A1816] bg-[#FAFAF9] border border-[#E8E5E2] px-2 py-1 rounded">+</button>
          <span className="text-sm text-[#A8A29E]">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="text-sm text-[#78716C] hover:text-[#1A1816] bg-[#FAFAF9] border border-[#E8E5E2] px-2 py-1 rounded">−</button>

          <label className="text-sm text-[#78716C] hover:text-[#1A1816] cursor-pointer bg-[#FAFAF9] border border-[#E8E5E2] px-3 py-1 rounded transition-colors">
            Import
            <input type="file" accept=".json" className="hidden" onChange={importFlow} />
          </label>
          <button onClick={exportFlow} className="text-sm text-[#78716C] hover:text-[#1A1816] bg-[#FAFAF9] border border-[#E8E5E2] px-3 py-1 rounded transition-colors">
            Export
          </button>
          {saved && <span className="text-sm text-emerald-400">✓ Saved</span>}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-[#FAFAF9] cursor-default select-none"
          style={{ backgroundImage: 'radial-gradient(circle, #E8E5E2 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={() => setDragging(null)}
          onMouseLeave={() => setDragging(null)}
          onClick={() => { if (connecting) setConnecting(null); else setSelectedNode(null) }}
        >
          {/* SVG edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            {edges.map(e => {
              const from = nodeCenter(e.from)
              const to   = nodeCenter(e.to)
              const midY = (from.y + to.y) / 2
              return (
                <g key={`${e.from}-${e.to}`}>
                  <path
                    d={`M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`}
                    fill="none" stroke="#3730a3" strokeWidth="1.5"
                    markerEnd="url(#arrow)"
                    className="pointer-events-auto cursor-pointer hover:stroke-red-500 transition-colors"
                    onClick={ev => { ev.stopPropagation(); deleteEdge(e.from, e.to) }}
                  />
                </g>
              )
            })}
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#3730a3" />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {nodes.map(n => {
            const cfg = NODE_TYPES[n.type] || NODE_TYPES.speak
            return (
              <div
                key={n.id}
                onMouseDown={e => handleNodeMouseDown(e, n.id)}
                style={{ left: n.x * zoom + pan.x, top: n.y * zoom + pan.y, transform: `scale(${zoom})`, transformOrigin: 'top left', position: 'absolute', width: 160 }}
                className={`rounded-xl border-2 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-shadow ${cfg.color} ${
                  selectedNode === n.id ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-white shadow-lg shadow-blue-200/20' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold truncate">{n.label}</span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onMouseDown={e => { e.stopPropagation(); setConnecting(n.id) }}
                      className="text-[9px] opacity-60 hover:opacity-100 bg-[#F0EDEA] px-1 py-0.5 rounded"
                      title="Draw connection">→</button>
                    {n.id !== 'start' && (
                      <button
                        onMouseDown={e => { e.stopPropagation(); deleteNode(n.id) }}
                        className="text-[9px] text-red-400/70 hover:text-red-400 bg-[#F0EDEA] px-1 py-0.5 rounded"
                        title="Delete node">×</button>
                    )}
                  </div>
                </div>
                {n.content && <p className="text-[10px] opacity-70 mt-1 truncate">{n.content}</p>}
              </div>
            )
          })}
        </div>

        {/* Properties panel */}
        {node && (
          <div className="w-64 shrink-0 bg-white border-l border-[#E8E5E2] p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#1A1816]">Node Properties</h2>
              <button onClick={() => setSelectedNode(null)} className="text-[#A8A29E] hover:text-[#44403C] text-xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#78716C] mb-1.5">Label</label>
                <input value={node.label} onChange={e => updateNode(node.id, { label: e.target.value })}
                  className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm text-[#1A1816] focus:outline-none focus:border-[#2563EB]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#78716C] mb-1.5">Type</label>
                <select value={node.type} onChange={e => updateNode(node.id, { type: e.target.value })}
                  disabled={node.id === 'start'}
                  className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm text-[#1A1816] focus:outline-none focus:border-[#2563EB] disabled:opacity-50">
                  {Object.entries(NODE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#78716C] mb-1.5">
                  {node.type === 'speak' ? 'Script' :
                   node.type === 'branch' ? 'Conditions (one per line)' :
                   node.type === 'transfer' ? 'Transfer Number' :
                   node.type === 'webhook' ? 'Webhook URL' :
                   node.type === 'condition' ? 'Condition Expression' :
                   'Content'}
                </label>
                <textarea
                  value={node.content}
                  onChange={e => updateNode(node.id, { content: e.target.value })}
                  rows={5}
                  placeholder={
                    node.type === 'speak' ? 'What the agent says...' :
                    node.type === 'branch' ? 'intent=booking\nintent=support\ndefault' :
                    node.type === 'transfer' ? '+91XXXXXXXXXX' :
                    node.type === 'webhook' ? 'https://...' :
                    ''
                  }
                  className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB] resize-none"
                />
              </div>

              {node.type === 'speak' && (
                <div className="bg-[#FAFAF9] rounded-lg border border-[#E8E5E2] p-3">
                  <p className="text-[12px] text-[#A8A29E]">
                    The agent will speak this text. Use {'{variable}'} for dynamic substitution.
                  </p>
                </div>
              )}

              {node.type === 'branch' && (
                <div className="bg-[#FAFAF9] rounded-lg border border-[#E8E5E2] p-3">
                  <p className="text-[12px] text-[#A8A29E]">
                    Each line is a branch condition. Draw edges from this node to target nodes for each branch.
                  </p>
                </div>
              )}

              {node.id !== 'start' && (
                <button
                  onClick={() => deleteNode(node.id)}
                  className="w-full text-sm text-red-400/70 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 py-2 rounded-lg transition-colors">
                  Delete Node
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-6 py-2 border-t border-[#E8E5E2] bg-white shrink-0 flex items-center gap-4 text-[11px] text-[#A8A29E]">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} connections</span>
        <span>Drag nodes to move · Click → button to connect · Click edge to delete</span>
        {connecting && <span className="text-amber-400">Connecting from node — click target</span>}
      </div>
    </div>
  )
}
