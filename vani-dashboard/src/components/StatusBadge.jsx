const STYLES = {
  active:          'bg-emerald-500/15 text-emerald-400',
  completed:       'bg-slate-500/15 text-slate-400',
  failed:          'bg-red-500/15 text-red-400',
  connecting:      'bg-yellow-500/15 text-yellow-400',
  routing:         'bg-blue-500/15 text-blue-400',
  incoming:        'bg-indigo-500/15 text-indigo-400',
  ending:          'bg-orange-500/15 text-orange-400',
  post_processing: 'bg-purple-500/15 text-purple-400',
  inbound:         'bg-slate-500/15 text-slate-400',
  outbound:        'bg-indigo-500/15 text-indigo-400',
}

export default function StatusBadge({ status }) {
  const cls = STYLES[status?.toLowerCase()] || 'bg-slate-500/15 text-slate-400'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}
