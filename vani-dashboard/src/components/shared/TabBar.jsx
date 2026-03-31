export default function TabBar({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`flex items-center gap-1 border-b border-[rgba(255,255,255,0.06)] ${className}`}>
      {tabs.map(tab => {
        const key = typeof tab === 'string' ? tab : tab.key
        const label = typeof tab === 'string' ? tab : tab.label
        const isActive = active === key

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`relative px-4 py-2.5 text-[14px] font-medium transition-colors ${
              isActive
                ? 'text-[#fafafa]'
                : 'text-[#52525b] hover:text-[#a1a1aa]'
            }`}
          >
            {label}
            {isActive && (
              <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#8b5cf6] rounded-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}
