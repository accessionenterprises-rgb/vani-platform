import { useState, useMemo, lazy, Suspense } from 'react'
import { useAgents, useDeleteAgent } from '../hooks/useAgents'
import { useDrawer, useTab } from '../hooks/useDrawer'
import TabBar from '../components/shared/TabBar'
import Badge from '../components/shared/Badge'
import EmptyState from '../components/shared/EmptyState'
import DrawerShell from '../components/modals/DrawerShell'

const AgentBuilderPage = lazy(() => import('./AgentBuilderPage'))
const TemplatesPage    = lazy(() => import('./TemplatesPage'))
const PlaygroundPage   = lazy(() => import('./PlaygroundPage'))

const PAGE_SIZE = 20

const TABS = [
  { key: 'list', label: 'List' },
  { key: 'builder', label: 'Builder' },
  { key: 'templates', label: 'Templates' },
  { key: 'playground', label: 'Playground' },
]

export default function AgentsPage() {
  const { data: agents = [], isLoading } = useAgents()
  const deleteAgent = useDeleteAgent()
  const { activeTab, setTab } = useTab('tab', 'list')
  const { isOpen, detailId, open, close } = useDrawer('detail')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() =>
    agents.filter(a => !search.trim() || a.name.toLowerCase().includes(search.toLowerCase())),
    [agents, search]
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const selectedAgent = agents.find(a => a.id === detailId)

  function handleDelete(id) {
    if (!confirm('Delete this agent?')) return
    deleteAgent.mutate(id)
    close()
  }

  return (
    <div className="w-full h-full px-6 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[26px] font-bold text-[#fafafa] tracking-[-0.02em]">Agents</h1>
          <p className="text-[13px] text-[#52525b] mt-0.5">Configure and manage your voice AI agents</p>
        </div>
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} active={activeTab} onChange={setTab} className="mb-5" />

      {/* Tab: List */}
      {activeTab === 'list' && (
        <>
          {/* Search bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <svg className="w-3.5 h-3.5 text-[#52525b] absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search agents..."
                className="input w-full pl-9"
              />
            </div>
            <span className="text-[12px] text-[#52525b]">{filtered.length} agent{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="glass p-8 flex justify-center">
              <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass w-full">
              {search ? (
                <EmptyState
                  title={`No results for "${search}"`}
                  description="Try a different name or clear the search"
                  action={() => setSearch('')}
                  actionLabel="Clear search"
                />
              ) : (
                <EmptyState
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><circle cx="8" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1" fill="currentColor" stroke="none"/></svg>}
                  title="No agents yet"
                  description="Build your first AI voice agent in minutes — no code required"
                  action={() => window.location.href = '/agents/build'}
                  actionLabel="Build an agent"
                />
              )}
            </div>
          ) : (
            <>
              {/* Agent cards */}
              <div className="space-y-2">
                {pageData.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => open(agent.id)}
                    className="w-full text-left glass glass-hover flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 ${
                      agent.active
                        ? 'bg-[rgba(139,92,246,0.12)] text-[#8b5cf6]'
                        : 'bg-[rgba(255,255,255,0.04)] text-[#52525b]'
                    }`}>
                      {agent.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-[#fafafa] truncate">{agent.name}</p>
                        <Badge status={agent.agent_type === 'chatbot' ? 'chatbot' : 'voice'} />
                      </div>
                      <p className="text-[11px] text-[#52525b] truncate mt-0.5">{agent.greeting || 'No greeting set'}</p>
                    </div>

                    {/* Provider chips */}
                    <div className="hidden md:flex items-center gap-1.5 shrink-0">
                      <Chip>{agent.llm_provider}</Chip>
                      {agent.agent_type !== 'chatbot' && agent.tts_provider && <Chip>{agent.tts_provider}</Chip>}
                      {agent.language && <Chip>{agent.language.toUpperCase()}</Chip>}
                    </div>

                    {/* Edit + Status */}
                    <a href={`/agents/${agent.id}`}
                      onClick={e => e.stopPropagation()}
                      className="text-[11px] text-[#52525b] hover:text-[#8b5cf6] transition-colors shrink-0">
                      Edit
                    </a>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${agent.active ? 'bg-[#8b5cf6]' : 'bg-[#52525b]'}`} />
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-[12px] text-[#52525b]">Page {page} of {totalPages}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn-ghost text-[12px] disabled:opacity-30"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="btn-ghost text-[12px] disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Tab: Builder */}
      {activeTab === 'builder' && (
        <div className="glass overflow-hidden" style={{ minHeight: 500 }}>
          <Suspense fallback={<div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" /></div>}>
            <AgentBuilderPage />
          </Suspense>
        </div>
      )}

      {/* Tab: Templates */}
      {activeTab === 'templates' && (
        <div className="glass overflow-hidden" style={{ minHeight: 400 }}>
          <Suspense fallback={<div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" /></div>}>
            <TemplatesPage />
          </Suspense>
        </div>
      )}

      {/* Tab: Playground */}
      {activeTab === 'playground' && (
        <div className="glass" style={{ minHeight: 500 }}>
          <Suspense fallback={<div className="flex justify-center py-16"><div className="w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" /></div>}>
            <PlaygroundPage />
          </Suspense>
        </div>
      )}

      {/* Agent Detail Drawer */}
      <DrawerShell
        isOpen={isOpen}
        onClose={close}
        title={selectedAgent?.name || 'Agent'}
        footer={
          selectedAgent && (
            <div className="flex items-center justify-between">
              <button onClick={() => handleDelete(selectedAgent.id)} className="btn-danger press">
                Delete
              </button>
              <a href={`/agents/${selectedAgent.id}`} className="btn-primary press">
                Edit Agent
              </a>
            </div>
          )
        }
      >
        {selectedAgent ? (
          <div className="space-y-5">
            {/* Status + type */}
            <div className="flex items-center gap-2">
              <Badge status={selectedAgent.active ? 'active' : 'inactive'} />
              <Badge status={selectedAgent.agent_type === 'chatbot' ? 'chatbot' : 'voice'} />
            </div>

            {/* Greeting */}
            <div>
              <label className="text-[11px] text-[#52525b] uppercase tracking-[0.06em] font-semibold">Greeting</label>
              <p className="text-[13px] text-[#a1a1aa] mt-1">{selectedAgent.greeting || '—'}</p>
            </div>

            {/* Providers */}
            <div>
              <label className="text-[11px] text-[#52525b] uppercase tracking-[0.06em] font-semibold">Providers</label>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {selectedAgent.stt_provider && <Chip>{selectedAgent.stt_provider}</Chip>}
                <Chip>{selectedAgent.llm_provider}</Chip>
                {selectedAgent.tts_provider && <Chip>{selectedAgent.tts_provider}</Chip>}
              </div>
            </div>

            {/* Language */}
            {selectedAgent.language && (
              <div>
                <label className="text-[11px] text-[#52525b] uppercase tracking-[0.06em] font-semibold">Language</label>
                <p className="text-[13px] text-[#a1a1aa] mt-1">{selectedAgent.language.toUpperCase()}</p>
              </div>
            )}

            {/* PII Redaction */}
            {selectedAgent.pii_redaction && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
                <span className="text-[12px] text-[#a1a1aa]">PII redaction enabled</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-8">
            <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </DrawerShell>
    </div>
  )
}

function Chip({ children }) {
  return (
    <span className="text-[11px] text-[#a1a1aa] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-2 py-0.5 rounded font-mono">
      {children}
    </span>
  )
}
