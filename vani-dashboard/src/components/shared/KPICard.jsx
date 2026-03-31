import { useEffect, useRef, useState } from 'react'

function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) {
      setValue(target)
      return
    }

    const start = prevRef.current
    const diff = target - start
    if (diff === 0) return

    const startTime = performance.now()

    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out deceleration
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + diff * eased

      setValue(Number.isInteger(target) ? Math.round(current) : parseFloat(current.toFixed(1)))

      if (progress < 1) {
        requestAnimationFrame(tick)
      } else {
        prevRef.current = target
      }
    }

    requestAnimationFrame(tick)
  }, [target, duration])

  return value
}

export default function KPICard({ label, value, format, trend, trendLabel, pulse, icon, className = '' }) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value)
  const animated = useCountUp(isNaN(numericValue) ? 0 : numericValue)

  const displayValue = format ? format(animated) : (typeof value === 'string' ? value : animated)

  const trendColor = trend > 0 ? 'text-[#22c55e]' : trend < 0 ? 'text-[#ef4444]' : 'text-[#52525b]'
  const trendArrow = trend > 0 ? '↑' : trend < 0 ? '↓' : ''

  return (
    <div className={`glass glass-hover p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#52525b]">{label}</span>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(139,92,246,0.08)]">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[36px] font-bold tracking-[-0.03em] text-[#fafafa] leading-none">
          {displayValue}
        </span>
        {pulse && (
          <span className="relative flex h-2 w-2 mb-2">
            <span className="animate-ping absolute h-full w-full rounded-full bg-[#22c55e] opacity-60" />
            <span className="relative h-2 w-2 rounded-full bg-[#22c55e]" />
          </span>
        )}
      </div>
      {(trend !== undefined || trendLabel) && (
        <div className={`mt-2 text-[12px] font-medium ${trendColor}`}>
          {trendArrow} {trend !== undefined && `${Math.abs(trend)}%`} {trendLabel && <span className="text-[#52525b] ml-1">{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
