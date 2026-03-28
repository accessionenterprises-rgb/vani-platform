import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

const PAGE_SIZE = 20

export default function AgentsPage() {
  const [agents, setAgents]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)

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

  const filtered = agents.filter(a =>
    !search.trim() || a.name.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-5xl">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1816]">Agents</h1>
            <p className="text-base text-[#A8A29E] mt-0.5">Configure your voice AI agents</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-[#A8A29E] absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search agents…"
                className="pl-8 pr-3 py-1.5 bg-white border border-[#E8E5E2] rounded-lg text-sm text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB] w-44"
              />
            </div>
            <Link to="/agents/build"
              className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-base font-medium px-4 py-2 rounded-lg transition-colors">
              <span className="text-xl leading-none">+</span> New Agent
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-[#A8A29E]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-[#E8E5E2]">
            {search ? (
              <>
                <p className="text-[#78716C] font-medium mb-1">No agents match "{search}"</p>
                <button onClick={() => setSearch('')} className="text-sm text-[#2563EB] hover:text-[#3B82F6] mt-2">Clear search</button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-[#2563EB]/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-[#2563EB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="10" rx="2"/>
                    <circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/>
                  </svg>
                </div>
                <p className="text-[#78716C] font-medium mb-1">No agents yet</p>
                <p className="text-base text-[#A8A29E] mb-4">Create your first AI voice agent</p>
                <Link to="/agents/build"
                  className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-base font-medium px-4 py-2 rounded-lg transition-colors">
                  + Create Agent
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              {pageData.map(agent => (
                <div key={agent.id}
                  className="bg-white rounded-xl border border-[#E8E5E2] p-5 flex items-center gap-4 hover:border-[#E8E5E2] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-[#2563EB]/15 flex items-center justify-center text-[#2563EB] font-bold text-base shrink-0">
                    {agent.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-medium text-[#1A1816]">{agent.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        agent.agent_type === 'chatbot'
                          ? 'bg-cyan-500/15 text-cyan-400'
                          : 'bg-violet-500/15 text-violet-400'
                      }`}>
                        {agent.agent_type === 'chatbot' ? '💬 Chatbot' : '🎙️ Voice'}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${agent.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-[#78716C]'}`}>
                        {agent.active ? 'Active' : 'Inactive'}
                      </span>
                      {agent.pii_redaction && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">PII</span>
                      )}
                    </div>
                    <p className="text-sm text-[#A8A29E] mt-0.5 truncate">{agent.greeting}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {agent.agent_type !== 'chatbot' && (['gemini-live','gpt-4o-mini-realtime','gpt-4o-realtime'].includes(agent.tts_provider) ? (
                        <Chip accent="violet">Realtime: {agent.tts_provider}</Chip>
                      ) : (
                        <>
                          <Chip>{agent.stt_provider}</Chip>
                          <Chip>{agent.llm_provider}</Chip>
                          <Chip>{agent.tts_provider}</Chip>
                        </>
                      ))}
                      {agent.agent_type === 'chatbot' && <Chip>{agent.llm_provider}</Chip>}
                      <Chip>{agent.language?.toUpperCase()}</Chip>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/agents/${agent.id}`}
                      className="text-sm text-[#78716C] hover:text-[#1A1816] bg-[#F5F5F4] hover:bg-[#E8E5E2] px-3 py-1.5 rounded-lg transition-colors">
                      Edit
                    </Link>
                    <button onClick={() => handleDelete(agent.id)}
                      className="text-sm text-red-400/70 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-[#A8A29E]">{filtered.length} agents</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-sm text-[#78716C] hover:text-[#1A1816] bg-white border border-[#E8E5E2] rounded-lg disabled:opacity-40 transition-colors">
                    ← Prev
                  </button>
                  <span className="text-sm text-[#A8A29E]">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm text-[#78716C] hover:text-[#1A1816] bg-white border border-[#E8E5E2] rounded-lg disabled:opacity-40 transition-colors">
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Chip({ children, accent }) {
  const cls = accent === 'violet'
    ? 'text-sm text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded font-mono'
    : 'text-sm text-[#A8A29E] bg-[#F5F5F4] px-2 py-0.5 rounded font-mono'
  return <span className={cls}>{children}</span>
}
