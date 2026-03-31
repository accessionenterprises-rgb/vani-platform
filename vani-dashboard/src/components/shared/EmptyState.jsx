export default function EmptyState({ icon, title, description, action, actionLabel, className = '' }) {
  return (
    <div className={`relative w-full flex flex-col items-center justify-center py-20 px-6 text-center overflow-hidden ${className}`}>
      {/* Ambient glow behind icon */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div style={{
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
        }} />
      </div>

      {/* Icon */}
      <div className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(139,92,246,0.15)',
          boxShadow: '0 0 32px rgba(139,92,246,0.10)',
        }}>
        {icon ? (
          typeof icon === 'string' ? (
            <span className="text-2xl">{icon}</span>
          ) : (
            <div className="w-7 h-7 text-[#8b5cf6]">{icon}</div>
          )
        ) : (
          <svg className="w-7 h-7 text-[#8b5cf6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
        )}
      </div>

      {/* Text */}
      <h3 className="relative z-10 text-[18px] font-semibold text-[#fafafa] mb-2 tracking-[-0.01em]">{title}</h3>
      {description && (
        <p className="relative z-10 text-[14px] text-[#52525b] max-w-[300px] leading-relaxed">{description}</p>
      )}

      {/* CTA */}
      {action && (
        <button onClick={action} className="relative z-10 btn-primary mt-6 px-6"
          style={{ boxShadow: '0 4px 20px rgba(139,92,246,0.25)' }}>
          {actionLabel || 'Get started'}
        </button>
      )}
    </div>
  )
}
