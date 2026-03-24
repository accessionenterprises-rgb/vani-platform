import { useEffect, useRef, useState } from 'react'
import { Device } from '@twilio/voice-sdk'
import { api } from '../api/client'

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
]

export default function DialerPage() {
  const [numbers, setNumbers]     = useState([])
  const [fromNumber, setFrom]     = useState('')
  const [input, setInput]         = useState('')
  const [status, setStatus]       = useState('idle') // idle | loading | ready | calling | active | error
  const [errorMsg, setErrorMsg]   = useState('')
  const [muted, setMuted]         = useState(false)
  const [duration, setDuration]   = useState(0)

  const deviceRef  = useRef(null)
  const callRef    = useRef(null)
  const timerRef   = useRef(null)

  // Load phone numbers + init device
  useEffect(() => {
    api.listNumbers().then(nums => {
      const twilioNums = nums.filter(n => n.provider === 'twilio' && n.status === 'active')
      setNumbers(twilioNums)
      if (twilioNums.length > 0) setFrom(twilioNums[0].number)
    }).catch(() => {})

    initDevice()
    return () => {
      deviceRef.current?.destroy()
      clearInterval(timerRef.current)
    }
  }, [])

  async function initDevice() {
    setStatus('loading')
    try {
      const { token } = await api.getDialerToken()
      const device = new Device(token, { logLevel: 1 })
      device.on('ready',        () => setStatus('ready'))
      device.on('error',        (e) => { setStatus('error'); setErrorMsg(e.message) })
      device.on('disconnect',   () => { setStatus('ready'); setDuration(0); clearInterval(timerRef.current) })
      device.on('tokenWillExpire', async () => {
        const { token: newToken } = await api.getDialerToken()
        device.updateToken(newToken)
      })
      deviceRef.current = device
      await device.register()
    } catch (e) {
      setStatus('error')
      setErrorMsg(e.message || 'Failed to initialize dialer')
    }
  }

  function pressKey(k) {
    setInput(prev => prev + k)
    if (callRef.current && status === 'active') {
      callRef.current.sendDigits(k)
    }
  }

  function backspace() {
    setInput(prev => prev.slice(0, -1))
  }

  async function dial() {
    if (!input || !deviceRef.current || status !== 'ready') return
    setStatus('calling')
    setDuration(0)
    try {
      const call = await deviceRef.current.connect({
        params: { To: input, From: fromNumber },
      })
      callRef.current = call
      call.on('accept',     () => {
        setStatus('active')
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
      })
      call.on('disconnect', () => {
        callRef.current = null
        setStatus('ready')
        setDuration(0)
        clearInterval(timerRef.current)
      })
      call.on('error', (e) => {
        setStatus('ready')
        setErrorMsg(e.message)
        callRef.current = null
      })
    } catch (e) {
      setStatus('ready')
      setErrorMsg(e.message || 'Call failed')
    }
  }

  function hangUp() {
    callRef.current?.disconnect()
    deviceRef.current?.disconnectAll()
  }

  function toggleMute() {
    if (!callRef.current) return
    const next = !muted
    callRef.current.mute(next)
    setMuted(next)
  }

  function formatDuration(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const isActive  = status === 'active'
  const isCalling = status === 'calling'

  return (
    <div className="flex-1 p-8 bg-[#FAFAF9] flex items-start justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-[#1A1816] text-2xl font-semibold mb-6">Dialer</h1>

        {/* From number picker */}
        <div className="mb-4">
          <label className="text-sm text-[#A8A29E] uppercase tracking-wide mb-1.5 block">Call from</label>
          {numbers.length === 0 ? (
            <p className="text-[#A8A29E] text-base">No Twilio numbers configured. Add one in Numbers.</p>
          ) : (
            <select
              value={fromNumber}
              onChange={e => setFrom(e.target.value)}
              disabled={isActive || isCalling}
              className="w-full bg-white border border-[#E8E5E2] text-[#1A1816] text-base rounded-lg px-3 py-2 focus:outline-none focus:border-[#2563EB] disabled:opacity-50"
            >
              {numbers.map(n => (
                <option key={n.id} value={n.number}>{n.number}</option>
              ))}
            </select>
          )}
        </div>

        {/* Main dialer card */}
        <div className="bg-white border border-[#E8E5E2] rounded-2xl p-5">
          {/* Status indicator */}
          <div className="flex items-center justify-between mb-4">
            <StatusDot status={status} />
            {isActive && (
              <span className="text-[#2563EB] font-mono text-base tabular-nums">
                {formatDuration(duration)}
              </span>
            )}
          </div>

          {/* Number display */}
          <div className="relative mb-4">
            <input
              type="tel"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="+1 (555) 000-0000"
              disabled={isActive || isCalling}
              className="w-full bg-[#FAFAF9] border border-[#E8E5E2] text-[#1A1816] text-xl text-center rounded-lg px-4 py-3 font-mono focus:outline-none focus:border-[#2563EB] placeholder:text-[#A8A29E] disabled:opacity-60"
            />
            {input && !isActive && !isCalling && (
              <button
                onClick={backspace}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#44403C] transition-colors"
              >
                <BackspaceIcon />
              </button>
            )}
          </div>

          {/* Dial pad */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {KEYS.flat().map(k => (
              <button
                key={k}
                onClick={() => pressKey(k)}
                disabled={status === 'loading' || status === 'error'}
                className="h-12 rounded-xl bg-[#F5F5F4] hover:bg-[#E8E5E2] active:scale-95 text-[#1A1816] text-xl font-medium transition-all disabled:opacity-40"
              >
                {k}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {(isActive || isCalling) ? (
              <>
                <button
                  onClick={toggleMute}
                  className={`flex-1 h-12 rounded-xl text-base font-medium transition-all ${
                    muted
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-[#F5F5F4] text-[#78716C] hover:text-[#44403C]'
                  }`}
                >
                  {muted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={hangUp}
                  className="flex-1 h-12 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-base font-medium border border-red-500/20 transition-all active:scale-95"
                >
                  End Call
                </button>
              </>
            ) : (
              <button
                onClick={dial}
                disabled={!input || status !== 'ready'}
                className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-40 text-white text-base font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CallIcon />
                {status === 'loading' ? 'Connecting...' : 'Call'}
              </button>
            )}
          </div>

          {/* Error */}
          {errorMsg && (
            <p className="mt-3 text-red-400 text-sm text-center">{errorMsg}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }) {
  const map = {
    idle:     { color: 'bg-slate-500', label: 'Initializing' },
    loading:  { color: 'bg-amber-400 animate-pulse', label: 'Connecting' },
    ready:    { color: 'bg-emerald-400', label: 'Ready' },
    calling:  { color: 'bg-indigo-400 animate-pulse', label: 'Calling...' },
    active:   { color: 'bg-emerald-400 animate-pulse', label: 'On Call' },
    error:    { color: 'bg-red-400', label: 'Error' },
  }
  const { color, label } = map[status] || map.idle
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[#A8A29E] text-sm">{label}</span>
    </div>
  )
}

function CallIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73A16 16 0 0 0 15.27 16.09l1.92-1.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}

function BackspaceIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
      <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
    </svg>
  )
}
