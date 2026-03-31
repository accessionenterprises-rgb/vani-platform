export function SkeletonLine({ width = '100%', height = 14, className = '' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: 6 }}
    />
  )
}

export function SkeletonCircle({ size = 32, className = '' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width: size, height: size, borderRadius: '50%' }}
    />
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`glass p-5 space-y-3 ${className}`}>
      <SkeletonLine width="40%" height={12} />
      <SkeletonLine width="60%" height={32} />
      <SkeletonLine width="30%" height={12} />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4, className = '' }) {
  return (
    <div className={`glass overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex gap-4 px-5 py-3 border-b border-[rgba(255,255,255,0.04)]">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width={`${60 + Math.random() * 40}%`} height={10} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.03)]">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} width={`${40 + Math.random() * 60}%`} height={14} />
          ))}
        </div>
      ))}
    </div>
  )
}
