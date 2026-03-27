import { useEffect, useState } from 'react'
import { adminApi } from '../api/client'

const CONFIG_SECTIONS = [
  {
    title: 'STT — Speech to Text',
    fields: [
      { key: 'deepgram_api_key',  label: 'Deepgram API Key',   secret: true,  placeholder: 'Token xxxx...',  hint: 'Nova-3 model. Used for all STT unless overridden per agent.' },
      { key: 'default_stt',       label: 'Default STT Model',  secret: false, placeholder: 'deepgram-nova-3', hint: 'deepgram-nova-3 | deepgram-nova-2 | google | azure' },
    ],
  },
  {
    title: 'LLM — Language Model',
    fields: [
      { key: 'openai_api_key',    label: 'OpenAI API Key',       secret: true,  placeholder: 'sk-...' },
      { key: 'default_llm',       label: 'Default LLM Model',    secret: false, placeholder: 'gpt-4o-mini',   hint: 'gpt-4o-mini | gpt-4o | gemini-flash-2 | claude-haiku-4-5-20251001' },
    ],
  },
  {
    title: 'TTS — Text to Speech',
    fields: [
      { key: 'sarvam_api_key',     label: 'Sarvam API Key',      secret: true,  placeholder: 'xxxx...', hint: 'India-optimised TTS. Sub-100ms latency, Hindi + Hinglish support.' },
      { key: 'elevenlabs_api_key', label: 'ElevenLabs API Key',  secret: true,  placeholder: 'sk_...' },
      { key: 'default_tts',        label: 'Default TTS Provider', secret: false, placeholder: 'openai-nova', hint: 'openai-nova | sarvam | elevenlabs | google-wavenet' },
    ],
  },
  {
    title: 'LiveKit',
    fields: [
      { key: 'livekit_url',        label: 'LiveKit URL',         secret: false, placeholder: 'wss://xxx.livekit.cloud' },
      { key: 'livekit_api_key',    label: 'API Key',             secret: true,  placeholder: 'APIxxxx' },
      { key: 'livekit_api_secret', label: 'API Secret',          secret: true,  placeholder: 'xxxx...' },
    ],
  },
  {
    title: 'Call Limits',
    fields: [
      { key: 'default_language',     label: 'Default Language',    secret: false, placeholder: 'en', hint: 'en | hi | multi' },
      { key: 'max_call_duration',    label: 'Max Call Duration (s)', secret: false, placeholder: '900' },
      { key: 'max_concurrent_calls', label: 'Max Concurrent Calls',  secret: false, placeholder: '50' },
    ],
  },
]

export default function PlatformConfigPage() {
  const [config, setConfig] = useState({})
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [revealed, setRevealed] = useState({})

  useEffect(() => {
    adminApi.listConfig().then(data => { setConfig(data); setLoading(false) }).catch(console.error)
  }, [])

  function set(key, value) {
    setEdits(e => ({ ...e, [key]: value }))
  }

  function get(key) {
    return key in edits ? edits[key] : (config[key] ?? '')
  }

  async function save() {
    if (!Object.keys(edits).length) return
    setSaving(true)
    try {
      await adminApi.updateConfig(edits)
      setConfig(c => ({ ...c, ...edits }))
      setEdits({})
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const hasChanges = Object.keys(edits).length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Platform Config</h1>
          <p className="text-base text-gray-500 mt-1">Provider API keys and global defaults.</p>
        </div>
        <button
          onClick={save}
          disabled={!hasChanges || saving}
          className={`px-4 py-2 rounded-xl text-base font-medium transition-colors ${
            saved
              ? 'bg-emerald-50 text-emerald-700'
              : hasChanges
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-200 hover:opacity-90'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div className="space-y-6">
        {CONFIG_SECTIONS.map(section => (
          <div key={section.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h2>
            <div className="space-y-4">
              {section.fields.map(field => (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-gray-500">{field.label}</label>
                    {field.key in edits && (
                      <span className="text-xs text-amber-600 font-medium">unsaved</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={field.secret && !revealed[field.key] ? 'password' : 'text'}
                      value={get(field.key)}
                      onChange={e => set(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full bg-gray-50 border border-gray-200 hover:border-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 rounded-xl px-3.5 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none transition-colors pr-10"
                    />
                    {field.secret && (
                      <button
                        type="button"
                        onClick={() => setRevealed(r => ({ ...r, [field.key]: !r[field.key] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {revealed[field.key] ? (
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {field.hint && <p className="text-sm text-gray-400 mt-1">{field.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
