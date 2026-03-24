import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Channels — SMS + Chat Widget scaffold.
 * Shows available channels, install instructions, and embed snippet.
 */

export default function ChannelsPage() {
  const { user } = useAuth()
  const tenantId = user?.id || ''
  const [activeTab, setActiveTab] = useState('widget')
  const [widgetTheme, setWidgetTheme] = useState('dark')
  const [widgetPosition, setWidgetPosition] = useState('bottom-right')
  const [widgetGreeting, setWidgetGreeting] = useState('Hi! How can I help you today?')
  const [copied, setCopied] = useState(false)

  function copy(text) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const embedSnippet = `<!-- Vani Chat Widget -->
<script>
  window.VaniConfig = {
    tenantId: "${tenantId}",
    theme: "${widgetTheme}",
    position: "${widgetPosition}",
    greeting: "${widgetGreeting}",
  };
  (function(d,s,id){
    var js,fjs=d.getElementsByTagName(s)[0];
    if(d.getElementById(id)) return;
    js=d.createElement(s); js.id=id;
    js.src="https://widget.vani.live/v1/loader.js";
    fjs.parentNode.insertBefore(js,fjs);
  }(document,'script','vani-widget'));
</script>`

  const smsSnippet = `curl -X POST https://api.vani.live/sms/outbound \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+91XXXXXXXXXX",
    "agent_id": "YOUR_AGENT_ID",
    "message": "Hi! Reply to start a conversation."
  }'`

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-7 max-w-4xl">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-[#1A1816]">Channels</h1>
          <p className="text-base text-[#A8A29E] mt-0.5">Deploy your AI agents across voice, SMS, and chat.</p>
        </div>

        {/* Channel cards */}
        <div className="grid grid-cols-3 gap-4 mb-7">
          <ChannelCard
            icon="📞"
            name="Voice (Phone)"
            status="live"
            description="Inbound + outbound calls via Twilio/Exotel. Configure in Numbers."
            link="/numbers"
            linkLabel="Manage numbers →"
          />
          <ChannelCard
            icon="💬"
            name="Web Chat Widget"
            status="beta"
            description="Embeddable chat widget for any website. Text-based AI conversations."
            active={activeTab === 'widget'}
            onClick={() => setActiveTab('widget')}
            linkLabel="Configure →"
          />
          <ChannelCard
            icon="📱"
            name="SMS"
            status="coming_soon"
            description="Two-way SMS conversations powered by your AI agents."
            active={activeTab === 'sms'}
            onClick={() => setActiveTab('sms')}
            linkLabel="Setup →"
          />
        </div>

        {/* Tab content */}
        {activeTab === 'widget' && (
          <div className="space-y-5">
            {/* Configuration */}
            <div className="bg-white rounded-xl border border-[#E8E5E2] p-6">
              <h2 className="text-base font-semibold text-[#1A1816] mb-5">Widget Configuration</h2>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#78716C] mb-1.5">Theme</label>
                  <select value={widgetTheme} onChange={e => setWidgetTheme(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-base text-[#1A1816] focus:outline-none focus:border-[#2563EB]">
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="indigo">Indigo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#78716C] mb-1.5">Position</label>
                  <select value={widgetPosition} onChange={e => setWidgetPosition(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-base text-[#1A1816] focus:outline-none focus:border-[#2563EB]">
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#78716C] mb-1.5">Greeting Message</label>
                  <input value={widgetGreeting} onChange={e => setWidgetGreeting(e.target.value)}
                    className="w-full bg-[#FAFAF9] border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-base text-[#1A1816] placeholder-[#A8A29E] focus:outline-none focus:border-[#2563EB]" />
                </div>
              </div>
            </div>

            {/* Widget preview */}
            <div className="bg-white rounded-xl border border-[#E8E5E2] p-5">
              <h2 className="text-base font-semibold text-[#1A1816] mb-4">Preview</h2>
              <div className={`relative h-64 rounded-lg border border-[#E8E5E2] overflow-hidden ${
                widgetTheme === 'light' ? 'bg-[#FAFAF9]' : 'bg-[#FAFAF9]'
              }`}>
                <div className={`absolute ${widgetPosition === 'bottom-right' ? 'right-4 bottom-4' : 'left-4 bottom-4'} flex flex-col items-${widgetPosition === 'bottom-right' ? 'end' : 'start'} gap-2`}>
                  {/* Chat bubble preview */}
                  <div className={`rounded-xl p-3 shadow-lg max-w-[180px] text-sm ${
                    widgetTheme === 'light' ? 'bg-white text-[#1A1816]' : 'bg-[#F5F5F4] text-[#44403C]'
                  }`}>
                    {widgetGreeting || 'Hi! How can I help?'}
                  </div>
                  {/* Widget button */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg cursor-pointer ${
                    widgetTheme === 'indigo' ? 'bg-[#2563EB]' : widgetTheme === 'light' ? 'bg-[#1A1816]' : 'bg-[#2563EB]'
                  }`}>
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                    </svg>
                  </div>
                </div>
                <p className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-medium ${
                  widgetTheme === 'light' ? 'text-[#78716C]' : 'text-[#A8A29E]'
                }`}>Your website</p>
              </div>
            </div>

            {/* Embed snippet */}
            <div className="bg-white rounded-xl border border-[#E8E5E2] p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-[#1A1816]">Embed Code</h2>
                <button onClick={() => copy(embedSnippet)}
                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20'
                  }`}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-sm text-[#78716C] bg-[#FAFAF9] rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">
                {embedSnippet}
              </pre>
              <p className="text-sm text-[#A8A29E] mt-3">
                Paste this snippet before the <code className="text-[#78716C]">&lt;/body&gt;</code> tag on every page where you want the widget to appear.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'sms' && (
          <div className="space-y-5">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
              <p className="text-base font-medium text-amber-400 mb-1">SMS Channel — Coming Soon</p>
              <p className="text-sm text-amber-300/70">Two-way SMS is in development. When live, your agents will handle text conversations the same way they handle calls — same prompt, same KB, just text instead of voice.</p>
            </div>

            <div className="bg-white rounded-xl border border-[#E8E5E2] p-5">
              <h2 className="text-base font-semibold text-[#1A1816] mb-4">SMS API Preview</h2>
              <p className="text-sm text-[#A8A29E] mb-3">When SMS launches, you'll be able to trigger outbound SMS conversations via API:</p>
              <pre className="text-sm text-[#78716C] bg-[#FAFAF9] rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">
                {smsSnippet}
              </pre>
            </div>

            <div className="bg-white rounded-xl border border-[#E8E5E2] p-5">
              <h2 className="text-base font-semibold text-[#1A1816] mb-3">SMS Capabilities (Planned)</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Outbound SMS', 'Trigger text conversations from your app'],
                  ['Inbound SMS', 'Receive texts, agent replies automatically'],
                  ['WhatsApp', 'Same agent, WhatsApp Business API'],
                  ['Template Messaging', 'Approved templates for notifications'],
                ].map(([title, desc]) => (
                  <div key={title} className="flex gap-2">
                    <span className="text-[#2563EB] text-sm mt-0.5">◦</span>
                    <div>
                      <p className="text-sm font-medium text-[#44403C]">{title}</p>
                      <p className="text-sm text-[#A8A29E]">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChannelCard({ icon, name, status, description, link, linkLabel, active, onClick }) {
  const statusColors = {
    live: 'text-emerald-400 bg-emerald-500/10',
    beta: 'text-blue-400 bg-blue-500/10',
    coming_soon: 'text-amber-400 bg-amber-500/10',
  }
  const statusLabels = { live: 'Live', beta: 'Beta', coming_soon: 'Soon' }

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-5 transition-colors ${
        active ? 'border-indigo-500/40' : 'border-[#E8E5E2] hover:border-[#E8E5E2]'
      } ${onClick ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{icon}</span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
      </div>
      <p className="text-base font-medium text-[#1A1816] mb-1">{name}</p>
      <p className="text-sm text-[#A8A29E] mb-3">{description}</p>
      {link ? (
        <a href={link} className="text-sm text-[#2563EB] hover:text-[#3B82F6] transition-colors">{linkLabel}</a>
      ) : (
        <span className="text-sm text-[#2563EB]">{linkLabel}</span>
      )}
    </div>
  )
}
