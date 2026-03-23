const STYLES = {
  active:          'bg-green-50 text-green-700 border-green-200',
  completed:       'bg-gray-50 text-gray-600 border-gray-200',
  failed:          'bg-red-50 text-red-600 border-red-200',
  connecting:      'bg-yellow-50 text-yellow-700 border-yellow-200',
  routing:         'bg-blue-50 text-blue-600 border-blue-200',
  incoming:        'bg-indigo-50 text-indigo-600 border-indigo-200',
  ending:          'bg-orange-50 text-orange-600 border-orange-200',
  post_processing: 'bg-purple-50 text-purple-600 border-purple-200',
  inbound:         'bg-gray-50 text-gray-600 border-gray-200',
  outbound:        'bg-blue-50 text-blue-600 border-blue-200',
}

export default function StatusBadge({ status }) {
  const cls = STYLES[status?.toLowerCase()] || 'bg-gray-50 text-gray-500 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cls}`}>
      {status}
    </span>
  )
}
