export default function ErrorBanner({ message, onRetry, className = '' }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] ${className}`}>
      <svg className="w-4 h-4 text-[#ef4444] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="flex-1 text-[13px] text-[#ef4444]">{message || 'Something went wrong'}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-[13px] font-medium text-[#ef4444] hover:text-[#f87171] transition-colors">
          Retry
        </button>
      )}
    </div>
  )
}
