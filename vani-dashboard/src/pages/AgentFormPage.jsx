import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

// ─── Provider Catalogue ────────────────────────────────────────────────────

const STT_PROVIDERS = [
  { id: 'deepgram-nova-3', name: 'Nova-3',        vendor: 'Deepgram', desc: 'Best accuracy, real-time streaming',   badge: 'Recommended', latency: '~200ms', cost: '$0.0043/min' },
  { id: 'deepgram-nova-2', name: 'Nova-2',        vendor: 'Deepgram', desc: 'Faster, slightly lower accuracy',      badge: null,          latency: '~150ms', cost: '$0.0043/min' },
  { id: 'sarvam-saaras',   name: 'Saaras v2',     vendor: 'Sarvam AI',desc: 'Best Hindi & Hinglish, lowest cost',   badge: 'India',       latency: '~250ms', cost: '$0.0012/min' },
  { id: 'openai-whisper',  name: 'Whisper',       vendor: 'OpenAI',   desc: 'Accurate, 50+ languages',             badge: null,          latency: '~500ms', cost: '$0.006/min' },
  { id: 'google',          name: 'Speech-to-Text',vendor: 'Google',   desc: 'Strong multilingual support',          badge: null,          latency: '~300ms', cost: '$0.006/min' },
  { id: 'azure',           name: 'Speech',        vendor: 'Azure',    desc: 'Enterprise-grade reliability',         badge: 'Enterprise',  latency: '~300ms', cost: '$0.006/min' },
]

const LLM_PROVIDERS = [
  { id: 'gpt-4o-mini',               name: 'GPT-4o Mini',      vendor: 'OpenAI',    desc: 'Fast, cost-efficient, reliable',    badge: 'Recommended', latency: '~300ms', cost: '$0.0002/min' },
  { id: 'gemini-3.0-flash',           name: 'Gemini 3.0 Flash', vendor: 'Google',    desc: 'Latest — fastest & smartest',       badge: 'Best Value',  latency: '~200ms', cost: '$0.0001/min' },
  { id: 'gemini-2.0-flash',           name: 'Gemini 2.0 Flash', vendor: 'Google',    desc: 'Balanced speed & quality',          badge: 'Fast',        latency: '~250ms', cost: '$0.0001/min' },
  { id: 'gemini-flash-lite',          name: 'Flash Lite',       vendor: 'Google',    desc: 'Ultra-fast, lowest cost',           badge: null,          latency: '~150ms', cost: '$0.00008/min' },
  { id: 'claude-haiku-4-5-20251001',  name: 'Claude Haiku',     vendor: 'Anthropic', desc: 'Nuanced instruction-following',     badge: null,          latency: '~400ms', cost: '$0.001/min' },
  { id: 'gpt-4o',                     name: 'GPT-4o',           vendor: 'OpenAI',    desc: 'Most capable, higher cost',         badge: 'Premium',     latency: '~500ms', cost: '$0.003/min' },
  { id: 'gpt-4o-mini-realtime',      name: 'GPT-4o Mini RT',   vendor: 'OpenAI',    desc: 'Speech-to-speech, low latency',     badge: 'Realtime',    latency: '~150ms', cost: '$0.06/min' },
  { id: 'gpt-4o-realtime',           name: 'GPT-4o Realtime',  vendor: 'OpenAI',    desc: 'Speech-to-speech, most capable',    badge: 'Realtime',    latency: '~150ms', cost: '$0.10/min' },
  { id: 'llama-3.3-70b',             name: 'Llama 3.3 70B',    vendor: 'Meta',      desc: 'Open-source, self-hostable',        badge: null,          latency: '~400ms', cost: '$0.0007/min' },
  { id: 'mistral-large',             name: 'Mistral Large',    vendor: 'Mistral',   desc: 'EU data-resident option',           badge: null,          latency: '~350ms', cost: '$0.0025/min' },
  { id: 'deepseek-chat',             name: 'DeepSeek Chat',    vendor: 'DeepSeek',  desc: 'Cost-effective, fast responses',    badge: null,          latency: '~300ms', cost: '$0.0002/min' },
]

const TTS_PROVIDERS = [
  { id: 'openai',         name: 'OpenAI',     vendor: 'OpenAI',    desc: '6 voices — warm, crisp, natural',  badge: 'Recommended', latency: '~300ms', cost: '$0.015/min' },
  { id: 'sarvam',         name: 'Sarvam',     vendor: 'Sarvam AI', desc: '39 Indian voices — Hi & En',       badge: 'India',       latency: '~400ms', cost: '$0.006/min' },
  { id: 'elevenlabs',     name: 'ElevenLabs', vendor: 'ElevenLabs',desc: 'Most expressive, ultra-realistic', badge: 'Expressive',  latency: '~400ms', cost: '$0.030/min' },
  { id: 'google-wavenet', name: 'WaveNet',    vendor: 'Google',    desc: 'Natural, multilingual support',    badge: null,          latency: '~350ms', cost: '$0.016/min' },
  { id: 'cartesia',       name: 'Cartesia',   vendor: 'Cartesia',  desc: 'Ultra-low latency synthesis',      badge: 'Speed',       latency: '~100ms', cost: '$0.015/min' },
]

const OPENAI_VOICES = [
  // Provider voices (OpenAI native)
  { id: 'openai-alloy',    name: 'Alloy',    accent: 'American', age: 'Young',       src: 'Provider' },
  { id: 'openai-ash',      name: 'Ash',      accent: 'American', age: 'Mid',         src: 'Provider' },
  { id: 'openai-ballad',   name: 'Ballad',   accent: 'American', age: 'Mid',         src: 'Provider' },
  { id: 'openai-cedar',    name: 'Cedar',    accent: 'American', age: 'Mid',         src: 'Provider' },
  { id: 'openai-coral',    name: 'Coral',    accent: 'American', age: 'Mid',         src: 'Provider' },
  { id: 'openai-echo',     name: 'Echo',     accent: 'American', age: 'Mid',         src: 'Provider' },
  { id: 'openai-fable',    name: 'Fable',    accent: 'British',  age: 'Young',       src: 'Provider' },
  { id: 'openai-marin',    name: 'Marin',    accent: 'American', age: 'Mid',         src: 'Provider' },
  { id: 'openai-nova',     name: 'Nova',     accent: 'American', age: 'Mature',      src: 'Provider' },
  { id: 'openai-onyx',     name: 'Onyx',     accent: 'American', age: 'Mid',         src: 'Provider' },
  { id: 'openai-sage',     name: 'Sage',     accent: 'American', age: 'Young',       src: 'Provider' },
  { id: 'openai-shimmer',  name: 'Shimmer',  accent: 'American', age: 'Mature',      src: 'Provider' },
  { id: 'openai-verse',    name: 'Verse',    accent: 'American', age: 'Mid',         src: 'Provider' },
]

const VOICE_STEPS = [
  { id: 'identity',  label: 'Identity',  desc: 'Name, persona & prompt' },
  { id: 'stack',     label: 'AI Stack',  desc: 'STT, LLM, TTS providers' },
  { id: 'behavior',  label: 'Behavior',  desc: 'Tone, objective, escalation' },
  { id: 'knowledge', label: 'Knowledge', desc: 'Documents & web pages' },
  { id: 'advanced',  label: 'Advanced',  desc: 'Extraction, goals & privacy' },
]

const CHATBOT_STEPS = [
  { id: 'identity',  label: 'Identity',  desc: 'Name, persona & prompt' },
  { id: 'llm',       label: 'AI Model',  desc: 'LLM provider' },
  { id: 'widget',    label: 'Widget',    desc: 'Appearance & embed code' },
  { id: 'behavior',  label: 'Behavior',  desc: 'Tone & objective' },
  { id: 'knowledge', label: 'Knowledge', desc: 'Documents & web pages' },
]

const EMPTY = {
  name: '', greeting: '', prompt: '', language: 'en',
  agent_type: 'voice',
  stt_provider: 'deepgram-nova-3',
  llm_provider: 'gpt-4o-mini',
  tts_provider: 'openai-nova',
  behavior: { tone: 'friendly', objective: 'support', fallback: '', constraints: [] },
  extraction_schema: [],
  success_criteria: '',
  custom_llm_url: '',
  custom_llm_model: '',
  pii_redaction: false,
  widget_config: { theme_color: '#6366f1', position: 'bottom-right', placeholder: 'Type a message...', powered_by: true },
  escalation_config: {
    enabled: false,
    transfer_number: '',
    trigger: 'user asks for human',
    whisper: '',
    cool_off_sec: 0,
    announce_transfer: true,
  },
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function AgentFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('identity')
  const [versions, setVersions] = useState([])
  const [showVersions, setShowVersions] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [widgetKey, setWidgetKey] = useState(null)

  useEffect(() => {
    if (isNew) return
    api.getAgent(id)
      .then(a => {
        setForm({
          ...EMPTY, ...a,
          behavior: { ...EMPTY.behavior, ...a.behavior },
          escalation_config: { ...EMPTY.escalation_config, ...(a.escalation_config || {}) },
          extraction_schema: a.extraction_schema || [],
          success_criteria: a.success_criteria || '',
          custom_llm_url: a.custom_llm_url || '',
          custom_llm_model: a.custom_llm_model || '',
          pii_redaction: a.pii_redaction ?? false,
          widget_config: { ...EMPTY.widget_config, ...(a.widget_config || {}) },
        })
        if (a.agent_type === 'chatbot') {
          api.getWidgetKey(id).then(r => setWidgetKey(r?.widget_key || null)).catch(() => {})
        }
      })
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
  const setWc = (key, val) => setForm(f => ({ ...f, widget_config: { ...f.widget_config, [key]: val } }))

  const STEPS = form.agent_type === 'chatbot' ? CHATBOT_STEPS : VOICE_STEPS

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      const payload = {
        name: form.name, greeting: form.greeting, prompt: form.prompt,
        language: form.language, voice: form.tts_provider,
        agent_type: form.agent_type,
        stack: { stt: form.stt_provider, llm: form.llm_provider, tts: form.tts_provider },
        behavior: form.behavior,
        extraction_schema: form.extraction_schema,
        success_criteria: form.success_criteria || null,
        custom_llm_url: form.custom_llm_url || null,
        custom_llm_model: form.custom_llm_model || null,
        pii_redaction: form.pii_redaction,
        escalation_config: form.escalation_config,
        widget_config: form.agent_type === 'chatbot' ? form.widget_config : null,
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

  if (loading) return <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">Loading…</div>

  const sttMeta = STT_PROVIDERS.find(p => p.id === form.stt_provider)
  const llmMeta = LLM_PROVIDERS.find(p => p.id === form.llm_provider)
  const ttsMeta = TTS_PROVIDERS.find(p => p.id === form.tts_provider || form.tts_provider?.startsWith(p.id + '-'))
  const stepIdx = STEPS.findIndex(s => s.id === step)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#1a1d2e] shrink-0 bg-[#080a12]">
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate('/agents')}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Agents
          </button>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-white font-medium">
            {isNew ? 'New Agent' : (form.name || 'Edit Agent')}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {!isNew && (
            <button type="button" onClick={() => setShowVersions(v => !v)}
              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-[#2a2d3a] hover:border-slate-500 transition-colors">
              {showVersions ? 'Hide History' : 'Version History'}
            </button>
          )}
          <button onClick={() => navigate('/agents')}
            className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-4 py-1.5 rounded-lg text-sm transition-colors">
            {saving ? 'Saving…' : isNew ? 'Create Agent' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ── */}
        <div className="w-52 shrink-0 border-r border-[#1a1d2e] flex flex-col overflow-y-auto bg-[#080a12]">
          <nav className="p-3 space-y-0.5 mt-2">
            {STEPS.map((s, i) => {
              const isActive = step === s.id
              const isBefore = i < stepIdx
              return (
                <button key={s.id} onClick={() => setStep(s.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-all group ${
                    isActive
                      ? 'bg-indigo-500/10 border border-indigo-500/20'
                      : 'border border-transparent hover:bg-white/4'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold transition-colors ${
                      isActive  ? 'bg-indigo-500 text-white' :
                      isBefore  ? 'bg-indigo-500/20 text-indigo-400' :
                                  'bg-[#1f2235] text-slate-600'
                    }`}>
                      {isBefore ? (
                        <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="2 6 5 9 10 3" />
                        </svg>
                      ) : i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-medium leading-tight ${isActive ? 'text-indigo-300' : 'text-slate-300 group-hover:text-slate-200'}`}>
                        {s.label}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">{s.desc}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </nav>

          {/* ── Pipeline mini preview ── */}
          <div className="mt-auto p-4 border-t border-[#1a1d2e] mx-3 mb-3">
            <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
              {form.agent_type === 'chatbot' ? 'Chat Pipeline' : 'Voice Pipeline'}
            </p>
            <div className="space-y-2">
              {(form.agent_type === 'chatbot'
                ? [{ label: 'LLM', meta: llmMeta, raw: form.llm_provider }]
                : [
                    { label: 'STT', meta: sttMeta, raw: form.stt_provider },
                    { label: 'LLM', meta: llmMeta, raw: form.llm_provider },
                    { label: 'TTS', meta: ttsMeta, raw: form.tts_provider },
                  ]
              ).map((item, i, arr) => (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-600 w-6 shrink-0">{item.label}</span>
                    <div className="flex-1 min-w-0 bg-[#0d0f1a] rounded-lg px-2 py-1.5">
                      <p className="text-[10px] text-slate-400 font-medium truncate leading-tight">
                        {item.meta?.name || item.raw}
                      </p>
                      {item.meta?.vendor && (
                        <p className="text-[9px] text-slate-600 leading-tight">{item.meta.vendor}</p>
                      )}
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="ml-3 w-px h-2 bg-[#2a2d3a] mt-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-8">

            {step === 'identity'  && <IdentityStep  form={form} set={set} isNew={isNew} />}
            {step === 'stack'     && <StackStep     form={form} set={set} />}
            {step === 'llm'       && <LLMOnlyStep   form={form} set={set} />}
            {step === 'widget'    && <WidgetStep     form={form} setWc={setWc} widgetKey={widgetKey} agentId={id} isNew={isNew} setWidgetKey={setWidgetKey} />}
            {step === 'behavior'  && <BehaviorStep  form={form} setBeh={setBeh} setEsc={setEsc} />}
            {step === 'knowledge' && (
              isNew
                ? <KnowledgeLocked />
                : <KnowledgeStep agentId={id} />
            )}
            {step === 'advanced'  && <AdvancedStep  form={form} set={set} />}

            {error && (
              <div className="mt-6 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* ── Step nav ── */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1a1d2e]">
              <button type="button"
                onClick={() => stepIdx > 0 && setStep(STEPS[stepIdx - 1].id)}
                disabled={stepIdx === 0}
                className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-4 py-2 rounded-lg hover:bg-white/5">
                ← Back
              </button>
              {stepIdx < STEPS.length - 1 ? (
                <button type="button"
                  onClick={() => setStep(STEPS[stepIdx + 1].id)}
                  className="flex items-center gap-2 bg-[#12141f] hover:bg-[#1a1d2e] border border-[#2a2d3a] text-slate-200 text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                  Next
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ) : (
                <button onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors">
                  {saving ? 'Saving…' : isNew ? 'Create Agent' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Version history drawer ── */}
      {showVersions && !isNew && (
        <div className="absolute inset-y-0 right-0 w-80 bg-[#0d0f18] border-l border-[#1f2235] flex flex-col z-20 shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2235]">
            <h2 className="text-sm font-semibold text-white">Version History</h2>
            <button onClick={() => setShowVersions(false)}
              className="text-slate-500 hover:text-slate-300 w-6 h-6 flex items-center justify-center rounded hover:bg-white/5">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {versions.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-8">No versions saved yet.</p>
            ) : versions.map(v => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-[#080a12] rounded-xl border border-[#1f2235]">
                <div>
                  <span className="text-xs text-slate-300 font-medium">v{v.version_num}</span>
                  {v.note && <span className="text-xs text-slate-500 ml-2">— {v.note}</span>}
                  <p className="text-[10px] text-slate-600 mt-0.5">{new Date(v.created_at).toLocaleString()}</p>
                </div>
                <button
                  disabled={restoring}
                  onClick={async () => {
                    if (!confirm('Restore this version?')) return
                    setRestoring(true)
                    try {
                      const r = await api.restoreAgentVersion(id, v.id)
                      setForm({
                        ...EMPTY, ...r,
                        behavior: { ...EMPTY.behavior, ...r.behavior },
                        escalation_config: { ...EMPTY.escalation_config, ...(r.escalation_config || {}) },
                        extraction_schema: r.extraction_schema || [],
                        success_criteria: r.success_criteria || '',
                        custom_llm_url: r.custom_llm_url || '',
                        custom_llm_model: r.custom_llm_model || '',
                      })
                      setShowVersions(false)
                    } catch (err) { setError(err.message) }
                    finally { setRestoring(false) }
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/20 hover:border-indigo-500/40 transition-colors disabled:opacity-50">
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step: Identity ────────────────────────────────────────────────────────

function IdentityStep({ form, set, isNew }) {
  return (
    <div className="space-y-6">
      <StepHeader
        title="Agent Identity"
        desc="Define who your agent is, what it says, and how it speaks."
      />

      <div className="space-y-5">
        {/* Agent Type Selector — only on new agents */}
        {isNew && (
          <FormField label="Agent Type" required>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'voice', label: 'Voice Agent', icon: '🎙️', desc: 'Phone calls — inbound & outbound' },
                { id: 'chatbot', label: 'Chatbot', icon: '💬', desc: 'Website widget — text chat' },
              ].map(t => (
                <button key={t.id} type="button" onClick={() => set('agent_type', t.id)}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                    form.agent_type === t.id
                      ? 'bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]'
                      : 'bg-[#0d0f18] border-[#2a2d3a] hover:border-[#3a3d4a]'
                  }`}>
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${form.agent_type === t.id ? 'text-indigo-300' : 'text-slate-300'}`}>
                      {t.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </FormField>
        )}

        <FormField label="Agent Name" required>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Hotel Receptionist, Sales Assistant"
            autoFocus
            className="w-full bg-[#0d0f18] border border-[#2a2d3a] hover:border-[#3a3d4a] focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors" />
        </FormField>

        <FormField label="Greeting" hint="First thing the agent says when a call connects">
          <input value={form.greeting} onChange={e => set('greeting', e.target.value)}
            placeholder="Welcome! How can I help you today?"
            className="w-full bg-[#0d0f18] border border-[#2a2d3a] hover:border-[#3a3d4a] focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors" />
        </FormField>

        <FormField label="System Prompt" hint="Full instructions for the agent's persona and behavior">
          <textarea value={form.prompt} onChange={e => set('prompt', e.target.value)}
            rows={8}
            placeholder={"You are a helpful hotel receptionist for The Grand Hotel.\n\nBe polite, professional, and assist guests with:\n- Check-in and check-out queries\n- Room availability and upgrades\n- Restaurant reservations\n- Directions and local recommendations\n\nIf a caller needs maintenance, transfer them to the facilities team."}
            className="w-full bg-[#0d0f18] border border-[#2a2d3a] hover:border-[#3a3d4a] focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors resize-none leading-relaxed" />
        </FormField>

        <FormField label="Language">
          <div className="flex gap-3">
            {[
              { id: 'en',    label: 'English',       sub: 'US / UK' },
              { id: 'hi',    label: 'Hindi',          sub: 'हिन्दी' },
              { id: 'multi', label: 'Multilingual',   sub: 'Auto-detect' },
            ].map(lang => (
              <button key={lang.id} type="button" onClick={() => set('language', lang.id)}
                className={`flex-1 py-3 px-4 rounded-xl border text-left transition-all ${
                  form.language === lang.id
                    ? 'bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]'
                    : 'bg-[#0d0f18] border-[#2a2d3a] hover:border-[#3a3d4a]'
                }`}>
                <p className={`text-xs font-semibold ${form.language === lang.id ? 'text-indigo-300' : 'text-slate-300'}`}>
                  {lang.label}
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5">{lang.sub}</p>
              </button>
            ))}
          </div>
        </FormField>
      </div>
    </div>
  )
}

// ─── Step: AI Stack ────────────────────────────────────────────────────────

function StackStep({ form, set }) {
  return (
    <div className="space-y-8">
      <StepHeader
        title="AI Stack"
        desc="Choose the providers for each stage of the voice pipeline."
      />

      {/* Pipeline diagram */}
      <div className="flex items-center gap-2 bg-[#0d0f18] border border-[#1f2235] rounded-2xl p-4">
        {[
          { label: 'Audio In',        type: 'io' },
          { label: null,              type: 'arrow' },
          { label: 'Speech-to-Text',  type: 'stage', color: 'blue' },
          { label: null,              type: 'arrow' },
          { label: 'Language Model',  type: 'stage', color: 'purple' },
          { label: null,              type: 'arrow' },
          { label: 'Voice Synthesis', type: 'stage', color: 'emerald' },
          { label: null,              type: 'arrow' },
          { label: 'Audio Out',       type: 'io' },
        ].map((item, i) => {
          if (item.type === 'arrow') return (
            <svg key={i} className="w-4 h-4 text-slate-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )
          if (item.type === 'io') return (
            <div key={i} className="text-[10px] text-slate-600 font-medium shrink-0">{item.label}</div>
          )
          const colors = {
            blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
            purple:  'bg-purple-500/10 border-purple-500/20 text-purple-400',
            emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          }
          return (
            <div key={i} className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border ${colors[item.color]}`}>
              {item.label}
            </div>
          )
        })}
      </div>

      {/* Total latency estimator */}
      <LatencyEstimator stt={form.stt_provider} llm={form.llm_provider} tts={form.tts_provider} />

      <ProviderSection
        title="Speech Recognition" stepTag="STT"
        subtitle="Transcribes caller audio to text in real-time"
        providers={STT_PROVIDERS}
        selected={form.stt_provider}
        onSelect={v => set('stt_provider', v)}
      />

      <PipelineConnector label="transcript passed to LLM" />

      <ProviderSection
        title="Language Model" stepTag="LLM"
        subtitle="Generates intelligent responses based on your agent prompt"
        providers={LLM_PROVIDERS}
        selected={form.llm_provider}
        onSelect={v => set('llm_provider', v)}
      />

      <PipelineConnector label="response synthesised to speech" />

      <ProviderSection
        title="Voice Synthesis" stepTag="TTS"
        subtitle="Converts LLM text responses into natural-sounding audio"
        providers={TTS_PROVIDERS}
        selected={form.tts_provider}
        onSelect={v => set('tts_provider', v)}
      />

      {/* OpenAI voice picker */}
      {(form.tts_provider === 'openai' || form.tts_provider?.startsWith('openai-')) && (
        <OpenAIVoicePicker
          selected={form.tts_provider?.startsWith('openai-') ? form.tts_provider : 'openai-nova'}
          onSelect={v => set('tts_provider', v)}
        />
      )}

      {/* Sarvam voice picker */}
      {(form.tts_provider === 'sarvam' || form.tts_provider?.startsWith('sarvam-')) && (
        <SarvamVoicePicker
          selected={form.tts_provider?.startsWith('sarvam-') ? form.tts_provider : 'sarvam-priya'}
          onSelect={v => set('tts_provider', v)}
        />
      )}
    </div>
  )
}

function PipelineConnector({ label }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-[#1f2235]" />
      <div className="flex items-center gap-1.5 text-[10px] text-slate-600 shrink-0">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {label}
      </div>
      <div className="flex-1 h-px bg-[#1f2235]" />
    </div>
  )
}

function ProviderSection({ title, stepTag, subtitle, providers, selected, onSelect }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1f2235] border border-[#2a2d3a] flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-slate-400 tracking-wider">{stepTag}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {providers.map(p => (
          <ProviderCard key={p.id} provider={p} isSelected={selected === p.id} onSelect={() => onSelect(p.id)} />
        ))}
      </div>
    </div>
  )
}

function LatencyEstimator({ stt, llm, tts }) {
  const getMs = (providers, id) => {
    const p = providers.find(x => id === x.id)
    if (!p?.latency) return 0
    const match = p.latency.match(/(\d+)/)
    return match ? parseInt(match[1]) : 0
  }
  const getCostPerMin = (providers, id) => {
    const p = providers.find(x => id === x.id)
    if (!p?.cost) return 0
    const match = p.cost.match(/\$([\d.]+)/)
    return match ? parseFloat(match[1]) : 0
  }

  const sttMs = getMs(STT_PROVIDERS, stt)
  const llmMs = getMs(LLM_PROVIDERS, llm)
  const ttsMs = getMs(TTS_PROVIDERS, tts)
  const total = sttMs + llmMs + ttsMs

  const sttCost = getCostPerMin(STT_PROVIDERS, stt)
  const llmCost = getCostPerMin(LLM_PROVIDERS, llm)
  const ttsCost = getCostPerMin(TTS_PROVIDERS, tts)
  const totalCostMin = sttCost + llmCost + ttsCost
  const totalCostHr = totalCostMin * 60

  if (!total) return null

  const rating = total <= 500 ? 'Excellent' : total <= 800 ? 'Good' : total <= 1200 ? 'Average' : 'Slow'
  const ratingColor = total <= 500 ? 'text-emerald-400' : total <= 800 ? 'text-emerald-400' : total <= 1200 ? 'text-amber-400' : 'text-red-400'
  const barColor = total <= 500 ? 'bg-emerald-500' : total <= 800 ? 'bg-emerald-500' : total <= 1200 ? 'bg-amber-500' : 'bg-red-500'
  const barWidth = Math.min(100, Math.max(10, (total / 2000) * 100))

  return (
    <div className="bg-[#0d0f18] border border-[#1f2235] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-300">Estimated Response Latency</p>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold font-mono ${ratingColor}`}>~{total}ms</span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
            total <= 800 ? 'bg-emerald-500/15 text-emerald-400' : total <= 1200 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
          }`}>{rating}</span>
        </div>
      </div>
      <div className="w-full h-1.5 bg-[#1f2235] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${barWidth}%` }} />
      </div>
      <div className="flex items-center justify-between text-[9px] text-slate-600 font-mono">
        <span>STT {sttMs}ms + LLM {llmMs}ms + TTS {ttsMs}ms</span>
        <span>Target: &lt;800ms</span>
      </div>

      {totalCostMin > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#1f2235]">
          <p className="text-[11px] font-semibold text-slate-300">Estimated AI Cost</p>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-sm font-bold font-mono text-white">${totalCostMin < 0.01 ? totalCostMin.toFixed(4) : totalCostMin.toFixed(3)}</span>
              <span className="text-[9px] text-slate-500 ml-1">/min</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold font-mono text-slate-400">${totalCostHr.toFixed(2)}</span>
              <span className="text-[9px] text-slate-500 ml-1">/hr</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProviderCard({ provider, isSelected, onSelect }) {
  return (
    <button type="button" onClick={onSelect}
      className={`relative text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? 'bg-indigo-500/8 border-indigo-500/35 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]'
          : 'bg-[#0d0f18] border-[#2a2d3a] hover:border-[#3a3d4a] hover:bg-[#10121c]'
      }`}>

      {provider.badge && (
        <span className={`absolute top-2.5 right-2.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
          isSelected
            ? 'bg-indigo-500/20 text-indigo-300'
            : 'bg-[#1f2235] text-slate-500'
        }`}>
          {provider.badge}
        </span>
      )}

      <p className={`text-xs font-semibold leading-tight mb-0.5 ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
        {provider.name}
      </p>
      <p className="text-[10px] text-slate-500 mb-1.5">{provider.vendor}</p>
      <p className="text-[10px] text-slate-600 leading-relaxed">{provider.desc}</p>

      {(provider.latency || provider.cost) && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#1f2235]">
          {provider.latency && (
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
              provider.latency.includes('100') || provider.latency.includes('150')
                ? 'bg-emerald-500/10 text-emerald-400'
                : provider.latency.includes('200') || provider.latency.includes('250') || provider.latency.includes('300')
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-red-500/10 text-red-400'
            }`}>
              {provider.latency}
            </span>
          )}
          {provider.cost && (
            <span className="text-[9px] font-mono text-slate-500">
              {provider.cost}
            </span>
          )}
        </div>
      )}

      {isSelected && (
        <div className="absolute bottom-2.5 right-2.5 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="2 6.5 4.5 9 10 3" />
          </svg>
        </div>
      )}
    </button>
  )
}

// ─── Step: Behavior ────────────────────────────────────────────────────────

function BehaviorStep({ form, setBeh, setEsc }) {
  return (
    <div className="space-y-6">
      <StepHeader title="Behavior" desc="Control how your agent acts, responds, and handles escalations." />

      {/* Tone + Objective */}
      <div className="bg-[#0d0f18] border border-[#1f2235] rounded-2xl p-5 space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-3">Tone</p>
            <div className="space-y-2">
              {[
                { id: 'friendly', label: 'Friendly',   sub: 'Warm, approachable' },
                { id: 'formal',   label: 'Formal',     sub: 'Professional, precise' },
                { id: 'sales',    label: 'Sales',      sub: 'Persuasive, goal-driven' },
              ].map(t => (
                <button key={t.id} type="button" onClick={() => setBeh('tone', t.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                    form.behavior.tone === t.id
                      ? 'bg-indigo-500/8 border-indigo-500/30 text-indigo-300'
                      : 'bg-[#080a12] border-[#2a2d3a] text-slate-400 hover:border-[#3a3d4a] hover:text-slate-300'
                  }`}>
                  <p className="text-xs font-medium">{t.label}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{t.sub}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-3">Objective</p>
            <div className="space-y-2">
              {[
                { id: 'support',  label: 'Support',    sub: 'Resolve issues' },
                { id: 'booking',  label: 'Booking',    sub: 'Schedule appointments' },
                { id: 'qualify',  label: 'Qualify',    sub: 'Score leads' },
                { id: 'info',     label: 'Info',       sub: 'Answer questions' },
              ].map(o => (
                <button key={o.id} type="button" onClick={() => setBeh('objective', o.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                    form.behavior.objective === o.id
                      ? 'bg-indigo-500/8 border-indigo-500/30 text-indigo-300'
                      : 'bg-[#080a12] border-[#2a2d3a] text-slate-400 hover:border-[#3a3d4a] hover:text-slate-300'
                  }`}>
                  <p className="text-xs font-medium">{o.label}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{o.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">
            Fallback Message
            <span className="text-slate-600 font-normal ml-1.5">— said when the agent can't help</span>
          </label>
          <input value={form.behavior.fallback || ''} onChange={e => setBeh('fallback', e.target.value)}
            placeholder="Let me transfer you to our team."
            className="w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors" />
        </div>
      </div>

      {/* Warm Transfer */}
      <div className="bg-[#0d0f18] border border-[#1f2235] rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Warm Transfer</p>
            <p className="text-xs text-slate-500 mt-0.5">Escalate to a human agent on trigger</p>
          </div>
          <Toggle value={form.escalation_config.enabled} onChange={v => setEsc('enabled', v)} />
        </div>

        {form.escalation_config.enabled && (
          <div className="mt-5 pt-5 border-t border-[#1f2235] space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Transfer Number" hint="E.164 format">
                <input value={form.escalation_config.transfer_number}
                  onChange={e => setEsc('transfer_number', e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  className={inputCls} />
              </FormField>
              <FormField label="Cool-off (seconds)">
                <input type="number" min="0" max="30"
                  value={form.escalation_config.cool_off_sec || 0}
                  onChange={e => setEsc('cool_off_sec', parseInt(e.target.value) || 0)}
                  className={inputCls} />
              </FormField>
            </div>
            <FormField label="Trigger Condition" hint="When should the agent escalate?">
              <input value={form.escalation_config.trigger}
                onChange={e => setEsc('trigger', e.target.value)}
                placeholder="user asks for human, manager, or support agent"
                className={inputCls} />
            </FormField>
            <FormField label="Whisper Message" hint="Heard only by the human agent, not the caller">
              <input value={form.escalation_config.whisper}
                onChange={e => setEsc('whisper', e.target.value)}
                placeholder="Incoming AI transfer. Caller needs human support."
                className={inputCls} />
            </FormField>
            <div className="flex items-center justify-between p-3 bg-[#080a12] rounded-lg border border-[#1f2235]">
              <div>
                <p className="text-xs font-medium text-slate-300">Announce Transfer</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Tell caller they're being transferred</p>
              </div>
              <Toggle value={form.escalation_config.announce_transfer} onChange={v => setEsc('announce_transfer', v)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step: Knowledge ───────────────────────────────────────────────────────

function KnowledgeLocked() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#12141f] border border-[#1f2235] flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-white">Create the agent first</p>
      <p className="text-xs text-slate-600 mt-2 max-w-xs">
        Upload documents, PDFs, and web pages after the agent is saved — they'll be available to the agent on every call.
      </p>
    </div>
  )
}

function KnowledgeStep({ agentId }) {
  const [docs, setDocs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [dragOver, setDragOver]   = useState(false)
  const [urlInput, setUrlInput]   = useState('')
  const [urlTitle, setUrlTitle]   = useState('')
  const [scrapingUrl, setScrapingUrl] = useState(false)
  const [showUrlForm, setShowUrlForm] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    api.listKb(agentId).then(setDocs).catch(console.error).finally(() => setLoading(false))
  }, [agentId])

  async function scrapeUrl(e) {
    e.preventDefault()
    if (!urlInput.trim()) return
    setError('')
    setScrapingUrl(true)
    try {
      const doc = await api.addKbUrl(agentId, urlInput.trim(), urlTitle.trim())
      setDocs(d => [doc, ...d])
      setUrlInput('')
      setUrlTitle('')
      setShowUrlForm(false)
    } catch (err) { setError(err.message) }
    finally { setScrapingUrl(false) }
  }

  async function upload(file) {
    if (!file) return
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!['.txt', '.pdf', '.md', '.csv'].includes(ext)) {
      setError('Unsupported type. Use: txt, pdf, md, csv')
      return
    }
    if (file.size > 5 * 1024 * 1024) { setError('File too large (max 5 MB)'); return }
    setError('')
    setUploading(true)
    try {
      const doc = await api.uploadKb(agentId, file)
      setDocs(d => [doc, ...d])
    } catch (err) { setError(err.message) }
    finally { setUploading(false) }
  }

  return (
    <div className="space-y-5">
      <StepHeader title="Knowledge Base" desc="Documents and web pages the agent can reference during calls." />

      <div className="flex gap-2">
        <button type="button" onClick={() => setShowUrlForm(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/8 border border-[#2a2d3a] px-3 py-2 rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Add URL
        </button>
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/8 hover:bg-indigo-500/15 border border-indigo-500/20 px-3 py-2 rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload File
        </button>
        <input ref={inputRef} type="file" accept=".txt,.pdf,.md,.csv" className="hidden"
          onChange={e => { upload(e.target.files[0]); e.target.value = '' }} />
      </div>

      {showUrlForm && (
        <form onSubmit={scrapeUrl} className="bg-[#0d0f18] rounded-xl border border-[#2a2d3a] p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-300">Scrape a web page</p>
          <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://example.com/faq"
            className="w-full bg-[#080a12] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          <input value={urlTitle} onChange={e => setUrlTitle(e.target.value)} placeholder="Title (optional)"
            className="w-full bg-[#080a12] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          <div className="flex gap-2">
            <button type="submit" disabled={!urlInput.trim() || scrapingUrl}
              className="flex items-center gap-1.5 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
              {scrapingUrl
                ? <><div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />Scraping…</>
                : 'Scrape & Add'}
            </button>
            <button type="button" onClick={() => setShowUrlForm(false)}
              className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-4 py-10 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-500 bg-indigo-500/5' : 'border-[#2a2d3a] hover:border-[#3a3d4a]'
        }`}>
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Uploading…
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500">Drop files here or <span className="text-indigo-400">browse</span></p>
            <p className="text-[10px] text-slate-700 mt-1">txt · pdf · md · csv · max 5 MB each</p>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

      {loading ? (
        <p className="text-xs text-slate-600 text-center py-6">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-slate-600 text-center py-6">No documents yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-start gap-3 bg-[#0d0f18] rounded-xl border border-[#1f2235] px-4 py-3">
              <svg className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">{doc.filename}</p>
                <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-2">{doc.content_preview}</p>
              </div>
              <button type="button"
                onClick={async () => {
                  if (!confirm('Remove this document?')) return
                  await api.deleteKbDoc(agentId, doc.id).catch(console.error)
                  setDocs(d => d.filter(x => x.id !== doc.id))
                }}
                className="text-xs text-red-400/50 hover:text-red-400 shrink-0 px-2 py-1 rounded hover:bg-red-500/10 transition-colors">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Step: Advanced ────────────────────────────────────────────────────────

function AdvancedStep({ form, set }) {
  const addField    = () => set('extraction_schema', [...form.extraction_schema, { field: '', type: 'text', description: '' }])
  const removeField = i  => set('extraction_schema', form.extraction_schema.filter((_, idx) => idx !== i))
  const setField    = (i, key, val) => set('extraction_schema',
    form.extraction_schema.map((fld, idx) => idx === i ? { ...fld, [key]: val } : fld)
  )

  return (
    <div className="space-y-6">
      <StepHeader title="Advanced" desc="Data extraction, call goals, privacy, and custom LLM endpoints." />

      {/* Custom LLM */}
      <div className="bg-[#0d0f18] border border-[#1f2235] rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-white">Custom LLM Endpoint</p>
          <p className="text-xs text-slate-500 mt-0.5">Override with any OpenAI-compatible endpoint (Ollama, vLLM, Together AI, etc.)</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Base URL" hint="e.g. http://localhost:11434/v1">
            <input value={form.custom_llm_url} onChange={e => set('custom_llm_url', e.target.value)}
              placeholder="https://api.together.ai/v1"
              className={inputCls} />
          </FormField>
          <FormField label="Model Name">
            <input value={form.custom_llm_model} onChange={e => set('custom_llm_model', e.target.value)}
              placeholder="meta-llama/Llama-3-70b"
              className={inputCls} />
          </FormField>
        </div>
        {form.custom_llm_url && (
          <p className="text-xs text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
            Custom endpoint is active — LLM Provider selection above will be ignored.
          </p>
        )}
      </div>

      {/* PII */}
      <div className="bg-[#0d0f18] border border-[#1f2235] rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="text-sm font-semibold text-white">PII Redaction</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically redact phone numbers, emails, and card numbers from transcripts.
            </p>
          </div>
          <Toggle value={form.pii_redaction} onChange={v => set('pii_redaction', v)} />
        </div>
      </div>

      {/* Extraction Schema */}
      <div className="bg-[#0d0f18] border border-[#1f2235] rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-white">Data Extraction Schema</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Fields extracted from each call by LLM post-processing. Saved to call metadata.
          </p>
        </div>
        {form.extraction_schema.length > 0 && (
          <div className="space-y-2">
            {form.extraction_schema.map((fld, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <input value={fld.field} onChange={e => setField(i, 'field', e.target.value)}
                    placeholder="field_name"
                    className="w-full bg-[#080a12] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
                </div>
                <div className="col-span-3">
                  <select value={fld.type} onChange={e => setField(i, 'type', e.target.value)}
                    className="w-full bg-[#080a12] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                    {['text', 'boolean', 'number', 'enum'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-4">
                  <input value={fld.description} onChange={e => setField(i, 'description', e.target.value)}
                    placeholder="description (optional)"
                    className="w-full bg-[#080a12] border border-[#2a2d3a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <button type="button" onClick={() => removeField(i)}
                    className="text-red-400/50 hover:text-red-400 text-lg leading-none transition-colors">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addField}
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          <span className="text-base leading-none">+</span> Add field
        </button>
      </div>

      {/* Call Goal */}
      <div className="bg-[#0d0f18] border border-[#1f2235] rounded-2xl p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Call Goal</p>
          <p className="text-xs text-slate-500 mt-0.5">
            LLM evaluates this after each call — result saved as <code className="text-indigo-400 text-[10px]">goal_achieved</code>.
          </p>
        </div>
        <textarea value={form.success_criteria} onChange={e => set('success_criteria', e.target.value)}
          rows={3}
          placeholder="The call is successful if the caller confirmed an appointment, agreed to a callback, or their issue was resolved."
          className="w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors resize-none" />
      </div>
    </div>
  )
}

// ─── Shared Primitives ─────────────────────────────────────────────────────

const inputCls = 'w-full bg-[#080a12] border border-[#2a2d3a] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors'

// ─── Step: LLM Only (Chatbot) ──────────────────────────────────────────────

// ─── Voice Preview ─────────────────────────────────────────────────────────

function VoicePreview({ voice, lang }) {
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef(null)

  async function handlePlay() {
    if (playing && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('vani_token')
      const langParam = lang ? `&lang=${lang}` : ''

      if (audioRef.current) {
        audioRef.current.pause()
      }
      const audio = new Audio()
      const resp = await fetch(api.ttsPreviewUrl(voice) + langParam, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error('Preview failed')
      const blob = await resp.blob()
      audio.src = URL.createObjectURL(blob)
      audioRef.current = audio
      audio.onended = () => setPlaying(false)
      audio.play()
      setPlaying(true)
    } catch (err) {
      console.error('TTS preview failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const voiceName = voice.startsWith('sarvam-')
    ? voice.replace('sarvam-', '').replace(/^\w/, c => c.toUpperCase())
    : voice === 'sarvam' ? 'Meera'
    : voice.replace('openai-', '').replace(/^\w/, c => c.toUpperCase())

  return (
    <div className="bg-[#0d0f18] border border-[#1f2235] rounded-xl p-4 flex items-center gap-4">
      <button onClick={handlePlay} disabled={loading}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
          playing
            ? 'bg-red-500/15 border border-red-500/30 text-red-400'
            : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/25'
        } disabled:opacity-50`}>
        {loading ? (
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        ) : playing ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        )}
      </button>
      <div>
        <p className="text-xs font-medium text-slate-300">Preview {voiceName} voice</p>
        <p className="text-[10px] text-slate-600 mt-0.5">Hear how your agent will sound on calls</p>
      </div>
    </div>
  )
}


// ─── OpenAI Voice Picker ──────────────────────────────────────────────────

function OpenAIVoicePicker({ selected, onSelect }) {
  return (
    <div className="bg-[#0d0f18] border border-[#1f2235] rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-400">Choose OpenAI Voice</p>
      <div className="grid grid-cols-4 gap-2">
        {OPENAI_VOICES.map(v => (
          <button key={v.id} type="button" onClick={() => onSelect(v.id)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              selected === v.id
                ? 'bg-indigo-500/10 border-indigo-500/40'
                : 'bg-[#080a12] border-[#2a2d3a] hover:border-[#3a3d4a]'
            }`}>
            <p className={`text-xs font-semibold ${selected === v.id ? 'text-indigo-300' : 'text-slate-300'}`}>{v.name}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{v.accent} · {v.age}</p>
          </button>
        ))}
      </div>
      <VoicePreview voice={selected} />
    </div>
  )
}


// ─── Sarvam Voice Picker ───────────────────────────────────────────────────

const SARVAM_VOICES = [
  // Female
  { id: 'sarvam-priya',    name: 'Priya',    gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-neha',     name: 'Neha',     gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-shreya',   name: 'Shreya',   gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-kavya',    name: 'Kavya',    gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-simran',   name: 'Simran',   gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-ritu',     name: 'Ritu',     gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-pooja',    name: 'Pooja',    gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-ishita',   name: 'Ishita',   gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-roopa',    name: 'Roopa',    gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-tanya',    name: 'Tanya',    gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-shruti',   name: 'Shruti',   gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-suhani',   name: 'Suhani',   gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-rupali',   name: 'Rupali',   gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-kavitha',  name: 'Kavitha',  gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-amelia',   name: 'Amelia',   gender: 'Female', lang: 'Hi · En' },
  { id: 'sarvam-sophia',   name: 'Sophia',   gender: 'Female', lang: 'Hi · En' },
  // Male
  { id: 'sarvam-rahul',    name: 'Rahul',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-amit',     name: 'Amit',     gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-dev',      name: 'Dev',      gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-rohan',    name: 'Rohan',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-kabir',    name: 'Kabir',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-aditya',   name: 'Aditya',   gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-ashutosh', name: 'Ashutosh', gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-ratan',    name: 'Ratan',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-varun',    name: 'Varun',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-manan',    name: 'Manan',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-sumit',    name: 'Sumit',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-aayan',    name: 'Aayan',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-shubh',    name: 'Shubh',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-advait',   name: 'Advait',   gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-anand',    name: 'Anand',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-tarun',    name: 'Tarun',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-sunny',    name: 'Sunny',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-mani',     name: 'Mani',     gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-gokul',    name: 'Gokul',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-vijay',    name: 'Vijay',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-mohit',    name: 'Mohit',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-rehan',    name: 'Rehan',    gender: 'Male',   lang: 'Hi · En' },
  { id: 'sarvam-soham',    name: 'Soham',    gender: 'Male',   lang: 'Hi · En' },
]

function SarvamVoicePicker({ selected, onSelect }) {
  const [previewLang, setPreviewLang] = useState('en')
  const [genderFilter, setGenderFilter] = useState('All')
  const filtered = genderFilter === 'All' ? SARVAM_VOICES : SARVAM_VOICES.filter(v => v.gender === genderFilter)
  return (
    <div className="bg-[#0d0f18] border border-[#1f2235] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">Choose Sarvam Voice</p>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-[#2a2d3a] overflow-hidden">
            {['All', 'Female', 'Male'].map(g => (
              <button key={g} type="button" onClick={() => setGenderFilter(g)}
                className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                  genderFilter === g
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'bg-[#080a12] text-slate-500 hover:text-slate-300'
                }`}>{g}</button>
            ))}
          </div>
          <div className="flex rounded-lg border border-[#2a2d3a] overflow-hidden">
            {[{ id: 'en', label: 'EN' }, { id: 'hi', label: 'हि' }].map(l => (
              <button key={l.id} type="button" onClick={() => setPreviewLang(l.id)}
                className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                  previewLang === l.id
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'bg-[#080a12] text-slate-500 hover:text-slate-300'
                }`}>{l.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
        {filtered.map(v => (
          <button key={v.id} type="button" onClick={() => onSelect(v.id)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              selected === v.id
                ? 'bg-indigo-500/10 border-indigo-500/40'
                : 'bg-[#080a12] border-[#2a2d3a] hover:border-[#3a3d4a]'
            }`}>
            <p className={`text-xs font-semibold ${selected === v.id ? 'text-indigo-300' : 'text-slate-300'}`}>{v.name}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{v.gender === 'Female' ? '♀' : '♂'}</p>
          </button>
        ))}
      </div>
      {/* Preview selected sarvam voice */}
      <VoicePreview voice={selected} lang={previewLang} />
    </div>
  )
}


function LLMOnlyStep({ form, set }) {
  return (
    <div className="space-y-6">
      <StepHeader
        title="AI Model"
        desc="Choose the language model that powers your chatbot."
      />
      <div className="space-y-3">
        {LLM_PROVIDERS.map(p => (
          <ProviderCard key={p.id} provider={p}
            isSelected={form.llm_provider === p.id}
            onSelect={() => set('llm_provider', p.id)}
          />
        ))}
      </div>
    </div>
  )
}


// ─── Step: Widget Config (Chatbot) ─────────────────────────────────────────

function WidgetStep({ form, setWc, widgetKey, agentId, isNew, setWidgetKey }) {
  const [copying, setCopying] = useState(false)
  const [generating, setGenerating] = useState(false)
  const wc = form.widget_config || {}

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await api.createWidgetKey(agentId)
      setWidgetKey(res.widget_key)
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  const embedCode = widgetKey
    ? `<script src="https://api.vani.live/widget/embed.js" data-widget-key="${widgetKey}"></script>`
    : null

  return (
    <div className="space-y-6">
      <StepHeader
        title="Chat Widget"
        desc="Customize appearance and get the embed code for your website."
      />

      <div className="space-y-5">
        <FormField label="Theme Color">
          <div className="flex items-center gap-3">
            <input type="color" value={wc.theme_color || '#6366f1'}
              onChange={e => setWc('theme_color', e.target.value)}
              className="w-10 h-10 rounded-lg border border-[#2a2d3a] bg-transparent cursor-pointer" />
            <input value={wc.theme_color || '#6366f1'}
              onChange={e => setWc('theme_color', e.target.value)}
              className="bg-[#0d0f18] border border-[#2a2d3a] rounded-lg px-3 py-2 text-sm text-white font-mono w-28 focus:outline-none focus:border-indigo-500" />
          </div>
        </FormField>

        <FormField label="Position">
          <div className="flex gap-3">
            {['bottom-right', 'bottom-left'].map(pos => (
              <button key={pos} type="button" onClick={() => setWc('position', pos)}
                className={`flex-1 py-3 px-4 rounded-xl border text-center text-xs font-medium transition-all ${
                  (wc.position || 'bottom-right') === pos
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                    : 'bg-[#0d0f18] border-[#2a2d3a] text-slate-400 hover:border-[#3a3d4a]'
                }`}>
                {pos === 'bottom-right' ? 'Bottom Right' : 'Bottom Left'}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Input Placeholder">
          <input value={wc.placeholder || 'Type a message...'}
            onChange={e => setWc('placeholder', e.target.value)}
            className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
        </FormField>

        <FormField label="Avatar URL" hint="Optional — shown in chat header">
          <input value={wc.avatar_url || ''}
            onChange={e => setWc('avatar_url', e.target.value)}
            placeholder="https://..."
            className="w-full bg-[#0d0f18] border border-[#2a2d3a] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
        </FormField>

        {/* Embed Code */}
        {!isNew && (
          <div className="bg-[#0d0f18] border border-[#1f2235] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300">Embed Code</p>
              {!widgetKey && (
                <button onClick={handleGenerate} disabled={generating}
                  className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {generating ? 'Generating...' : 'Generate Widget Key'}
                </button>
              )}
            </div>
            {widgetKey ? (
              <>
                <div className="bg-[#080a12] rounded-lg p-3 font-mono text-[11px] text-emerald-400 break-all select-all leading-relaxed">
                  {embedCode}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(embedCode); setCopying(true); setTimeout(() => setCopying(false), 2000) }}
                    className="text-xs text-slate-400 hover:text-white bg-white/5 border border-[#2a2d3a] px-3 py-1.5 rounded-lg transition-colors">
                    {copying ? 'Copied!' : 'Copy Code'}
                  </button>
                  <span className="text-[10px] text-slate-600">
                    Key: {widgetKey.slice(0, 16)}...
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-600">
                Save the agent first, then generate a widget key to get the embed code.
              </p>
            )}
          </div>
        )}

        {isNew && (
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400">
            Save the agent first — embed code will be available after creation.
          </div>
        )}
      </div>
    </div>
  )
}


function StepHeader({ title, desc }) {
  return (
    <div className="mb-2">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {desc && <p className="text-xs text-slate-500 mt-1">{desc}</p>}
    </div>
  )
}

function FormField({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-2">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-slate-600 font-normal ml-1.5">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-indigo-500' : 'bg-[#2a2d3a]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  )
}
