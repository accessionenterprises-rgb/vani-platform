import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const TEMPLATES = [
  {
    id: 'hotel',
    title: 'Hotel Receptionist',
    industry: 'Hospitality',
    objective: 'booking',
    color: 'amber',
    icon: '🏨',
    description: 'Handles room inquiries, reservations, check-in/out, and hotel amenities',
    agent: {
      name: 'Hotel Receptionist',
      language: 'en',
      voice: 'nova',
      stt_provider: 'deepgram-nova-3',
      llm_provider: 'gpt-4o-mini',
      tts_provider: 'openai-nova',
      greeting: "Welcome to The Grand Hotel! I'm your AI concierge. How may I assist you today?",
      prompt: `You are a professional hotel receptionist for The Grand Hotel. Your role is to:
- Handle room reservations and availability inquiries
- Provide information about hotel amenities (pool, spa, restaurant, gym)
- Assist with check-in and check-out processes
- Answer questions about room types, pricing, and policies
- Handle special requests and complaints professionally

Be warm, professional, and solution-oriented. Keep responses concise. If you cannot resolve an issue, offer to connect the caller with a human staff member.`,
      behavior: { tone: 'formal', objective: 'booking', fallback: 'Let me connect you with our front desk team.' },
    },
  },
  {
    id: 'restaurant',
    title: 'Restaurant Booking',
    industry: 'F&B',
    objective: 'booking',
    color: 'orange',
    icon: '🍽️',
    description: 'Takes table reservations, handles special requests, and provides menu info',
    agent: {
      name: 'Restaurant Booking',
      language: 'en',
      voice: 'shimmer',
      stt_provider: 'deepgram-nova-3',
      llm_provider: 'gpt-4o-mini',
      tts_provider: 'openai-nova',
      greeting: "Hello! You've reached Bella Vista. I'd love to help you reserve a table. How many guests will be dining?",
      prompt: `You are a warm restaurant booking assistant for Bella Vista restaurant. Your goals:
- Take table reservations (ask: date, time, party size, name, phone)
- Share menu highlights and daily specials
- Note dietary restrictions and special occasions
- Confirm and repeat booking details before ending the call
- Handle cancellations and modifications

Be friendly and enthusiastic. Mention popular dishes and current specials when relevant. Always confirm the booking details back to the caller.`,
      behavior: { tone: 'friendly', objective: 'booking', fallback: 'Let me transfer you to our host stand.' },
    },
  },
  {
    id: 'clinic',
    title: 'Clinic Appointment',
    industry: 'Healthcare',
    objective: 'booking',
    color: 'teal',
    icon: '🏥',
    description: 'Schedules appointments, handles patient queries, insurance, and reminders',
    agent: {
      name: 'Clinic Receptionist',
      language: 'en',
      voice: 'nova',
      stt_provider: 'deepgram-nova-3',
      llm_provider: 'gpt-4o-mini',
      tts_provider: 'openai-nova',
      greeting: "Good day! You've reached City Health Clinic. How may I assist you today?",
      prompt: `You are a professional clinic receptionist. Your responsibilities:
- Schedule new appointments (ask: patient name, DOB, reason for visit, insurance, preferred date/time)
- Handle appointment cancellations and rescheduling
- Provide directions, parking info, and what to bring
- Answer questions about clinic hours and accepted insurance
- For medical questions or emergencies, direct to the doctor or emergency services

Maintain HIPAA-mindful communication. Be calm, reassuring, and efficient. Never provide medical advice.`,
      behavior: { tone: 'formal', objective: 'booking', fallback: 'Let me connect you with our scheduling team.' },
    },
  },
  {
    id: 'realestate',
    title: 'Real Estate Qualifier',
    industry: 'Real Estate',
    objective: 'qualify',
    color: 'blue',
    icon: '🏘️',
    description: 'Qualifies leads, schedules property viewings, and captures buyer intent',
    agent: {
      name: 'Real Estate Agent',
      language: 'en',
      voice: 'onyx',
      stt_provider: 'deepgram-nova-3',
      llm_provider: 'gpt-4o-mini',
      tts_provider: 'openai-nova',
      greeting: "Hi, thanks for calling Premium Properties! I'm here to help you find your perfect home. Are you looking to buy or rent?",
      prompt: `You are a lead qualification agent for Premium Properties real estate agency. Your goals:
- Understand the caller's property needs (budget, location, size, type)
- Assess timeline and financing status (pre-approved? cash buyer?)
- Schedule property viewings for qualified leads
- Capture contact details and preferred communication method
- Identify hot leads (ready to buy within 3 months) vs nurture leads

Ask open-ended questions. Be enthusiastic but not pushy. Score the lead: hot (buying within 3 months), warm (3-6 months), cold (just looking).`,
      behavior: { tone: 'friendly', objective: 'qualify', fallback: 'Let me have one of our agents call you back.' },
    },
  },
  {
    id: 'ecommerce',
    title: 'E-commerce Support',
    industry: 'Retail',
    objective: 'support',
    color: 'purple',
    icon: '🛍️',
    description: 'Handles order tracking, returns, product questions, and complaints',
    agent: {
      name: 'Customer Support',
      language: 'en',
      voice: 'alloy',
      stt_provider: 'deepgram-nova-3',
      llm_provider: 'gpt-4o-mini',
      tts_provider: 'openai-nova',
      greeting: "Hi! Thanks for calling ShopEasy support. I'm here to help. What's your order number or how can I assist you today?",
      prompt: `You are a customer support agent for ShopEasy e-commerce platform. You handle:
- Order status and tracking inquiries
- Return and refund requests (7-day policy, must have receipt)
- Product questions and recommendations
- Account issues (login, password, address updates)
- Complaints (de-escalate, offer solutions)

Be empathetic and solution-focused. Acknowledge frustration before offering solutions. For returns: collect order ID, reason, and preferred resolution (refund/exchange). Escalate to supervisor if customer is very angry.`,
      behavior: { tone: 'friendly', objective: 'support', fallback: 'Let me escalate this to a senior support agent.' },
    },
  },
]

const COLOR_MAP = {
  amber:  'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50',
  orange: 'border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50',
  teal:   'border-teal-500/30 bg-teal-500/5 hover:border-teal-500/50',
  blue:   'border-blue-500/30 bg-[rgba(139,92,246,0.08)]0/5 hover:border-blue-500/50',
  purple: 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50',
}
const BADGE_MAP = {
  amber:  'text-amber-400 bg-amber-500/10',
  orange: 'text-orange-400 bg-orange-500/10',
  teal:   'text-teal-400 bg-teal-500/10',
  blue:   'text-blue-400 bg-[rgba(139,92,246,0.08)]0/10',
  purple: 'text-purple-400 bg-purple-500/10',
}

export default function TemplatesPage() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(null)
  const [status, setStatus] = useState({})

  async function handleUseTemplate(template) {
    setCreating(template.id)
    setStatus(s => ({ ...s, [template.id]: 'creating' }))
    try {
      const payload = {
        name: template.agent.name,
        greeting: template.agent.greeting,
        prompt: template.agent.prompt,
        language: template.agent.language,
        voice: template.agent.voice,
        stack: {
          stt: template.agent.stt_provider,
          llm: template.agent.llm_provider,
          tts: template.agent.tts_provider,
        },
        behavior: template.agent.behavior,
      }
      const agent = await api.createAgent(payload)
      setStatus(s => ({ ...s, [template.id]: 'done' }))
      setTimeout(() => navigate(`/agents/${agent.id}`), 800)
    } catch (err) {
      setStatus(s => ({ ...s, [template.id]: 'error' }))
      alert(err.message)
    } finally {
      setCreating(null)
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 ">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-[#fafafa]">Templates</h1>
          <p className="text-base text-[#71717a] mt-0.5">
            Start with a pre-built agent — fully customisable after creation
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {TEMPLATES.map(t => (
            <div key={t.id}
              className={`rounded-xl border p-6 transition-all cursor-pointer group ${COLOR_MAP[t.color]}`}
              onClick={() => !creating && handleUseTemplate(t)}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{t.icon}</span>
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="text-lg font-semibold text-[#fafafa]">{t.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_MAP[t.color]}`}>
                        {t.industry}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium text-[#71717a] bg-slate-500/10">
                        {t.agent.objective}
                      </span>
                    </div>
                    <p className="text-base text-[#a1a1aa]">{t.description}</p>
                    <p className="text-sm text-[#71717a] mt-2 italic">
                      "{t.agent.greeting}"
                    </p>
                  </div>
                </div>
                <button
                  disabled={!!creating}
                  onClick={(e) => { e.stopPropagation(); handleUseTemplate(t) }}
                  className={`shrink-0 ml-4 px-4 py-2 rounded-lg text-base font-medium transition-colors ${
                    status[t.id] === 'done'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : status[t.id] === 'creating'
                      ? 'bg-[#2563EB]/20 text-[#2563EB] opacity-70'
                      : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white opacity-0 group-hover:opacity-100'
                  }`}>
                  {status[t.id] === 'done' ? '✓ Created' : status[t.id] === 'creating' ? 'Creating…' : 'Use Template'}
                </button>
              </div>

              {/* Stack chips */}
              <div className="flex flex-wrap gap-1.5 mt-4 ml-[52px]">
                {[t.agent.stt_provider, t.agent.llm_provider, t.agent.tts_provider].map(p => (
                  <span key={p} className="text-sm text-[#71717a] bg-[#1c1c1f] border border-[#F0EDEA] px-2 py-0.5 rounded">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-[#0f0f11] rounded-xl border border-[rgba(255,255,255,0.06)] p-5">
          <h2 className="text-base font-medium text-[#fafafa] mb-2">More templates coming soon</h2>
          <p className="text-sm text-[#71717a]">
            Healthcare Follow-up, Debt Collection, Lead Nurturing, Appointment Reminder,
            Travel Booking, Insurance Sales — in the next update.
          </p>
        </div>
      </div>
    </div>
  )
}
