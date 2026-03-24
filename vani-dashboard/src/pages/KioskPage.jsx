/**
 * Kiosk Page — Emma avatar + product showcase
 *
 * URL: /kiosk?agent=<agentId>&key=<apiKey>
 *
 * Flow:
 *   1. Idle — Emma waiting, visitor taps Start
 *   2. Session — joins LiveKit room, agent dispatched, conversation starts
 *   3. Product shown — agent calls __show_product → avatar shrinks to pip corner,
 *      product image + details fill the screen
 *   4. Clear — __clear_product → avatar returns to full screen
 *   5. End — visitor taps End or call times out → back to idle
 *
 * LiveKit data channel messages:
 *   { type: "show_product", product: { name, description, image_url, ... } }
 *   { type: "clear_product" }
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Room, RoomEvent, DataPacket_Kind } from 'livekit-client'

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:8001'

// ── States ───────────────────────────────────────────────────────────────────
const STATE = { IDLE: 'idle', CONNECTING: 'connecting', ACTIVE: 'active', ENDING: 'ending' }

export default function KioskPage() {
  const [params]        = useSearchParams()
  const agentId         = params.get('agent') || ''
  const apiKey          = params.get('key') || ''

  const [state, setState]           = useState(STATE.IDLE)
  const [product, setProduct]       = useState(null)   // currently shown product
  const [transcript, setTranscript] = useState([])     // live transcript lines
  const [error, setError]           = useState('')

  const roomRef    = useRef(null)
  const txScrollRef = useRef(null)

  // Auto-scroll transcript
  useEffect(() => {
    if (txScrollRef.current) {
      txScrollRef.current.scrollTop = txScrollRef.current.scrollHeight
    }
  }, [transcript])

  // Cleanup on unmount
  useEffect(() => {
    return () => { roomRef.current?.disconnect() }
  }, [])

  const handleDataMessage = useCallback((payload) => {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload))
      if (msg.type === 'show_product') {
        setProduct(msg.product)
      } else if (msg.type === 'clear_product') {
        setProduct(null)
      }
    } catch (_) {}
  }, [])

  async function startSession() {
    if (!agentId || !apiKey) {
      setError('Missing agent or API key in URL. Use /kiosk?agent=ID&key=YOUR_KEY')
      return
    }
    setError('')
    setState(STATE.CONNECTING)
    setProduct(null)
    setTranscript([])

    try {
      // 1. Create session via orchestrator
      const res = await fetch(`${ORCHESTRATOR_URL}/kiosk/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ agent_id: agentId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const { room_name, token, livekit_url } = await res.json()

      // 2. Connect to LiveKit room
      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      room.on(RoomEvent.DataReceived, (payload) => handleDataMessage(payload))

      room.on(RoomEvent.TrackSubscribed, (track) => {
        // Audio from agent — auto-play
        if (track.kind === 'audio') {
          track.attach()
        }
      })

      room.on(RoomEvent.Disconnected, () => {
        setState(STATE.IDLE)
        setProduct(null)
      })

      // Simulate transcript from data channel (agent sends transcript events)
      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload))
          if (msg.type === 'transcript') {
            setTranscript(prev => [...prev, msg])
          }
        } catch (_) {}
      })

      await room.connect(livekit_url, token)
      await room.startAudio()
      setState(STATE.ACTIVE)

    } catch (err) {
      setError(err.message)
      setState(STATE.IDLE)
    }
  }

  async function endSession() {
    setState(STATE.ENDING)
    await roomRef.current?.disconnect()
    roomRef.current = null
    setProduct(null)
    setTranscript([])
    setState(STATE.IDLE)
  }

  const isActive = state === STATE.ACTIVE

  return (
    <div className="fixed inset-0 bg-[#FAFAF9] flex flex-col overflow-hidden select-none">

      {/* ── Idle screen ───────────────────────────────────────────────────── */}
      {state === STATE.IDLE && (
        <IdleScreen onStart={startSession} error={error} hasConfig={!!(agentId && apiKey)} />
      )}

      {/* ── Connecting ────────────────────────────────────────────────────── */}
      {state === STATE.CONNECTING && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-[#1A1816] text-lg font-medium">Connecting…</p>
        </div>
      )}

      {/* ── Active session ────────────────────────────────────────────────── */}
      {(state === STATE.ACTIVE || state === STATE.ENDING) && (
        <ActiveSession
          product={product}
          transcript={transcript}
          txScrollRef={txScrollRef}
          onEnd={endSession}
          ending={state === STATE.ENDING}
        />
      )}
    </div>
  )
}


// ─── Idle Screen ──────────────────────────────────────────────────────────────

function IdleScreen({ onStart, error, hasConfig }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
      {/* Avatar */}
      <div className="relative">
        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-2xl shadow-blue-300/50">
          <span className="text-7xl font-bold text-[#1A1816]">E</span>
        </div>
        {/* Idle pulse ring */}
        <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30 animate-ping" />
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#1A1816] mb-2">Hi, I'm Emma</h1>
        <p className="text-[#78716C] text-lg">Your AI product guide. Tap to start a conversation.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 text-red-400 text-sm max-w-md text-center">
          {error}
        </div>
      )}

      <button
        onClick={onStart}
        disabled={!hasConfig}
        className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white font-semibold text-lg px-12 py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-300/40"
      >
        Start Conversation
      </button>

      {!hasConfig && (
        <p className="text-[#A8A29E] text-xs">Configure via URL: /kiosk?agent=ID&key=API_KEY</p>
      )}
    </div>
  )
}


// ─── Active Session ───────────────────────────────────────────────────────────

function ActiveSession({ product, transcript, txScrollRef, onEnd, ending }) {
  const showProduct = !!product

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex relative overflow-hidden">

        {/* Avatar — full screen when no product, pip when product shown */}
        <div className={`transition-all duration-500 ease-in-out flex items-center justify-center ${
          showProduct
            ? 'absolute bottom-6 left-6 w-44 h-44 z-20 rounded-2xl overflow-hidden shadow-2xl border border-[#E8E5E2]'
            : 'flex-1'
        }`}>
          <div className={`bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center ${
            showProduct ? 'w-full h-full' : 'w-64 h-64 rounded-full shadow-2xl shadow-blue-300/60'
          }`}>
            <span className={`font-bold text-white ${showProduct ? 'text-4xl' : 'text-8xl'}`}>E</span>
          </div>
          {/* Speaking indicator */}
          <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
            <SpeakingWave />
          </div>
        </div>

        {/* Product showcase — slides in from right when product shown */}
        {showProduct && (
          <div className="flex-1 flex flex-col items-center justify-center p-10 animate-[fadeIn_0.4s_ease-out]">
            <ProductCard product={product} />
          </div>
        )}
      </div>

      {/* ── Transcript strip ──────────────────────────────────────────────── */}
      {transcript.length > 0 && (
        <div
          ref={txScrollRef}
          className="h-28 px-6 py-3 bg-white/80 backdrop-blur border-t border-[#F0EDEA] overflow-y-auto space-y-1"
        >
          {transcript.map((line, i) => (
            <p key={i} className={`text-sm ${line.speaker === 'agent' ? 'text-[#3B82F6]' : 'text-[#44403C]'}`}>
              <span className="text-[#A8A29E] text-xs mr-2">{line.speaker === 'agent' ? 'Emma' : 'You'}</span>
              {line.text}
            </p>
          ))}
        </div>
      )}

      {/* ── End button ────────────────────────────────────────────────────── */}
      <div className="absolute top-5 right-5">
        <button
          onClick={onEnd}
          disabled={ending}
          className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
        >
          {ending ? 'Ending…' : 'End'}
        </button>
      </div>
    </div>
  )
}


// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product }) {
  return (
    <div className="w-full max-w-lg">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full max-h-72 object-contain rounded-2xl mb-6 bg-[#F5F5F4]"
        />
      ) : (
        <div className="w-full h-56 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center mb-6">
          <span className="text-6xl">📦</span>
        </div>
      )}
      <h2 className="text-3xl font-bold text-[#1A1816] mb-3">{product.name}</h2>
      {product.description && (
        <p className="text-[#44403C] text-lg leading-relaxed">{product.description}</p>
      )}
    </div>
  )
}


// ─── Speaking Wave ────────────────────────────────────────────────────────────

function SpeakingWave() {
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="w-1 bg-white/60 rounded-full animate-pulse"
          style={{
            height: `${40 + Math.random() * 60}%`,
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${0.6 + Math.random() * 0.4}s`,
          }}
        />
      ))}
    </div>
  )
}
