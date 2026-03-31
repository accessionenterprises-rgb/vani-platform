const VARIANTS = {
  success:  'text-[#22c55e] bg-[rgba(34,197,94,0.12)]',
  danger:   'text-[#ef4444] bg-[rgba(239,68,68,0.12)]',
  warning:  'text-[#eab308] bg-[rgba(234,179,8,0.12)]',
  info:     'text-[#8b5cf6] bg-[rgba(139,92,246,0.12)]',
  blue:     'text-[#3b82f6] bg-[rgba(59,130,246,0.12)]',
  neutral:  'text-[#52525b] bg-[rgba(255,255,255,0.04)]',
  cyan:     'text-[#06b6d4] bg-[rgba(6,182,212,0.12)]',
  amber:    'text-[#f59e0b] bg-[rgba(245,158,11,0.12)]',
  gold:     'text-[#fbbf24] bg-gradient-to-r from-[rgba(251,191,36,0.12)] to-[rgba(245,158,11,0.08)]',
}

// Map common status strings to variants
const STATUS_MAP = {
  active: 'success', online: 'success', completed: 'success', paid: 'success', live: 'success',
  inactive: 'neutral', offline: 'neutral', draft: 'neutral',
  failed: 'danger', error: 'danger', cancelled: 'danger',
  running: 'blue', connecting: 'blue', calling: 'blue', in_progress: 'blue',
  paused: 'warning', pending: 'warning', invited: 'warning', scheduled: 'warning',
  voice: 'info', chatbot: 'cyan',
}

export default function Badge({ variant, status, children, pulse, className = '' }) {
  const resolvedVariant = variant || STATUS_MAP[status] || STATUS_MAP[children?.toString().toLowerCase()] || 'neutral'
  const colors = VARIANTS[resolvedVariant] || VARIANTS.neutral

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.04em] ${colors} ${className}`}>
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute h-full w-full rounded-full opacity-60" style={{ background: 'currentColor' }} />
          <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
        </span>
      )}
      {children || status}
    </span>
  )
}
