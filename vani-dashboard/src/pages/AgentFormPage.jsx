import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

const STT_OPTIONS = ['deepgram-nova-3', 'deepgram-nova-2', 'google', 'azure']
const LLM_OPTIONS = ['gpt-4o-mini', 'gemini-flash-lite', 'gemini-2.0-flash', 'claude-haiku-4-5-20251001', 'llama-3.3-70b', 'mistral-large', 'deepseek-chat']
const TTS_OPTIONS = ['openai-nova', 'openai-shimmer', 'openai-alloy', 'sarvam', 'elevenlabs', 'google-wavenet', 'cartesia']
const LANG_OPTIONS = ['en', 'hi', 'multi']
const TONE_OPTIONS = ['friendly', 'formal', 'sales']
const OBJ_OPTIONS  = ['support', 'booking', 'qualify', 'info']
const FIELD_TYPES  = ['text', 'boolean', 'number', 'enum']

const EMPTY = {
  name: '', greeting: '', prompt: '', language: 'en',
  voice: 'nova', stt_provider: 'deepgram-nova-3',
  llm_provider: 'gpt-4o-mini', tts_provider: 'openai-nova',
  behavior: { tone: 'friendly', objective: 'support', fallback: '', constraints: [] },
  extraction_schema: [],
  success_criteria: '',
  custom_llm_url: '',
  custom_llm_model: '',
  escalation_config: { enabled: false, transfer_number: '', trigger: 'user asks for human', whisper: '' },
}

export default function AgentFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [versions, setVersions] = useState([])
  const [showVersions, setShowVersions] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (isNew) return
    api.getAgent(id)
      .then(a => setForm({
        ...EMPTY, ...a,
        behavior: { ...EMPTY.behavior, ...a.behavior },
        escalation_config: { ...EMPTY.escalation_config, ...(a.escalation_config || {}) },
        extraction_schema: a.extraction_schema || [],
        success_criteria: a.success_criteria || '',
        custom_llm_url: a.custom_llm_url || '',
        custom_llm_model: a.custom_llm_model || '',
      }))
      .catch(() => navigate('/agents'))
      .finally(() => setLoading(false))
  }, [id, isNew, navigate])

  useEffect(() => {
    if (!isNew && showVersions) {
      api.listAgentVersions(id).then(setVersions).catch(console.error)
    }
  }, [id, isNew, showVersions])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setBeh = (key, val) => setForm(f => ({ ...f, behavior: { ...f.behavior, [key]: val } }))
  const setEsc = (key, val) => setForm(f => ({ ...f, escalation_config: { ...f.escalation_config, [key]: val } }))

  const addField = () => setForm(f => ({
    ...f,
    extraction_schema: [...f.extraction_schema, { field: '', type: 'text', description: '' }]
  }))
  const removeField = (i) => setForm(f => ({
    ...f, extraction_schema: f.extraction_schema.filter((_, idx) => idx !== i)
  }))
  const setField = (i, key, val) => setForm(f => ({
    ...f, extraction_schema: f.extraction_schema.map((fld, idx) => idx === i ? { ...fld, [key]: val } : fld)
  }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        name: form.name, greeting: form.greeting, prompt: form.prompt,
        language: form.language, voice: form.voice,
        stt_provider: form.stt_provider, llm_provider: form.llm_provider, tts_provider: form.tts_provider,
        behavior: form.behavior,
        extraction_schema: form.extraction_schema,
        success_criteria: form.success_criteria || null,
        custom_llm_url: form.custom_llm_url || null,
        custom_llm_model: form.custom_llm_model || null,
        escalation_config: form.escalation_config,
      }
      if (isNew) await api.createAgent(payload)
      else await api.updateAgent(id, payload)
      navigate('/agents')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function restoreVersion(versionId) {
    if (!confirm('Restore this version? Current config will be saved as a new version first.')) return
    setRestoring(true)
    try {
      const restored = await api.restoreAgentVersion(id, versionId)
      setForm({
        ...EMPTY, ...restored,
        behavior: { ...EMPTY.behavior, ...restored.behavior },
        escalation_config: { ...EMPTY.escalation_config, ...(restored.escalation_config || {}) },
        extraction_schema: restored.extraction_schema || [],
        success_criteria: restored.success_criteria || '',
        custom_llm_url: restored.custom_llm_url || '',
        custom_llm_model: restored.custom_llm_model || '',
      })
      setShowVersions(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setRestoring(false)
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-slate-600">Loading…</div>

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-3xl">
        <div className="flex items-center gap-3 mb-7">
          <button onClick={() => navigate('/agents')} className="text-slate-500 hover:text-slate-300 text-sm">
            ← Agents
          </button>
          <span className="text-slate-700">/</span>
          <h1 className="text-xl font-semibold text-white">{isNew ? 'New Agent' : `Edit: ${form.name}`}</h1>
          {!isNew && (
            <button
              type="button"
              onClick={() => setShowVersions(v => !v)}
              className="ml-auto text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-[#2a2d3a] hover:border-slate-500 transition-colors">
              {showVersions ? 'Hide History' : 'Version History'}
            </button>
          )}
        </div>

        {/* Version history panel */}
        {showVersions && (
          <div className="mb-6 bg-[#12141f] rounded-xl border border-[#1f2235] p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Version History</h2>
            {versions.length === 0 ? (
              <p className="text-xs text-slate-600">No versions saved yet. Versions are created automatically on each save.</p>
            ) : (
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-[#0d0f18] rounded-lg border border-[#1f2235]">
                    <div>
                      <span className="text-xs text-slate-300 font-medium">v{v.version_num}</span>
                      {v.note && <span className="text-xs text-slate-500 ml-2">— {v.note}</span>}
                      <p className="text-xs text-slate-600 mt-0.5">{new Date(v.created_at).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => restoreVersion(v.id)}
                      disabled={restoring}
                      className="text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded border border-indigo-500/20 hover:border-indigo-500/50 transition-colors disabled:opacity-50">
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic */}
          <Section title="Basic Info">
            <Field label="Agent Name" required>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Hotel Receptionist" required />
            </Field>
            <Field label="Greeting" hint="First thing the agent says">
              <Input value={form.greeting} onChange={e => set('greeting', e.target.value)} placeholder="Welcome! How can I help?" />
            </Field>
            <Field label="System Prompt" hint="Agent's instructions and persona">
              <textarea
                value={form.prompt}
                onChange={e => set('prompt', e.target.value)}
                rows={5}
                placeholder="You are a helpful hotel receptionist for The Grand Hotel. Be polite, professional..."
                className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </Field>
            <Field label="Language">
              <Select value={form.language} onChange={e => set('language', e.target.value)} options={LANG_OPTIONS} />
            </Field>
          </Section>

          {/* Stack */}
          <Section title="AI Stack">
            <div className="grid grid-cols-3 gap-4">
              <Field label="STT Provider">
                <Select value={form.stt_provider} onChange={e => set('stt_provider', e.target.value)} options={STT_OPTIONS} />
              </Field>
              <Field label="LLM Provider">
                <Select value={form.llm_provider} onChange={e => set('llm_provider', e.target.value)} options={LLM_OPTIONS} />
              </Field>
              <Field label="TTS Provider">
                <Select value={form.tts_provider} onChange={e => set('tts_provider', e.target.value)} options={TTS_OPTIONS} />
              </Field>
            </div>
            <div className="mt-3 p-3 bg-[#0d0f18] rounded-lg border border-[#1f2235]">
              <p className="text-xs text-slate-500">
                <span className="text-slate-400 font-medium">Stack:</span>{' '}
                {form.stt_provider} → {form.llm_provider} → {form.tts_provider}
              </p>
            </div>
          </Section>

          {/* Custom LLM */}
          <Section title="Custom LLM Endpoint">
            <p className="text-xs text-slate-500 -mt-2 mb-3">
              Override with any OpenAI-compatible endpoint (local Ollama, vLLM, Together AI, etc.)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Base URL" hint="e.g. http://localhost:11434/v1">
                <Input
                  value={form.custom_llm_url}
                  onChange={e => set('custom_llm_url', e.target.value)}
                  placeholder="https://api.together.ai/v1"
                />
              </Field>
              <Field label="Model Name">
                <Input
                  value={form.custom_llm_model}
                  onChange={e => set('custom_llm_model', e.target.value)}
                  placeholder="meta-llama/Llama-3-70b-chat-hf"
                />
              </Field>
            </div>
            {form.custom_llm_url && (
              <p className="text-xs text-amber-400 mt-2">
                Custom endpoint active — LLM Provider selection above is ignored.
              </p>
            )}
          </Section>

          {/* Behavior */}
          <Section title="Behavior">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tone">
                <Select value={form.behavior.tone} onChange={e => setBeh('tone', e.target.value)} options={TONE_OPTIONS} />
              </Field>
              <Field label="Objective">
                <Select value={form.behavior.objective} onChange={e => setBeh('objective', e.target.value)} options={OBJ_OPTIONS} />
              </Field>
            </div>
            <Field label="Fallback Message" hint="Said when agent can't help">
              <Input value={form.behavior.fallback || ''} onChange={e => setBeh('fallback', e.target.value)}
                placeholder="Let me transfer you to our team." />
            </Field>
          </Section>

          {/* Escalation */}
          <Section title="Escalation & Transfer">
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => setEsc('enabled', !form.escalation_config.enabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.escalation_config.enabled ? 'bg-indigo-500' : 'bg-[#2a2d3a]'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.escalation_config.enabled ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-xs text-slate-400">Enable warm transfer to human agent</span>
            </div>
            {form.escalation_config.enabled && (
              <div className="space-y-4">
                <Field label="Transfer Number" hint="Number to dial when user escalates">
                  <Input
                    value={form.escalation_config.transfer_number}
                    onChange={e => setEsc('transfer_number', e.target.value)}
                    placeholder="+91XXXXXXXXXX"
                  />
                </Field>
                <Field label="Trigger Phrase" hint="When to escalate">
                  <Input
                    value={form.escalation_config.trigger}
                    onChange={e => setEsc('trigger', e.target.value)}
                    placeholder="user asks for human or manager"
                  />
                </Field>
                <Field label="Whisper Message" hint="Played to human agent before connecting">
                  <Input
                    value={form.escalation_config.whisper}
                    onChange={e => setEsc('whisper', e.target.value)}
                    placeholder="Caller is being transferred from AI. Please assist."
                  />
                </Field>
              </div>
            )}
          </Section>

          {/* Extraction */}
          <Section title="Structured Data Extraction">
            <p className="text-xs text-slate-500 -mt-2 mb-3">
              Fields extracted from each call transcript by LLM post-processing. Saved to call metadata.
            </p>
            {form.extraction_schema.map((fld, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-4">
                  <input value={fld.field} onChange={e => setField(i, 'field', e.target.value)}
                    placeholder="field_name"
                    className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
                </div>
                <div className="col-span-3">
                  <select value={fld.type} onChange={e => setField(i, 'type', e.target.value)}
                    className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-4">
                  <input value={fld.description} onChange={e => setField(i, 'description', e.target.value)}
                    placeholder="description (optional)"
                    className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <button type="button" onClick={() => removeField(i)}
                    className="text-red-400 hover:text-red-300 text-lg leading-none">×</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addField}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 mt-1">
              <span className="text-base leading-none">+</span> Add field
            </button>
          </Section>

          {/* Call Goals */}
          <Section title="Call Goal / Success Criteria">
            <Field label="Success Criteria" hint="LLM evaluates this after each call — result saved as goal_achieved">
              <textarea
                value={form.success_criteria}
                onChange={e => set('success_criteria', e.target.value)}
                rows={2}
                placeholder="The call is successful if the caller confirmed an appointment, agreed to a callback, or their issue was resolved."
                className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </Field>
          </Section>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
              {saving ? 'Saving…' : isNew ? 'Create Agent' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => navigate('/agents')}
              className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-[#12141f] rounded-xl border border-[#1f2235] p-6">
      <h2 className="text-sm font-semibold text-white mb-5">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}
function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-slate-600 font-normal ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}
function Input(props) {
  return (
    <input {...props}
      className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
  )
}
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={onChange}
      className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
