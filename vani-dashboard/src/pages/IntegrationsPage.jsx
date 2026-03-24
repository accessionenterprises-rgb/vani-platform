import { useState } from 'react'

/**
 * Native Integrations — connect Vani to third-party tools.
 * Each card shows connection status + setup instructions.
 */

const INTEGRATIONS = [
  {
    id: 'zapier',
    name: 'Zapier',
    logo: '⚡',
    category: 'Automation',
    description: 'Trigger Zaps when calls start, end, or fail. Push call data to 5,000+ apps.',
    docs: 'https://zapier.com',
    status: 'available',
    steps: [
      'Go to Zapier and create a new Zap',
      'Choose "Webhooks by Zapier" as trigger',
      'Copy the Zapier webhook URL',
      'Add it to Vani → Settings → Webhooks with event "call.ended"',
    ],
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    logo: '🔧',
    category: 'Automation',
    description: 'Build visual workflows triggered by Vani call events.',
    docs: 'https://make.com',
    status: 'available',
    steps: [
      'Create a new scenario in Make',
      'Add a Webhooks module as the trigger',
      'Copy the Make webhook URL',
      'Add to Vani → Settings → Webhooks',
    ],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    logo: '🟠',
    category: 'CRM',
    description: 'Log calls and transcripts as HubSpot activities. Create contacts from inbound callers.',
    docs: 'https://developers.hubspot.com',
    status: 'coming_soon',
    steps: [],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    logo: '☁️',
    category: 'CRM',
    description: 'Sync call logs and AI summaries to Salesforce opportunities and contacts.',
    docs: 'https://developer.salesforce.com',
    status: 'coming_soon',
    steps: [],
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    logo: '📊',
    category: 'Data',
    description: 'Export call logs and extracted data to Google Sheets automatically.',
    docs: 'https://workspace.google.com',
    status: 'available',
    steps: [
      'Set up a Google Apps Script web app or use Zapier/Make as middleware',
      'Configure Vani webhook → POST to your script URL',
      'Map call fields (phone, duration, sentiment, extracted data) to columns',
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    logo: '💬',
    category: 'Notifications',
    description: 'Get Slack alerts for new calls, escalations, and failed calls.',
    docs: 'https://api.slack.com',
    status: 'available',
    steps: [
      'Create a Slack Incoming Webhook at api.slack.com/apps',
      'Copy the Slack webhook URL',
      'Add it to Vani → Settings → Webhooks with desired events',
      'Slack messages will arrive formatted with call details',
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    logo: '📝',
    category: 'Productivity',
    description: 'Add call summaries and transcripts to a Notion database.',
    docs: 'https://developers.notion.com',
    status: 'available',
    steps: [
      'Create a Notion integration at notion.com/my-integrations',
      'Share your database with the integration',
      'Use Zapier or Make to connect Vani webhook → Notion API',
    ],
  },
  {
    id: 'pabbly',
    name: 'Pabbly Connect',
    logo: '🔌',
    category: 'Automation',
    description: 'India-friendly automation platform. Connect Vani to 1,000+ apps.',
    docs: 'https://pabbly.com/connect',
    status: 'available',
    steps: [
      'Create a workflow in Pabbly Connect',
      'Add Webhook as trigger, copy the URL',
      'Add to Vani → Settings → Webhooks',
    ],
  },
]

const CATEGORIES = ['All', ...new Set(INTEGRATIONS.map(i => i.category))]

export default function IntegrationsPage() {
  const [category, setCategory] = useState('All')
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch]     = useState('')

  const filtered = INTEGRATIONS.filter(i =>
    (category === 'All' || i.category === category) &&
    (!search.trim() || i.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-5xl">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-[#1A1816]">Integrations</h1>
          <p className="text-base text-[#A8A29E] mt-0.5">
            Connect Vani to your stack using webhooks and native connectors.
            <a href="#" className="ml-2 text-[#2563EB] hover:text-[#3B82F6]">API docs →</a>
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex gap-1 bg-white border border-[#E8E5E2] rounded-lg p-1">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  category === c ? 'bg-[#2563EB]/20 text-[#2563EB]' : 'text-[#A8A29E] hover:text-[#44403C]'
                }`}>
                {c}
              </button>
            ))}
          </div>
          <div className="relative">
            <svg className="w-3.5 h-3.5 text-[#A8A29E] absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 pr-3 py-1.5 bg-white border border-[#E8E5E2] rounded-lg text-sm text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB] w-40" />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4">
          {filtered.map(integration => (
            <div key={integration.id}
              className="bg-white rounded-xl border border-[#E8E5E2] p-5 hover:border-[#E8E5E2] transition-colors">
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl w-10 h-10 rounded-xl bg-[#FAFAF9] flex items-center justify-center shrink-0">
                  {integration.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-medium text-[#1A1816]">{integration.name}</p>
                    {integration.status === 'coming_soon' ? (
                      <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Soon</span>
                    ) : (
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Available</span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#A8A29E] mt-0.5">{integration.category}</p>
                </div>
              </div>

              <p className="text-sm text-[#78716C] leading-relaxed mb-3">{integration.description}</p>

              {integration.steps.length > 0 && (
                <button
                  onClick={() => setExpanded(expanded === integration.id ? null : integration.id)}
                  className="text-sm text-[#2563EB] hover:text-[#3B82F6] transition-colors">
                  {expanded === integration.id ? 'Hide setup ↑' : 'Setup guide →'}
                </button>
              )}

              {expanded === integration.id && integration.steps.length > 0 && (
                <div className="mt-3 space-y-2">
                  {integration.steps.map((step, i) => (
                    <div key={i} className="flex gap-2.5 text-sm text-[#78716C]">
                      <span className="text-indigo-500 shrink-0 font-medium">{i + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}

              {integration.status === 'coming_soon' && (
                <p className="text-sm text-amber-400/70 mt-3">Native connector coming soon — use webhooks in the meantime.</p>
              )}
            </div>
          ))}
        </div>

        {/* Webhook hint */}
        <div className="mt-6 bg-white rounded-xl border border-[#E8E5E2] p-5">
          <h2 className="text-base font-medium text-[#1A1816] mb-2">Using the Webhook API</h2>
          <p className="text-sm text-[#78716C] leading-relaxed mb-3">
            All integrations can be powered by Vani's webhook system. Configure webhooks at Settings → Webhooks to receive real-time event payloads for <code className="text-[#3B82F6] bg-[#2563EB]/10 px-1 rounded">call.started</code>, <code className="text-[#3B82F6] bg-[#2563EB]/10 px-1 rounded">call.ended</code>, and <code className="text-[#3B82F6] bg-[#2563EB]/10 px-1 rounded">call.analyzed</code> events.
          </p>
          <a href="/webhooks" className="text-sm text-[#2563EB] hover:text-[#3B82F6] transition-colors">
            Configure webhooks →
          </a>
        </div>
      </div>
    </div>
  )
}
