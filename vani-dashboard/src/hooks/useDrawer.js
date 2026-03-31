import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

/**
 * URL-synced drawer state (Linear pattern).
 *
 * Usage:
 *   const { isOpen, detailId, open, close } = useDrawer('detail')
 *
 *   open('agent_123')  → URL becomes ?detail=agent_123
 *   close()            → removes ?detail from URL
 *   Back button        → closes drawer (browser history)
 */
export function useDrawer(param = 'detail') {
  const [searchParams, setSearchParams] = useSearchParams()
  const detailId = searchParams.get(param)
  const isOpen = !!detailId

  const open = useCallback((id) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set(param, id)
      return next
    }, { replace: false }) // push to history so back button works
  }, [param, setSearchParams])

  const close = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete(param)
      return next
    }, { replace: false })
  }, [param, setSearchParams])

  return { isOpen, detailId, open, close }
}

/**
 * URL-synced modal state.
 *
 * Usage:
 *   const { isOpen, open, close } = useModal('dialer')
 *
 *   open()   → URL becomes ?dialer=true
 *   close()  → removes ?dialer from URL
 */
export function useModal(param) {
  const [searchParams, setSearchParams] = useSearchParams()
  const isOpen = searchParams.get(param) === 'true'

  const open = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set(param, 'true')
      return next
    }, { replace: false })
  }, [param, setSearchParams])

  const close = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete(param)
      return next
    }, { replace: false })
  }, [param, setSearchParams])

  return { isOpen, open, close }
}

/**
 * URL-synced tab state.
 *
 * Usage:
 *   const { activeTab, setTab } = useTab('tab', 'list')
 *
 *   setTab('builder')  → URL becomes ?tab=builder
 */
export function useTab(param = 'tab', defaultTab = '') {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get(param) || defaultTab

  const setTab = useCallback((tab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (tab === defaultTab) {
        next.delete(param)
      } else {
        next.set(param, tab)
      }
      return next
    }, { replace: true }) // replace, not push — tabs don't need back-button history
  }, [param, defaultTab, setSearchParams])

  return { activeTab, setTab }
}
