import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function ApiKeysPage() {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => { loadKeys() }, [])

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
    if (!window.confirm('This will permanently revoke this API key. Any integrations using it will stop working immediately.')) return
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

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id || 'new')
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {})
  }

  return (
    <div className="flex-1 overflow-auto bg-[#FAFAF9]">
      <div className="px-8 py-8 max-w-[900px]">

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-[30px] font-bold text-[#1A1816] tracking-[-0.02em]">API Keys</h1>
            <p className="text-[15px] text-[#A8A29E] mt-0.5">Authenticate requests to the Vani API</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setNewKey(null) }}
            className="press flex items-center gap-2 bg-[#1A1816] hover:bg-[#000] text-white text-[14px] font-semibold px-4 py-2.5 rounded-xl transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Secret Key
          </button>
        </div>

        {/* Security notice */}
        <div className="flex items-center gap-2 mb-6 text-[13px] text-[#78716C]">
          <svg className="w-3.5 h-3.5 text-[#A8A29E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Keys are hashed and stored securely. The full key is shown only once at creation.
        </div>

        {/* New key banner — high security styling */}
        {newKey?.key && (
          <div className="mb-6 bg-[#0A0A0A] rounded-2xl p-6 border border-[#333]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#16A34A]/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#22C55E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-white mb-1">Save your secret key</p>
                <p className="text-[13px] text-[#888] mb-4">This key won't be shown again. Copy it now and store it in a secure location like a password manager or environment variable.</p>
                <div className="flex items-center gap-2 bg-[#111] border border-[#333] rounded-xl px-4 py-3">
                  <code className="flex-1 text-[13px] text-[#22C55E] font-mono tracking-wide truncate select-all">{newKey.key}</code>
                  <button onClick={() => copyToClipboard(newKey.key, 'new')}
                    className="shrink-0 text-[13px] font-semibold bg-white text-black hover:bg-[#E5E5E5] px-4 py-1.5 rounded-lg transition-colors">
                    {copiedId === 'new' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3 text-[12px] text-[#666]">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Do not share this key publicly or commit it to version control.
                </div>
              </div>
              <button onClick={() => setNewKey(null)} className="text-[#555] hover:text-white transition-colors shrink-0 mt-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        {showCreate && !newKey?.key && (
          <div className="mb-6 bg-white rounded-2xl border border-[#E8E5E2] p-5">
            <h3 className="text-[15px] font-bold text-[#1A1816] mb-1">Create new secret key</h3>
            <p className="text-[13px] text-[#A8A29E] mb-4">Give it a name to identify where it's used.</p>
            <div className="flex gap-3">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                placeholder="e.g. Production Backend, Staging, My App"
                className="flex-1 bg-[#FAFAF9] border border-[#E8E5E2] focus:border-[#1A1816] rounded-xl px-4 py-2.5 text-[14px] text-[#1A1816] placeholder-[#A8A29E] focus:outline-none transition-colors"
                autoFocus
              />
              <button onClick={handleCreate} disabled={!newName.trim() || creating}
                className="bg-[#1A1816] hover:bg-[#000] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-[14px] transition-colors">
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => { setShowCreate(false); setNewName('') }}
                className="text-[#78716C] hover:text-[#44403C] px-3 py-2.5 rounded-xl hover:bg-[#F5F5F4] transition-colors text-[14px]">
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-[13px] px-4 py-2.5 rounded-xl flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* Keys table */}
        <div className="bg-white rounded-2xl border border-[#E8E5E2] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EDEA] flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-[#1A1816]">Secret Keys</h2>
              <p className="text-[12px] text-[#A8A29E] mt-0.5">{keys.length} key{keys.length !== 1 ? 's' : ''} active</p>
            </div>
          </div>

          {/* Table header */}
          {keys.length > 0 && (
            <div className="grid grid-cols-[1fr_160px_140px_100px_80px] px-5 py-2.5 border-b border-[#F5F5F4] text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wider">
              <span>Name</span>
              <span>Key</span>
              <span>Created</span>
              <span>Last Used</span>
              <span></span>
            </div>
          )}

          {loading ? (
            <div className="p-12 flex justify-center">
              <div className="w-5 h-5 border-2 border-[#1A1816] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : keys.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F5F4] flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#A8A29E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              </div>
              <p className="text-[16px] text-[#44403C] font-semibold">No API keys yet</p>
              <p className="text-[14px] text-[#A8A29E] mt-1 max-w-[300px] mx-auto">Create a secret key to authenticate your API requests.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 text-[14px] font-semibold text-[#1A1816] bg-[#F5F5F4] hover:bg-[#E7E5E4] px-4 py-2 rounded-xl transition-colors">
                + Create your first key
              </button>
            </div>
          ) : (
            <div>
              {keys.map((k, idx) => (
                <div key={k.id} className={`grid grid-cols-[1fr_160px_140px_100px_80px] items-center px-5 py-3.5 ${idx < keys.length - 1 ? 'border-b border-[#F5F5F4]' : ''} hover:bg-[#FAFAF9] transition-colors`}>
                  {/* Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#F5F5F4] flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-[#78716C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                    </div>
                    <span className="text-[14px] text-[#1A1816] font-semibold truncate">{k.name}</span>
                  </div>

                  {/* Key preview */}
                  <span className="text-[13px] text-[#A8A29E] font-mono">vani_...{k.id?.slice(-4) || '••••'}</span>

                  {/* Created */}
                  <span className="text-[13px] text-[#78716C]">
                    {k.created_at ? new Date(k.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>

                  {/* Last used */}
                  <span className="text-[13px] text-[#A8A29E]">
                    {k.last_used && k.last_used !== 'None' ? new Date(k.last_used).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never'}
                  </span>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDelete(k.id)}
                      disabled={deleting === k.id}
                      className="text-[13px] font-medium text-[#A8A29E] hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
                      title="Revoke this key">
                      {deleting === k.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage hint */}
        <div className="mt-6 bg-[#F5F5F4] rounded-2xl border border-[#E8E5E2] p-5">
          <h3 className="text-[14px] font-bold text-[#1A1816] mb-2">Quick Start</h3>
          <div className="bg-[#1A1816] rounded-xl p-4 font-mono text-[13px] text-[#A8A29E] leading-relaxed overflow-x-auto">
            <span className="text-[#78716C]"># Make your first API call</span><br/>
            <span className="text-[#22C55E]">curl</span> https://api.vani.live/v1/agents \<br/>
            &nbsp;&nbsp;-H <span className="text-[#F59E0B]">"Authorization: Bearer vani_YOUR_KEY"</span>
          </div>
          <a href="https://api.vani.live/docs" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
            View API Documentation
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>

      </div>
    </div>
  )
}
