import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function ApiKeysPage() {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState(null)   // freshly created key (show once)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    loadKeys()
  }, [])

  function loadKeys() {
    setLoading(true)
    api.listKeys()
      .then(k => setKeys(k || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  async function handleCreate() {
    if (!newName.trim() || creating) return
    setCreating(true)
    setError('')
    try {
      const result = await api.createKey(newName.trim())
      setNewKey(result)
      setNewName('')
      setShowCreate(false)
      loadKeys()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id) {
    if (deleting) return
    setDeleting(id)
    setError('')
    try {
      await api.deleteKey(id)
      setKeys(k => k.filter(x => x.id !== id))
      if (newKey?.id === id) setNewKey(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="flex-1 overflow-auto bg-[#FAFAF9]">
      <div className="px-8 py-8 max-w-[900px]">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[30px] font-bold text-[#1A1816] tracking-[-0.02em]">API Keys</h1>
            <p className="text-[16px] text-[#A8A29E] mt-0.5 font-medium">Manage keys for the Vani API</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setNewKey(null) }}
            className="press flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[16px] font-semibold px-5 py-2.5 rounded-[10px] shadow-sm shadow-blue-200 transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Key
          </button>
        </div>

        {/* New key banner */}
        {newKey?.key && (
          <div className="mb-6 bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#16A34A]/15 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-[#16A34A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#15803D] mb-1">Key created — copy it now</p>
                <p className="text-[13px] text-[#16A34A]/70 mb-3">This is the only time you will see the full key. Store it securely.</p>
                <div className="flex items-center gap-2 bg-white border border-[#BBF7D0] rounded-lg px-3 py-2">
                  <code className="flex-1 text-[14px] text-[#1A1816] font-mono truncate">{newKey.key}</code>
                  <button onClick={() => copyToClipboard(newKey.key)}
                    className="shrink-0 text-[13px] font-semibold text-[#15803D] bg-[#F0FDF4] hover:bg-[#DCFCE7] px-3 py-1 rounded-md transition-colors">
                    Copy
                  </button>
                </div>
              </div>
              <button onClick={() => setNewKey(null)} className="text-[#16A34A]/50 hover:text-[#15803D] transition-colors shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="mb-6 bg-white rounded-2xl border border-[#E8E5E2] p-5">
            <h3 className="text-[16px] font-bold text-[#1A1816] mb-3">New API Key</h3>
            <div className="flex gap-3">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                placeholder="Key name (e.g. Production, Staging)"
                className="flex-1 bg-[#FAFAF9] border border-[#E8E5E2] focus:border-[#2563EB] rounded-xl px-4 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none transition-colors"
                autoFocus
              />
              <button onClick={handleCreate} disabled={!newName.trim() || creating}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-base transition-colors">
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => { setShowCreate(false); setNewName('') }}
                className="text-[#78716C] hover:text-[#44403C] px-3 py-2.5 rounded-xl hover:bg-[#F5F5F4] transition-colors text-base">
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-[14px] px-4 py-2.5 rounded-xl">
            {error}
          </div>
        )}

        {/* Keys list */}
        <div className="bg-white rounded-2xl border border-[#E8E5E2] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDEA]">
            <h2 className="text-[16px] font-bold text-[#1A1816]">Your Keys</h2>
          </div>
          {loading ? (
            <div className="p-12 flex justify-center">
              <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : keys.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F5F4] flex items-center justify-center mx-auto mb-3 text-2xl">
                <svg className="w-6 h-6 text-[#A8A29E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              </div>
              <p className="text-[16px] text-[#78716C] font-medium">No API keys yet</p>
              <p className="text-[14px] text-[#A8A29E] mt-1">Create one to start using the Vani API</p>
            </div>
          ) : (
            <div>
              {keys.map((k, idx) => (
                <div key={k.id} className={`flex items-center gap-4 px-5 py-4 ${idx < keys.length - 1 ? 'border-b border-[#F5F5F4]' : ''}`}>
                  <div className="w-8 h-8 rounded-lg bg-[#EFF4FF] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-[#2563EB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] text-[#1A1816] font-semibold">{k.name}</p>
                    <p className="text-[14px] text-[#A8A29E] mt-0.5 font-mono">
                      {k.prefix ? `${k.prefix}...` : '••••••••'}
                      {k.created_at && <span className="font-sans ml-2">· Created {new Date(k.created_at).toLocaleDateString()}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(k.id)}
                    disabled={deleting === k.id}
                    className="text-[14px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                    {deleting === k.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
