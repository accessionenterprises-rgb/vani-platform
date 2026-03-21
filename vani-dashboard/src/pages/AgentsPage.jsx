import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export default function AgentsPage() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listAgents()
      .then(setAgents)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id) {
    if (!confirm('Delete this agent?')) return
    await api.deleteAgent(id)
    setAgents(a => a.filter(x => x.id !== id))
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-5xl">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-semibold text-white">Agents</h1>
            <p className="text-sm text-slate-500 mt-0.5">Configure your voice AI agents</p>
          </div>
          <Link to="/agents/new"
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <span className="text-lg leading-none">+</span> New Agent
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-600">Loading…</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16 bg-[#12141f] rounded-xl border border-[#1f2235]">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/>
              </svg>
            </div>
            <p className="text-slate-400 font-medium mb-1">No agents yet</p>
            <p className="text-sm text-slate-600 mb-4">Create your first AI voice agent</p>
            <Link to="/agents/new"
              className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              + Create Agent
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {agents.map(agent => (
              <div key={agent.id}
                className="bg-[#12141f] rounded-xl border border-[#1f2235] p-5 flex items-center gap-4 hover:border-[#2a2d3a] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400 font-bold text-sm shrink-0">
                  {agent.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{agent.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${agent.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                      {agent.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{agent.greeting}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Chip>{agent.stt_provider}</Chip>
                    <Chip>{agent.llm_provider}</Chip>
                    <Chip>{agent.tts_provider}</Chip>
                    <Chip>{agent.language?.toUpperCase()}</Chip>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/agents/${agent.id}`}
                    className="text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors">
                    Edit
                  </Link>
                  <button onClick={() => handleDelete(agent.id)}
                    className="text-xs text-red-400/70 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ children }) {
  return (
    <span className="text-xs text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded font-mono">
      {children}
    </span>
  )
}
