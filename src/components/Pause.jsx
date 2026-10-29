import { useEffect, useRef } from 'react'

// Pausing the games: a button above the game (components/GameBar.jsx) while one's being played, P or Escape on a keyboard,
// and switching to another tab or app. A paused game shows "Paused" over it and carries on where it
// left off. The game's own loop just doesn't move on while its phase is 'paused'.

// `onPause` and `onResume` are for anything a game needs to stop and start again (held keys and
// fingers let go of, Bonk's timers). Returns { pause, resume }.
export function usePause(phaseRef, setPhase, { onPause, onResume } = {}) {
  const hooks = useRef({})
  hooks.current = { onPause, onResume }
  // The phase ref changes straight away too, so the game loop stops this frame, not next render's
  function pause() {
    if (phaseRef.current !== 'playing') return
    phaseRef.current = 'paused'
    setPhase('paused')
    hooks.current.onPause?.()
  }
  function resume() {
    if (phaseRef.current !== 'paused') return
    phaseRef.current = 'playing'
    setPhase('playing')
    hooks.current.onResume?.()
  }
  useEffect(() => {
    function key(e) {
      if (!['p', 'P', 'Escape'].includes(e.key) || e.target.closest?.('input, textarea')) return
      if (phaseRef.current === 'playing') pause()
      else if (phaseRef.current === 'paused') resume()
      else return
      e.preventDefault()
    }
    const away = () => document.hidden && pause()
    addEventListener('keydown', key)
    document.addEventListener('visibilitychange', away)
    return () => {
      removeEventListener('keydown', key)
      document.removeEventListener('visibilitychange', away)
    }
  }, [])
  return { pause, resume }
}

// Taps on the overlay stay on it, so they don't flap, steer or fire in the game underneath
const keep = (e) => e.stopPropagation()

export function PauseButton({ onPause }) {
  return (
    <button type="button" className="game-tool game-pause" aria-label="Pause" onClick={onPause}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </svg>
    </button>
  )
}

export function Paused({ onResume }) {
  const button = useRef(null)
  useEffect(() => button.current?.focus(), [])
  return (
    <div className="game-overlay" onPointerDown={keep}>
      <h2>Paused</h2>
      <button type="button" className="button" ref={button} onClick={onResume}>
        Resume
      </button>
      <p className="game-paused-hint">or press P</p>
    </div>
  )
}
