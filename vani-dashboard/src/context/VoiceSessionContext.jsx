import { createContext, useContext, useState, useCallback, useRef } from 'react'

const VoiceSessionContext = createContext(null)

// Priority: monitor > dialer > playground
const PRIORITY = { monitor: 3, dialer: 2, playground: 1 }

export function VoiceSessionProvider({ children }) {
  const [session, setSession] = useState(null)
  // { type: 'dialer' | 'playground' | 'monitor', callId, stream, startedAt }
  const cleanupRef = useRef(null)

  const startSession = useCallback((type, config = {}) => {
    const newPriority = PRIORITY[type] || 0

    if (session) {
      const currentPriority = PRIORITY[session.type] || 0
      if (newPriority <= currentPriority && type !== session.type) {
        // Can't interrupt higher priority session
        return { blocked: true, reason: `End ${session.type} session first` }
      }
      // Auto-end lower priority session
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }

    const newSession = {
      type,
      callId: config.callId || null,
      stream: config.stream || null,
      startedAt: Date.now(),
    }

    if (config.onCleanup) {
      cleanupRef.current = config.onCleanup
    }

    setSession(newSession)
    return { blocked: false, session: newSession }
  }, [session])

  const endSession = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    setSession(null)
  }, [])

  const [micState, setMicState] = useState('unmuted')

  const toggleMic = useCallback(() => {
    setMicState(s => s === 'muted' ? 'unmuted' : 'muted')
  }, [])

  return (
    <VoiceSessionContext.Provider value={{
      session,
      micState,
      isActive: !!session,
      connectionState: session ? 'active' : 'idle',
      startSession,
      endSession,
      toggleMic,
    }}>
      {children}
    </VoiceSessionContext.Provider>
  )
}

export function useVoiceSession() {
  const ctx = useContext(VoiceSessionContext)
  if (!ctx) throw new Error('useVoiceSession must be used within VoiceSessionProvider')
  return ctx
}
