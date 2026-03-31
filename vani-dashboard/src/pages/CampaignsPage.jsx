import { useCampaigns, useCampaign } from '../hooks/useCampaigns'
import { useDrawer } from '../hooks/useDrawer'
import Badge from '../components/shared/Badge'
import EmptyState from '../components/shared/EmptyState'

export default function CampaignsPage() {
  const { data: campaigns = [], isLoading } = useCampaigns()
  const { isOpen, detailId, open, close } = useDrawer('detail')
  const { data: detail } = useCampaign(detailId)

  return (
    <div className="w-full h-full px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[26px] font-bold text-[#fafafa] tracking-[-0.02em]">Campaigns</h1>
          <p className="text-[13px] text-[#52525b] mt-0.5">Bulk outbound calling at scale</p>
        </div>
        <button className="btn-primary press flex items-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Campaign
        </button>
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" description="Create a campaign to start bulk outbound calling" />
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const pct = c.total_contacts ? Math.round(c.called / c.total_contacts * 100) : 0
            return (
              <div
                key={c.id}
                onClick={() => open(c.id)}
                className="glass glass-hover p-4 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[13px] font-semibold text-[#fafafa] truncate">{c.name}</p>
                      <Badge status={c.status} />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#52525b]">
                      <span>{c.total_contacts} contacts</span>
                      <span>·</span>
                      <span className="text-[#22c55e]">{c.answered} answered</span>
                      <span>·</span>
                      <span>{c.called} called</span>
                      <span>·</span>
                      <span>retry ×{c.max_attempts}</span>
                    </div>
                  </div>
                  {/* Progress */}
                  <div className="w-24 shrink-0">
                    <div className="h-1 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-[#8b5cf6] rounded-full transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-[#52525b] mt-1 text-right">{pct}%</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drawer */}
      {isOpen && (
        <>
          <div className="fixed inset-0 backdrop-overlay z-40" onClick={close} />
          <div className="fixed top-0 right-0 h-full w-[420px] glass-heavy z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[16px] font-bold text-[#fafafa]">Campaign Details</h2>
                <button onClick={close} className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {detail ? (
                <div className="space-y-4">
                  <div className="glass p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-[14px] font-semibold text-[#fafafa]">{detail.name}</p>
                      <Badge status={detail.status} />
                    </div>
                    <div className="space-y-2">
                      <InfoRow label="Total Contacts" value={detail.total_contacts} />
                      <InfoRow label="Called" value={detail.called} />
                      <InfoRow label="Answered" value={detail.answered} />
                      <InfoRow label="Max Attempts" value={`×${detail.max_attempts}`} />
                      <InfoRow label="Retry Delay" value={`${detail.retry_delay_min} min`} />
                      <InfoRow label="Timezone" value={detail.timezone || '—'} />
                      {detail.call_window_start && (
                        <InfoRow label="Call Window" value={`${detail.call_window_start} – ${detail.call_window_end}`} />
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="glass p-4">
                    <p className="text-[12px] text-[#52525b] uppercase tracking-[0.04em] mb-2">Progress</p>
                    <div className="h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden mb-1">
                      <div
                        style={{ width: `${detail.total_contacts ? Math.round(detail.called / detail.total_contacts * 100) : 0}%` }}
                        className="h-full bg-[#8b5cf6] rounded-full"
                      />
                    </div>
                    <p className="text-[11px] text-[#a1a1aa] text-right">
                      {detail.total_contacts ? Math.round(detail.called / detail.total_contacts * 100) : 0}% complete
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#52525b]">{label}</span>
      <span className="text-[13px] text-[#fafafa]">{value}</span>
    </div>
  )
}
