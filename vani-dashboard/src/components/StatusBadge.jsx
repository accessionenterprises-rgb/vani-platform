const STYLES = {
  active:          'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
  completed:       'bg-[#F5F5F4] text-[#57534E] border-[#E7E5E4]',
  failed:          'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
  connecting:      'bg-[#FEFCE8] text-[#A16207] border-[#FEF08A]',
  routing:         'bg-[#EFF4FF] text-[#2563EB] border-[#BFDBFE]',
  incoming:        'bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]',
  ending:          'bg-[#FFF7ED] text-[#EA580C] border-[#FED7AA]',
  post_processing: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
  inbound:         'bg-[#F5F5F4] text-[#57534E] border-[#E7E5E4]',
  outbound:        'bg-[#EFF4FF] text-[#2563EB] border-[#BFDBFE]',
}

export default function StatusBadge({ status }) {
  const cls = STYLES[status?.toLowerCase()] || 'bg-[#F5F5F4] text-[#78716C] border-[#E7E5E4]'
  return (
    <span className={`inline-flex items-center px-2 py-[2px] rounded-md text-[11px] font-semibold border tracking-wide ${cls}`}>
      {status}
    </span>
  )
}
