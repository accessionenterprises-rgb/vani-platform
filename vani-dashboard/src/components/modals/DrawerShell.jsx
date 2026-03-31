import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function DrawerShell({ isOpen, onClose, title, width = 560, children, footer }) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 backdrop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed top-0 right-0 bottom-0 z-50 flex flex-col glass-heavy"
            style={{ width }}
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-14 shrink-0 border-b border-[rgba(255,255,255,0.06)]">
              <h2 className="text-[16px] font-semibold text-[#fafafa] truncate">{title}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#52525b] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>

            {/* Footer (optional) */}
            {footer && (
              <div className="shrink-0 px-6 py-4 border-t border-[rgba(255,255,255,0.06)]">
                {footer}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
