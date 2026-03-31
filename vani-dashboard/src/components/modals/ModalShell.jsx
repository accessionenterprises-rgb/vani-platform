import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SIZES = {
  sm: 440,
  md: 600,
  lg: 800,
}

export default function ModalShell({ isOpen, onClose, title, size = 'md', children, footer }) {
  const width = SIZES[size] || SIZES.md

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

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              className="glass-heavy rounded-2xl flex flex-col max-h-[85vh] pointer-events-auto border-breathe"
              style={{
                width,
                maxWidth: '100%',
                boxShadow: '0 24px 48px rgba(0,0,0,0.4), 0 0 64px rgba(139,92,246,0.08)',
              }}
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 4 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300, duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-[rgba(255,255,255,0.06)]">
                  <h2 className="text-[16px] font-semibold text-[#fafafa]">{title}</h2>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#52525b] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}

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
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
