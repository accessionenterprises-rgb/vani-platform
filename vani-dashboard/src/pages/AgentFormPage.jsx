import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

// ─── Provider Catalogue ────────────────────────────────────────────────────

const STT_PROVIDERS = [
  { id: 'deepgram-nova-3', name: 'Nova-3',        vendor: 'Deepgram', desc: 'Best accuracy, real-time streaming',   badge: 'Recommended', latency: '~200ms', cost: '$0.0017/min' },
  { id: 'deepgram-nova-2', name: 'Nova-2',        vendor: 'Deepgram', desc: 'Faster, slightly lower accuracy',      badge: null,          latency: '~150ms', cost: '$0.0014/min' },
  { id: 'sarvam-saaras',   name: 'Saaras v2',     vendor: 'Sarvam AI',desc: 'Best Hindi & Hinglish, lowest cost',   badge: 'India',       latency: '~250ms', cost: '$0.0048/min' },
  { id: 'openai-whisper',  name: 'Whisper',       vendor: 'OpenAI',   desc: 'Accurate, 50+ languages',             badge: null,          latency: '~500ms', cost: '$0.0024/min' },
  { id: 'google',          name: 'Speech-to-Text',vendor: 'Google',   desc: 'Strong multilingual support',          badge: null,          latency: '~300ms', cost: '$0.0064/min' },
  { id: 'azure',           name: 'Speech',        vendor: 'Azure',    desc: 'Enterprise-grade reliability',         badge: 'Enterprise',  latency: '~300ms', cost: '$0.0067/min' },
]

const LLM_PROVIDERS = [
  // OpenAI — GPT-5 family
  { id: 'gpt-5-nano',                name: 'GPT-5 Nano',       vendor: 'OpenAI',    desc: 'Cheapest GPT-5, ultra-fast',        badge: 'Speed',       latency: '~150ms', cost: '$0.0007/min' },
  { id: 'gpt-5-mini',                name: 'GPT-5 Mini',       vendor: 'OpenAI',    desc: 'Balanced speed & intelligence',     badge: 'Best Value',  latency: '~250ms', cost: '$0.0037/min' },
  { id: 'gpt-5',                     name: 'GPT-5',            vendor: 'OpenAI',    desc: 'Highly capable, strong reasoning',  badge: null,          latency: '~400ms', cost: '$0.0185/min' },
  { id: 'gpt-5.4',                   name: 'GPT-5.4',          vendor: 'OpenAI',    desc: 'Latest — most intelligent',         badge: 'Premium',     latency: '~500ms', cost: '$0.0327/min' },
  // OpenAI — GPT-4 family
  { id: 'gpt-4.1-nano',              name: 'GPT-4.1 Nano',     vendor: 'OpenAI',    desc: 'Legacy fast, ultra-low cost',       badge: null,          latency: '~200ms', cost: '$0.0011/min' },
  { id: 'gpt-4o-mini',               name: 'GPT-4o Mini',      vendor: 'OpenAI',    desc: 'Legacy fast, cost-efficient',       badge: 'Recommended', latency: '~300ms', cost: '$0.0017/min' },
  { id: 'gpt-4.1-mini',              name: 'GPT-4.1 Mini',     vendor: 'OpenAI',    desc: 'Legacy — smarter than 4o-mini',     badge: null,          latency: '~280ms', cost: '$0.0046/min' },
  { id: 'gpt-4.1',                   name: 'GPT-4.1',          vendor: 'OpenAI',    desc: 'Legacy — coding & reasoning',       badge: null,          latency: '~400ms', cost: '$0.0216/min' },
  // Google
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', vendor: 'Google', desc: 'Fastest from India — 635ms',    badge: 'Fastest',     latency: '~635ms', cost: '$0.0008/min' },
  { id: 'gemini-3-flash-preview',    name: 'Gemini 3.0 Flash', vendor: 'Google',    desc: 'Latest gen — fast + smart',         badge: 'New',         latency: '~728ms', cost: '$0.0012/min' },
  { id: 'gemini-3.1-pro-preview',    name: 'Gemini 3.1 Pro',   vendor: 'Google',    desc: 'Best quality, still fast',          badge: 'Premium',     latency: '~649ms', cost: '$0.0025/min' },
  { id: 'gemini-2.5-flash',          name: 'Gemini 2.5 Flash', vendor: 'Google',    desc: 'Stable — thinking + fast',          badge: null,          latency: '~852ms', cost: '$0.0017/min' },
  { id: 'gemini-2.5-flash-lite',     name: 'Gemini 2.5 Flash Lite', vendor: 'Google', desc: 'Ultra-fast, cheapest',            badge: null,          latency: '~761ms', cost: '$0.0008/min' },
  { id: 'gemini-2.0-flash',          name: 'Gemini 2.0 Flash', vendor: 'Google',    desc: 'Balanced speed & quality',          badge: null,          latency: '~562ms', cost: '$0.0011/min' },
  // Anthropic
  { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku', vendor: 'Anthropic', desc: 'Fast, nuanced, instruction-following', badge: null,       latency: '~400ms', cost: '$0.0098/min' },
  { id: 'claude-sonnet-4-20250514',  name: 'Claude 4 Sonnet',  vendor: 'Anthropic', desc: 'Best reasoning, highest quality',   badge: 'Premium',     latency: '~600ms', cost: '$0.0369/min' },
  // Realtime (Speech-to-Speech)
  { id: 'gpt-4o-mini-realtime',      name: 'GPT-4o Mini RT',   vendor: 'OpenAI',    desc: 'Speech-to-speech, replaces STT+TTS',badge: 'Realtime',   latency: '~150ms', cost: '$0.096/min' },
  { id: 'gpt-4o-realtime',           name: 'GPT-4o Realtime',  vendor: 'OpenAI',    desc: 'Speech-to-speech, most capable',    badge: 'Realtime',    latency: '~150ms', cost: '$0.39/min' },
  // Open Source / Other
  { id: 'llama-3.3-70b',             name: 'Llama 3.3 70B',    vendor: 'Groq',      desc: 'Open-source via Groq — ultra-fast', badge: 'Fast',       latency: '~200ms', cost: '$0.0054/min' },
  { id: 'deepseek-chat',             name: 'DeepSeek V3',      vendor: 'DeepSeek',  desc: 'Cost-effective, strong reasoning',  badge: null,          latency: '~300ms', cost: '$0.0031/min' },
  { id: 'mistral-large',             name: 'Mistral Large',    vendor: 'Mistral',   desc: 'EU data-resident option',           badge: null,          latency: '~350ms', cost: '$0.0211/min' },
]

const TTS_PROVIDERS = [
  // Cheapest
  { id: 'google-standard', name: 'Google Standard', vendor: 'Google',   desc: 'Cheapest — basic quality',          badge: 'Cheapest',    latency: '~300ms', cost: '₹0.18/min' },
  { id: 'google-wavenet',  name: 'Google WaveNet',  vendor: 'Google',   desc: 'Natural, multilingual',             badge: null,          latency: '~350ms', cost: '₹0.74/min' },
  { id: 'google-neural2',  name: 'Google Neural2',  vendor: 'Google',   desc: 'Best Google voice quality',         badge: null,          latency: '~400ms', cost: '₹0.74/min' },
  { id: 'amazon-standard', name: 'Amazon Polly',    vendor: 'AWS',      desc: 'Cheapest — Mumbai servers',         badge: 'Cheapest',    latency: '~400ms', cost: '₹0.18/min' },
  { id: 'amazon-neural',   name: 'Amazon Neural',   vendor: 'AWS',      desc: 'High quality — Mumbai servers',     badge: 'India',       latency: '~500ms', cost: '₹0.74/min' },
  { id: 'azure-neural',    name: 'Azure Speech',    vendor: 'Microsoft',desc: 'Premium quality — Chennai servers', badge: null,          latency: '~350ms', cost: '₹0.74/min' },
  // Mid-range
  { id: 'openai',          name: 'OpenAI',          vendor: 'OpenAI',   desc: '13 voices — warm, natural',         badge: 'Recommended', latency: '~300ms', cost: '₹0.70/min' },
  { id: 'sarvam',          name: 'Sarvam v2',       vendor: 'Sarvam AI',desc: '7 Indian voices — Hi & En',         badge: 'India',       latency: '~400ms', cost: '₹0.83/min' },
  { id: 'sarvam-v3',       name: 'Sarvam v3',       vendor: 'Sarvam AI',desc: '46 voices — Shreya, Amelia & more', badge: 'India',       latency: '~500ms', cost: '₹1.65/min' },
  // Premium
  { id: 'cartesia',        name: 'Cartesia',        vendor: 'Cartesia', desc: 'Best quality — Brooke voice',       badge: 'Premium',     latency: '~500ms', cost: '₹3.00/min' },
  { id: 'elevenlabs',      name: 'ElevenLabs',      vendor: 'ElevenLabs',desc: 'Most expressive, voice cloning',   badge: 'Premium',     latency: '~400ms', cost: '₹4.07/min' },
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

const CARTESIA_VOICES = [
  { id: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', name: 'Blake',      desc: 'Helpful Agent',       gender: 'M', accent: 'American' },
  { id: 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', name: 'Brooke',     desc: 'Big Sister',          gender: 'F', accent: 'American' },
  { id: 'f9836c6e-a0bd-460e-9d3c-f7299fa60f94', name: 'Caroline',   desc: 'Southern Guide',      gender: 'F', accent: 'American' },
  { id: 'e8e5fffb-252c-436d-b842-8879b84445b6', name: 'Cathy',      desc: 'Coworker',            gender: 'F', accent: 'American' },
  { id: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', name: 'Jacqueline', desc: 'Reassuring Agent',    gender: 'F', accent: 'American' },
  { id: 'f786b574-daa5-4673-aa0c-cbe3e8534c02', name: 'Katie',      desc: 'Friendly Fixer',      gender: 'F', accent: 'American' },
  { id: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', name: 'Ronald',     desc: 'Thinker',             gender: 'M', accent: 'American' },
  { id: '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e', name: 'Theo',       desc: 'Modern Narrator',     gender: 'M', accent: 'American' },
]

const ELEVENLABS_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',    desc: 'Mature, Reassuring, Confident', gender: 'F', accent: 'American' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica',  desc: 'Playful, Bright, Warm',         gender: 'F', accent: 'American' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',    desc: 'Clear, Engaging Educator',      gender: 'F', accent: 'British' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda',  desc: 'Knowledgeable, Professional',   gender: 'F', accent: 'American' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',     desc: 'Velvety Actress',               gender: 'F', accent: 'British' },
  { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella',    desc: 'Professional, Bright, Warm',    gender: 'F', accent: 'American' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura',    desc: 'Enthusiast, Quirky Attitude',   gender: 'F', accent: 'American' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger',    desc: 'Laid-Back, Casual, Resonant',   gender: 'M', accent: 'American' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie',  desc: 'Deep, Confident, Energetic',    gender: 'M', accent: 'Australian' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George',   desc: 'Warm, Captivating Storyteller', gender: 'M', accent: 'British' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum',   desc: 'Husky Trickster',               gender: 'M', accent: 'American' },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River',    desc: 'Relaxed, Neutral, Informative', gender: 'N', accent: 'American' },
  { id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry',    desc: 'Fierce Warrior',                gender: 'M', accent: 'British' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',     desc: 'Energetic, Social Media',       gender: 'M', accent: 'American' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will',     desc: 'Relaxed Optimist',              gender: 'M', accent: 'American' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric',     desc: 'Smooth, Trustworthy',           gender: 'M', accent: 'American' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris',    desc: 'Charming, Down-to-Earth',       gender: 'M', accent: 'American' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian',    desc: 'Deep, Resonant, Comforting',    gender: 'M', accent: 'American' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',   desc: 'Steady Broadcaster',            gender: 'M', accent: 'British' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',     desc: 'Dominant, Firm',                gender: 'M', accent: 'American' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill',     desc: 'Wise, Mature, Balanced',        gender: 'M', accent: 'American' },
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

  if (loading) return <div className="flex-1 flex items-center justify-center text-[#A8A29E] text-base">Loading…</div>

  const sttMeta = STT_PROVIDERS.find(p => p.id === form.stt_provider)
  const llmMeta = LLM_PROVIDERS.find(p => p.id === form.llm_provider)
  const ttsMeta = TTS_PROVIDERS.find(p => p.id === form.tts_provider || form.tts_provider?.startsWith(p.id + '-'))
  const stepIdx = STEPS.findIndex(s => s.id === step)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#E8E5E2] shrink-0 bg-[#FAFAF9]">
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate('/agents')}
            className="text-[#A8A29E] hover:text-[#44403C] text-base transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Agents
          </button>
          <span className="text-[#D6D3D1]">/</span>
          <span className="text-base text-[#1A1816] font-medium">
            {isNew ? 'New Agent' : (form.name || 'Edit Agent')}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {!isNew && (
            <button type="button" onClick={() => setShowVersions(v => !v)}
              className="text-sm text-[#78716C] hover:text-[#44403C] px-3 py-1.5 rounded-lg border border-[#E8E5E2] hover:border-slate-500 transition-colors">
              {showVersions ? 'Hide History' : 'Version History'}
            </button>
          )}
          <button onClick={() => navigate('/agents')}
            className="text-base text-[#78716C] hover:text-[#44403C] px-3 py-1.5 rounded-lg hover:bg-[#F5F5F4] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-4 py-1.5 rounded-lg text-base transition-colors">
            {saving ? 'Saving…' : isNew ? 'Create Agent' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ── */}
        <div className="w-52 shrink-0 border-r border-[#E8E5E2] flex flex-col overflow-y-auto bg-[#FAFAF9]">
          <nav className="p-3 space-y-0.5 mt-2">
            {STEPS.map((s, i) => {
              const isActive = step === s.id
              const isBefore = i < stepIdx
              return (
                <button key={s.id} onClick={() => setStep(s.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-all group ${
                    isActive
                      ? 'bg-[#2563EB]/10 border border-indigo-500/20'
                      : 'border border-transparent hover:bg-[#F5F5F4]'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold transition-colors ${
                      isActive  ? 'bg-[#2563EB] text-white' :
                      isBefore  ? 'bg-[#2563EB]/20 text-[#2563EB]' :
                                  'bg-[#F5F5F4] text-[#A8A29E]'
                    }`}>
                      {isBefore ? (
                        <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="2 6 5 9 10 3" />
                        </svg>
                      ) : i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium leading-tight ${isActive ? 'text-[#3B82F6]' : 'text-[#44403C] group-hover:text-[#44403C]'}`}>
                        {s.label}
                      </p>
                      <p className="text-[12px] text-[#A8A29E] mt-0.5 leading-tight">{s.desc}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </nav>

          {/* ── Pipeline mini preview ── */}
          <div className="mt-auto p-4 border-t border-[#E8E5E2] mx-3 mb-3">
            <p className="text-[9px] font-semibold text-[#A8A29E] uppercase tracking-widest mb-3">
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
                    <span className="text-[9px] font-mono text-[#A8A29E] w-6 shrink-0">{item.label}</span>
                    <div className="flex-1 min-w-0 bg-white rounded-lg px-2 py-1.5">
                      <p className="text-[12px] text-[#78716C] font-medium truncate leading-tight">
                        {item.meta?.name || item.raw}
                      </p>
                      {item.meta?.vendor && (
                        <p className="text-[9px] text-[#A8A29E] leading-tight">{item.meta.vendor}</p>
                      )}
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="ml-3 w-px h-2 bg-[#F5F5F4] mt-1" />
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
              <div className="mt-6 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* ── Step nav ── */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E8E5E2]">
              <button type="button"
                onClick={() => stepIdx > 0 && setStep(STEPS[stepIdx - 1].id)}
                disabled={stepIdx === 0}
                className="text-base text-[#78716C] hover:text-[#44403C] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-4 py-2 rounded-lg hover:bg-[#F5F5F4]">
                ← Back
              </button>
              {stepIdx < STEPS.length - 1 ? (
                <button type="button"
                  onClick={() => setStep(STEPS[stepIdx + 1].id)}
                  className="flex items-center gap-2 bg-white hover:bg-[#F5F5F4] border border-[#E8E5E2] text-[#44403C] text-base font-medium px-5 py-2 rounded-lg transition-colors">
                  Next
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ) : (
                <button onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white font-medium px-6 py-2 rounded-lg text-base transition-colors">
                  {saving ? 'Saving…' : isNew ? 'Create Agent' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Version history drawer ── */}
      {showVersions && !isNew && (
        <div className="absolute inset-y-0 right-0 w-80 bg-[#FAFAF9] border-l border-[#E8E5E2] flex flex-col z-20 shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E5E2]">
            <h2 className="text-base font-semibold text-[#1A1816]">Version History</h2>
            <button onClick={() => setShowVersions(false)}
              className="text-[#A8A29E] hover:text-[#44403C] w-6 h-6 flex items-center justify-center rounded hover:bg-[#F5F5F4]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {versions.length === 0 ? (
              <p className="text-sm text-[#A8A29E] text-center py-8">No versions saved yet.</p>
            ) : versions.map(v => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-[#FAFAF9] rounded-xl border border-[#E8E5E2]">
                <div>
                  <span className="text-sm text-[#44403C] font-medium">v{v.version_num}</span>
                  {v.note && <span className="text-sm text-[#A8A29E] ml-2">— {v.note}</span>}
                  <p className="text-[12px] text-[#A8A29E] mt-0.5">{new Date(v.created_at).toLocaleString()}</p>
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
                  className="text-sm text-[#2563EB] hover:text-[#3B82F6] px-2.5 py-1 rounded-lg border border-indigo-500/20 hover:border-indigo-500/40 transition-colors disabled:opacity-50">
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
                      ? 'bg-[#2563EB]/10 border-indigo-500/40 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]'
                      : 'bg-[#FAFAF9] border-[#E8E5E2] hover:border-[#D6D3D1]'
                  }`}>
                  <span className="text-3xl">{t.icon}</span>
                  <div>
                    <p className={`text-base font-semibold ${form.agent_type === t.id ? 'text-[#3B82F6]' : 'text-[#44403C]'}`}>
                      {t.label}
                    </p>
                    <p className="text-[13px] text-[#A8A29E] mt-0.5">{t.desc}</p>
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
            className="w-full bg-[#FAFAF9] border border-[#E8E5E2] hover:border-[#D6D3D1] focus:border-[#2563EB] rounded-xl px-4 py-3 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none transition-colors" />
        </FormField>

        <FormField label="Greeting" hint="First thing the agent says when a call connects">
          <input value={form.greeting} onChange={e => set('greeting', e.target.value)}
            placeholder="Welcome! How can I help you today?"
            className="w-full bg-[#FAFAF9] border border-[#E8E5E2] hover:border-[#D6D3D1] focus:border-[#2563EB] rounded-xl px-4 py-3 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none transition-colors" />
        </FormField>

        <FormField label="System Prompt" hint="Full instructions for the agent's persona and behavior">
          <textarea value={form.prompt} onChange={e => set('prompt', e.target.value)}
            rows={8}
            placeholder={"You are a helpful hotel receptionist for The Grand Hotel.\n\nBe polite, professional, and assist guests with:\n- Check-in and check-out queries\n- Room availability and upgrades\n- Restaurant reservations\n- Directions and local recommendations\n\nIf a caller needs maintenance, transfer them to the facilities team."}
            className="w-full bg-[#FAFAF9] border border-[#E8E5E2] hover:border-[#D6D3D1] focus:border-[#2563EB] rounded-xl px-4 py-3 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none transition-colors resize-none leading-relaxed" />
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
                    ? 'bg-[#2563EB]/10 border-indigo-500/40 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]'
                    : 'bg-[#FAFAF9] border-[#E8E5E2] hover:border-[#D6D3D1]'
                }`}>
                <p className={`text-sm font-semibold ${form.language === lang.id ? 'text-[#3B82F6]' : 'text-[#44403C]'}`}>
                  {lang.label}
                </p>
                <p className="text-[12px] text-[#A8A29E] mt-0.5">{lang.sub}</p>
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
      <div className="flex items-center gap-2 bg-[#FAFAF9] border border-[#E8E5E2] rounded-2xl p-4">
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
            <svg key={i} className="w-4 h-4 text-[#D6D3D1] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )
          if (item.type === 'io') return (
            <div key={i} className="text-[12px] text-[#A8A29E] font-medium shrink-0">{item.label}</div>
          )
          const colors = {
            blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
            purple:  'bg-purple-500/10 border-purple-500/20 text-purple-400',
            emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          }
          return (
            <div key={i} className={`text-[12px] font-medium px-2.5 py-1 rounded-lg border ${colors[item.color]}`}>
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
        onSelect={v => {
          set('tts_provider', v)
          // Auto-set default voice for each provider
          const defaults = {
            'openai': 'openai-nova',
            'cartesia': 'f786b574-daa5-4673-aa0c-cbe3e8534c02',
            'elevenlabs': 'EXAVITQu4vr4xnSDxMaL',
            'sarvam': 'priya',
            'google-wavenet': 'en-US-Wavenet-F',
          }
          if (defaults[v]) set('voice', defaults[v])
        }}
      />

      {/* OpenAI voice picker */}
      {(form.tts_provider === 'openai' || form.tts_provider?.startsWith('openai-')) && (
        <OpenAIVoicePicker
          selected={form.tts_provider?.startsWith('openai-') ? form.tts_provider : 'openai-nova'}
          onSelect={v => { set('tts_provider', v); set('voice', v) }}
        />
      )}

      {/* Sarvam voice picker */}
      {(form.tts_provider === 'sarvam' || form.tts_provider?.startsWith('sarvam-')) && (
        <SarvamVoicePicker
          selected={form.tts_provider?.startsWith('sarvam-') ? form.tts_provider : 'sarvam-priya'}
          onSelect={v => { set('tts_provider', v); set('voice', v.replace('sarvam-', '')) }}
        />
      )}

      {/* Cartesia voice picker */}
      {form.tts_provider === 'cartesia' && (
        <VoiceGrid
          title="Cartesia Sonic 3"
          subtitle="Ultra-low latency — ~40ms"
          voices={CARTESIA_VOICES}
          selected={form.voice}
          onSelect={v => { set('tts_provider', 'cartesia'); set('voice', v) }}
          previewPrefix="cartesia"
        />
      )}

      {/* ElevenLabs voice picker */}
      {form.tts_provider === 'elevenlabs' && (
        <VoiceGrid
          title="ElevenLabs"
          subtitle="Ultra-realistic, expressive"
          voices={ELEVENLABS_VOICES}
          selected={form.voice}
          onSelect={v => { set('tts_provider', 'elevenlabs'); set('voice', v) }}
          previewPrefix="elevenlabs"
        />
      )}
    </div>
  )
}

function PipelineConnector({ label }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-[#F5F5F4]" />
      <div className="flex items-center gap-1.5 text-[12px] text-[#A8A29E] shrink-0">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {label}
      </div>
      <div className="flex-1 h-px bg-[#F5F5F4]" />
    </div>
  )
}

function ProviderSection({ title, stepTag, subtitle, providers, selected, onSelect }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#F5F5F4] border border-[#E8E5E2] flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-[#78716C] tracking-wider">{stepTag}</span>
        </div>
        <div>
          <p className="text-base font-semibold text-[#1A1816]">{title}</p>
          <p className="text-sm text-[#A8A29E]">{subtitle}</p>
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
  const [currency, setCurrency] = useState('USD')
  const INR_RATE = 85

  // Match provider by exact ID or prefix (e.g. tts "sarvam-priya" matches provider "sarvam")
  const findProvider = (providers, id) => {
    if (!id) return null
    return providers.find(x => id === x.id) || providers.find(x => id.startsWith(x.id + '-') || id.startsWith(x.id))
  }

  const getMs = (providers, id) => {
    const p = findProvider(providers, id)
    if (!p?.latency) return 0
    const match = p.latency.match(/(\d+)/)
    return match ? parseInt(match[1]) : 0
  }
  const getCostPerMin = (providers, id) => {
    const p = findProvider(providers, id)
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

  const sym = currency === 'INR' ? '₹' : '$'
  const rate = currency === 'INR' ? INR_RATE : 1
  const fmtCost = (v) => {
    const c = v * rate
    return c < 0.01 ? c.toFixed(4) : c < 1 ? c.toFixed(3) : c.toFixed(2)
  }

  return (
    <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#44403C]">Estimated Response Latency</p>
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold font-mono ${ratingColor}`}>~{total}ms</span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
            total <= 800 ? 'bg-emerald-500/15 text-emerald-400' : total <= 1200 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
          }`}>{rating}</span>
        </div>
      </div>
      <div className="w-full h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${barWidth}%` }} />
      </div>
      <div className="flex items-center justify-between text-[9px] text-[#A8A29E] font-mono">
        <span>STT {sttMs}ms + LLM {llmMs}ms + TTS {ttsMs}ms</span>
        <span>Target: &lt;800ms</span>
      </div>

      {totalCostMin > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#E8E5E2]">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-[#44403C]">Estimated AI Cost</p>
            <div className="flex rounded-md border border-[#E8E5E2] overflow-hidden">
              <button type="button" onClick={() => setCurrency('USD')}
                className={`px-1.5 py-0.5 text-[9px] font-medium transition-colors ${currency === 'USD' ? 'bg-[#2563EB]/20 text-[#3B82F6]' : 'text-[#A8A29E] hover:text-[#44403C]'}`}>USD</button>
              <button type="button" onClick={() => setCurrency('INR')}
                className={`px-1.5 py-0.5 text-[9px] font-medium transition-colors ${currency === 'INR' ? 'bg-[#2563EB]/20 text-[#3B82F6]' : 'text-[#A8A29E] hover:text-[#44403C]'}`}>INR</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-base font-bold font-mono text-[#1A1816]">{sym}{fmtCost(totalCostMin)}</span>
              <span className="text-[9px] text-[#A8A29E] ml-1">/min</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold font-mono text-[#78716C]">{sym}{fmtCost(totalCostHr)}</span>
              <span className="text-[9px] text-[#A8A29E] ml-1">/hr</span>
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
          ? 'bg-[#2563EB]/8 border-indigo-500/35 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]'
          : 'bg-[#FAFAF9] border-[#E8E5E2] hover:border-[#D6D3D1] hover:bg-[#F5F5F4]'
      }`}>

      {provider.badge && (
        <span className={`absolute top-2.5 right-2.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
          isSelected
            ? 'bg-[#2563EB]/20 text-[#3B82F6]'
            : 'bg-[#F5F5F4] text-[#A8A29E]'
        }`}>
          {provider.badge}
        </span>
      )}

      <p className={`text-sm font-semibold leading-tight mb-0.5 ${isSelected ? 'text-[#3B82F6]' : 'text-[#1A1816]'}`}>
        {provider.name}
      </p>
      <p className="text-[12px] text-[#A8A29E] mb-1.5">{provider.vendor}</p>
      <p className="text-[12px] text-[#A8A29E] leading-relaxed">{provider.desc}</p>

      {(provider.latency || provider.cost) && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#E8E5E2]">
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
            <span className="text-[9px] font-mono text-[#A8A29E]">
              {provider.cost}
            </span>
          )}
        </div>
      )}

      {isSelected && (
        <div className="absolute bottom-2.5 right-2.5 w-4 h-4 rounded-full bg-[#2563EB] flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-[#1A1816]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
      <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-2xl p-5 space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-sm font-semibold text-[#78716C] mb-3">Tone</p>
            <div className="space-y-2">
              {[
                { id: 'friendly', label: 'Friendly',   sub: 'Warm, approachable' },
                { id: 'formal',   label: 'Formal',     sub: 'Professional, precise' },
                { id: 'sales',    label: 'Sales',      sub: 'Persuasive, goal-driven' },
              ].map(t => (
                <button key={t.id} type="button" onClick={() => setBeh('tone', t.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                    form.behavior.tone === t.id
                      ? 'bg-[#2563EB]/8 border-indigo-500/30 text-[#3B82F6]'
                      : 'bg-[#FAFAF9] border-[#E8E5E2] text-[#78716C] hover:border-[#D6D3D1] hover:text-[#44403C]'
                  }`}>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-[12px] text-[#A8A29E] mt-0.5">{t.sub}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#78716C] mb-3">Objective</p>
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
                      ? 'bg-[#2563EB]/8 border-indigo-500/30 text-[#3B82F6]'
                      : 'bg-[#FAFAF9] border-[#E8E5E2] text-[#78716C] hover:border-[#D6D3D1] hover:text-[#44403C]'
                  }`}>
                  <p className="text-sm font-medium">{o.label}</p>
                  <p className="text-[12px] text-[#A8A29E] mt-0.5">{o.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#78716C] mb-2">
            Fallback Message
            <span className="text-[#A8A29E] font-normal ml-1.5">— said when the agent can't help</span>
          </label>
          <input value={form.behavior.fallback || ''} onChange={e => setBeh('fallback', e.target.value)}
            placeholder="Let me transfer you to our team."
            className="w-full bg-[#FAFAF9] border border-[#E8E5E2] focus:border-[#2563EB] rounded-lg px-3 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none transition-colors" />
        </div>
      </div>

      {/* Warm Transfer */}
      <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-[#1A1816]">Warm Transfer</p>
            <p className="text-sm text-[#A8A29E] mt-0.5">Escalate to a human agent on trigger</p>
          </div>
          <Toggle value={form.escalation_config.enabled} onChange={v => setEsc('enabled', v)} />
        </div>

        {form.escalation_config.enabled && (
          <div className="mt-5 pt-5 border-t border-[#E8E5E2] space-y-4">
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
            <div className="flex items-center justify-between p-3 bg-[#FAFAF9] rounded-lg border border-[#E8E5E2]">
              <div>
                <p className="text-sm font-medium text-[#44403C]">Announce Transfer</p>
                <p className="text-[12px] text-[#A8A29E] mt-0.5">Tell caller they're being transferred</p>
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
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#E8E5E2] flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-[#A8A29E]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25"/>
        </svg>
      </div>
      <p className="text-base font-medium text-[#1A1816]">Create the agent first</p>
      <p className="text-sm text-[#A8A29E] mt-2 max-w-xs">
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
          className="flex items-center gap-1.5 text-sm font-medium text-[#78716C] hover:text-[#44403C] bg-[#F5F5F4] hover:bg-[#F0EDEA] border border-[#E8E5E2] px-3 py-2 rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Add URL
        </button>
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-[#3B82F6] bg-[#2563EB]/8 hover:bg-[#2563EB]/15 border border-indigo-500/20 px-3 py-2 rounded-lg transition-colors">
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
        <form onSubmit={scrapeUrl} className="bg-[#FAFAF9] rounded-xl border border-[#E8E5E2] p-4 space-y-3">
          <p className="text-sm font-semibold text-[#44403C]">Scrape a web page</p>
          <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://example.com/faq"
            className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]" />
          <input value={urlTitle} onChange={e => setUrlTitle(e.target.value)} placeholder="Title (optional)"
            className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]" />
          <div className="flex gap-2">
            <button type="submit" disabled={!urlInput.trim() || scrapingUrl}
              className="flex items-center gap-1.5 text-sm bg-[#2563EB]/10 hover:bg-[#2563EB]/20 text-[#2563EB] border border-indigo-500/20 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
              {scrapingUrl
                ? <><div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />Scraping…</>
                : 'Scrape & Add'}
            </button>
            <button type="button" onClick={() => setShowUrlForm(false)}
              className="text-sm text-[#A8A29E] hover:text-[#44403C] px-3 py-1.5 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-4 py-10 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-500 bg-[#2563EB]/5' : 'border-[#E8E5E2] hover:border-[#D6D3D1]'
        }`}>
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-[#78716C] text-sm">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Uploading…
          </div>
        ) : (
          <>
            <p className="text-sm text-[#A8A29E]">Drop files here or <span className="text-[#2563EB]">browse</span></p>
            <p className="text-[12px] text-[#D6D3D1] mt-1">txt · pdf · md · csv · max 5 MB each</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#A8A29E] text-center py-6">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-[#A8A29E] text-center py-6">No documents yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-start gap-3 bg-[#FAFAF9] rounded-xl border border-[#E8E5E2] px-4 py-3">
              <svg className="w-4 h-4 text-[#A8A29E] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#44403C] truncate">{doc.filename}</p>
                <p className="text-[12px] text-[#A8A29E] mt-0.5 line-clamp-2">{doc.content_preview}</p>
              </div>
              <button type="button"
                onClick={async () => {
                  if (!confirm('Remove this document?')) return
                  await api.deleteKbDoc(agentId, doc.id).catch(console.error)
                  setDocs(d => d.filter(x => x.id !== doc.id))
                }}
                className="text-sm text-red-400/50 hover:text-red-400 shrink-0 px-2 py-1 rounded hover:bg-red-500/10 transition-colors">
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
      <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-base font-semibold text-[#1A1816]">Custom LLM Endpoint</p>
          <p className="text-sm text-[#A8A29E] mt-0.5">Override with any OpenAI-compatible endpoint (Ollama, vLLM, Together AI, etc.)</p>
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
          <p className="text-sm text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
            Custom endpoint is active — LLM Provider selection above will be ignored.
          </p>
        )}
      </div>

      {/* PII */}
      <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="text-base font-semibold text-[#1A1816]">PII Redaction</p>
            <p className="text-sm text-[#A8A29E] mt-0.5">
              Automatically redact phone numbers, emails, and card numbers from transcripts.
            </p>
          </div>
          <Toggle value={form.pii_redaction} onChange={v => set('pii_redaction', v)} />
        </div>
      </div>

      {/* Extraction Schema */}
      <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-base font-semibold text-[#1A1816]">Data Extraction Schema</p>
          <p className="text-sm text-[#A8A29E] mt-0.5">
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
                    className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]" />
                </div>
                <div className="col-span-3">
                  <select value={fld.type} onChange={e => setField(i, 'type', e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm text-[#1A1816] focus:outline-none focus:border-[#2563EB]">
                    {['text', 'boolean', 'number', 'enum'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-4">
                  <input value={fld.description} onChange={e => setField(i, 'description', e.target.value)}
                    placeholder="description (optional)"
                    className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-sm text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]" />
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <button type="button" onClick={() => removeField(i)}
                    className="text-red-400/50 hover:text-red-400 text-xl leading-none transition-colors">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addField}
          className="flex items-center gap-1.5 text-sm text-[#2563EB] hover:text-[#3B82F6] transition-colors">
          <span className="text-lg leading-none">+</span> Add field
        </button>
      </div>

      {/* Call Goal */}
      <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-2xl p-5 space-y-3">
        <div>
          <p className="text-base font-semibold text-[#1A1816]">Call Goal</p>
          <p className="text-sm text-[#A8A29E] mt-0.5">
            LLM evaluates this after each call — result saved as <code className="text-[#2563EB] text-[12px]">goal_achieved</code>.
          </p>
        </div>
        <textarea value={form.success_criteria} onChange={e => set('success_criteria', e.target.value)}
          rows={3}
          placeholder="The call is successful if the caller confirmed an appointment, agreed to a callback, or their issue was resolved."
          className="w-full bg-[#FAFAF9] border border-[#E8E5E2] focus:border-[#2563EB] rounded-xl px-3 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none transition-colors resize-none" />
      </div>
    </div>
  )
}

// ─── Shared Primitives ─────────────────────────────────────────────────────

const inputCls = 'w-full bg-[#FAFAF9] border border-[#E8E5E2] focus:border-[#2563EB] rounded-lg px-3 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none transition-colors'

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
    <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-xl p-4 flex items-center gap-4">
      <button onClick={handlePlay} disabled={loading}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
          playing
            ? 'bg-red-500/15 border border-red-500/30 text-red-400'
            : 'bg-[#2563EB]/15 border border-indigo-500/30 text-[#2563EB] hover:bg-[#2563EB]/25'
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
        <p className="text-sm font-medium text-[#44403C]">Preview {voiceName} voice</p>
        <p className="text-[12px] text-[#A8A29E] mt-0.5">Hear how your agent will sound on calls</p>
      </div>
    </div>
  )
}


// ─── OpenAI Voice Picker ──────────────────────────────────────────────────

function OpenAIVoicePicker({ selected, onSelect }) {
  return (
    <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-[#78716C]">Choose OpenAI Voice</p>
      <div className="grid grid-cols-4 gap-2">
        {OPENAI_VOICES.map(v => (
          <button key={v.id} type="button" onClick={() => onSelect(v.id)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              selected === v.id
                ? 'bg-[#2563EB]/10 border-indigo-500/40'
                : 'bg-[#FAFAF9] border-[#E8E5E2] hover:border-[#D6D3D1]'
            }`}>
            <p className={`text-sm font-semibold ${selected === v.id ? 'text-[#3B82F6]' : 'text-[#44403C]'}`}>{v.name}</p>
            <p className="text-[12px] text-[#A8A29E] mt-0.5">{v.accent} · {v.age}</p>
          </button>
        ))}
      </div>
      <VoicePreview voice={selected} />
    </div>
  )
}


// ─── Sarvam Voice Picker ───────────────────────────────────────────────────

// Sarvam Bulbul v2 voices (₹15/10K chars = ₹0.83/min)
const SARVAM_V2_VOICES = [
  { id: 'sarvam-anushka',  name: 'Anushka',  gender: 'Female', lang: 'Hi · En', model: 'v2' },
  { id: 'sarvam-manisha',  name: 'Manisha',  gender: 'Female', lang: 'Hi · En', model: 'v2' },
  { id: 'sarvam-vidya',    name: 'Vidya',    gender: 'Female', lang: 'Hi · En', model: 'v2' },
  { id: 'sarvam-arya',     name: 'Arya',     gender: 'Female', lang: 'Hi · En', model: 'v2' },
  { id: 'sarvam-abhilash', name: 'Abhilash', gender: 'Male',   lang: 'Hi · En', model: 'v2' },
  { id: 'sarvam-karun',    name: 'Karun',    gender: 'Male',   lang: 'Hi · En', model: 'v2' },
  { id: 'sarvam-hitesh',   name: 'Hitesh',   gender: 'Male',   lang: 'Hi · En', model: 'v2' },
]

// Sarvam Bulbul v3 voices (₹30/10K chars = ₹1.65/min) — all v1 voices + more
const SARVAM_V3_VOICES = [
  { id: 'sarvam-shreya',   name: 'Shreya',   gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-amelia',   name: 'Amelia',   gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-sophia',   name: 'Sophia',   gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-priya',    name: 'Priya',    gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-neha',     name: 'Neha',     gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-kavya',    name: 'Kavya',    gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-simran',   name: 'Simran',   gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-ritu',     name: 'Ritu',     gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-pooja',    name: 'Pooja',    gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-ishita',   name: 'Ishita',   gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-tanya',    name: 'Tanya',    gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-shruti',   name: 'Shruti',   gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-roopa',    name: 'Roopa',    gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-suhani',   name: 'Suhani',   gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-rupali',   name: 'Rupali',   gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-kavitha',  name: 'Kavitha',  gender: 'Female', lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-rahul',    name: 'Rahul',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-amit',     name: 'Amit',     gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-dev',      name: 'Dev',      gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-rohan',    name: 'Rohan',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-kabir',    name: 'Kabir',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-aditya',   name: 'Aditya',   gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-ratan',    name: 'Ratan',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-varun',    name: 'Varun',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-anand',    name: 'Anand',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-tarun',    name: 'Tarun',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-sunny',    name: 'Sunny',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-mani',     name: 'Mani',     gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-gokul',    name: 'Gokul',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-vijay',    name: 'Vijay',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-mohit',    name: 'Mohit',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-rehan',    name: 'Rehan',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
  { id: 'sarvam-soham',    name: 'Soham',    gender: 'Male',   lang: 'Hi · En', model: 'v3' },
]

// Combined for display — provider picker shows which model
const SARVAM_VOICES = [...SARVAM_V2_VOICES, ...SARVAM_V3_VOICES]

function VoiceGrid({ title, subtitle, voices, selected, onSelect, previewPrefix }) {
  const [playing, setPlaying] = useState(null)
  const audioRef = useRef(null)
  const [genderFilter, setGenderFilter] = useState('All')

  const filtered = genderFilter === 'All' ? voices : voices.filter(v => v.gender === genderFilter)

  const playPreview = (voice) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (playing === voice.id) { setPlaying(null); return }
    const nameLower = voice.name.toLowerCase()
    const url = `https://api.vani.live/static/voice-previews/${previewPrefix}-${nameLower}.mp3`
    const audio = new Audio(url)
    audio.onended = () => setPlaying(null)
    audio.onerror = () => setPlaying(null)
    audio.play()
    audioRef.current = audio
    setPlaying(voice.id)
  }

  return (
    <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#44403C]">{title}</p>
          <p className="text-[12px] text-[#A8A29E]">{subtitle}</p>
        </div>
        <div className="flex gap-1">
          {['All', 'F', 'M'].map(g => (
            <button key={g} type="button" onClick={() => setGenderFilter(g)}
              className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
                genderFilter === g ? 'bg-[#2563EB]/20 text-[#3B82F6]' : 'text-[#A8A29E] hover:text-[#44403C]'
              }`}>{g === 'All' ? 'All' : g === 'F' ? 'Female' : 'Male'}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {filtered.map(v => (
          <button key={v.id} type="button"
            onClick={() => onSelect(v.id)}
            className={`relative text-left p-3 rounded-lg border transition-all ${
              selected === v.id
                ? 'bg-[#2563EB]/10 border-indigo-500/40'
                : 'bg-white border-[#E8E5E2] hover:border-[#D6D3D1]'
            }`}>
            <p className={`text-[13px] font-semibold ${selected === v.id ? 'text-[#3B82F6]' : 'text-[#1A1816]'}`}>{v.name}</p>
            <p className="text-[9px] text-[#A8A29E]">{v.desc}</p>
            <p className="text-[9px] text-[#A8A29E]">{v.accent} {v.gender === 'F' ? '♀' : '♂'}</p>
            <button type="button" onClick={(e) => { e.stopPropagation(); playPreview(v) }}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#F5F5F4] hover:bg-[#F5F5F4] flex items-center justify-center transition-colors">
              {playing === v.id ? (
                <div className="w-2 h-2 rounded-sm bg-indigo-400" />
              ) : (
                <svg className="w-2.5 h-2.5 text-[#78716C] ml-0.5" viewBox="0 0 12 12" fill="currentColor"><polygon points="2,0 12,6 2,12" /></svg>
              )}
            </button>
          </button>
        ))}
      </div>
    </div>
  )
}


function SarvamVoicePicker({ selected, onSelect }) {
  const [previewLang, setPreviewLang] = useState('en')
  const [genderFilter, setGenderFilter] = useState('All')
  const filtered = genderFilter === 'All' ? SARVAM_VOICES : SARVAM_VOICES.filter(v => v.gender === genderFilter)
  return (
    <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#78716C]">Choose Sarvam Voice</p>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-[#E8E5E2] overflow-hidden">
            {['All', 'Female', 'Male'].map(g => (
              <button key={g} type="button" onClick={() => setGenderFilter(g)}
                className={`px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  genderFilter === g
                    ? 'bg-[#2563EB]/15 text-[#3B82F6]'
                    : 'bg-[#FAFAF9] text-[#A8A29E] hover:text-[#44403C]'
                }`}>{g}</button>
            ))}
          </div>
          <div className="flex rounded-lg border border-[#E8E5E2] overflow-hidden">
            {[{ id: 'en', label: 'EN' }, { id: 'hi', label: 'हि' }].map(l => (
              <button key={l.id} type="button" onClick={() => setPreviewLang(l.id)}
                className={`px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  previewLang === l.id
                    ? 'bg-[#2563EB]/15 text-[#3B82F6]'
                    : 'bg-[#FAFAF9] text-[#A8A29E] hover:text-[#44403C]'
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
                ? 'bg-[#2563EB]/10 border-indigo-500/40'
                : 'bg-[#FAFAF9] border-[#E8E5E2] hover:border-[#D6D3D1]'
            }`}>
            <p className={`text-sm font-semibold ${selected === v.id ? 'text-[#3B82F6]' : 'text-[#44403C]'}`}>{v.name}</p>
            <p className="text-[12px] text-[#A8A29E] mt-0.5">{v.gender === 'Female' ? '♀' : '♂'}</p>
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
              className="w-10 h-10 rounded-lg border border-[#E8E5E2] bg-transparent cursor-pointer" />
            <input value={wc.theme_color || '#6366f1'}
              onChange={e => setWc('theme_color', e.target.value)}
              className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2 text-base text-[#1A1816] font-mono w-28 focus:outline-none focus:border-[#2563EB]" />
          </div>
        </FormField>

        <FormField label="Position">
          <div className="flex gap-3">
            {['bottom-right', 'bottom-left'].map(pos => (
              <button key={pos} type="button" onClick={() => setWc('position', pos)}
                className={`flex-1 py-3 px-4 rounded-xl border text-center text-sm font-medium transition-all ${
                  (wc.position || 'bottom-right') === pos
                    ? 'bg-[#2563EB]/10 border-indigo-500/40 text-[#3B82F6]'
                    : 'bg-[#FAFAF9] border-[#E8E5E2] text-[#78716C] hover:border-[#D6D3D1]'
                }`}>
                {pos === 'bottom-right' ? 'Bottom Right' : 'Bottom Left'}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Input Placeholder">
          <input value={wc.placeholder || 'Type a message...'}
            onChange={e => setWc('placeholder', e.target.value)}
            className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-xl px-4 py-3 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]" />
        </FormField>

        <FormField label="Avatar URL" hint="Optional — shown in chat header">
          <input value={wc.avatar_url || ''}
            onChange={e => setWc('avatar_url', e.target.value)}
            placeholder="https://..."
            className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-xl px-4 py-3 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]" />
        </FormField>

        {/* Embed Code */}
        {!isNew && (
          <div className="bg-[#FAFAF9] border border-[#E8E5E2] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#44403C]">Embed Code</p>
              {!widgetKey && (
                <button onClick={handleGenerate} disabled={generating}
                  className="text-sm bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {generating ? 'Generating...' : 'Generate Widget Key'}
                </button>
              )}
            </div>
            {widgetKey ? (
              <>
                <div className="bg-[#FAFAF9] rounded-lg p-3 font-mono text-[13px] text-emerald-400 break-all select-all leading-relaxed">
                  {embedCode}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(embedCode); setCopying(true); setTimeout(() => setCopying(false), 2000) }}
                    className="text-sm text-[#78716C] hover:text-[#1A1816] bg-[#F5F5F4] border border-[#E8E5E2] px-3 py-1.5 rounded-lg transition-colors">
                    {copying ? 'Copied!' : 'Copy Code'}
                  </button>
                  <span className="text-[12px] text-[#A8A29E]">
                    Key: {widgetKey.slice(0, 16)}...
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#A8A29E]">
                Save the agent first, then generate a widget key to get the embed code.
              </p>
            )}
          </div>
        )}

        {isNew && (
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-400">
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
      <h2 className="text-xl font-semibold text-[#1A1816]">{title}</h2>
      {desc && <p className="text-sm text-[#A8A29E] mt-1">{desc}</p>}
    </div>
  )
}

function FormField({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#78716C] mb-2">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-[#A8A29E] font-normal ml-1.5">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-[#2563EB]' : 'bg-[#F5F5F4]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  )
}
