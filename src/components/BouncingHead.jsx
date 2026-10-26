import { useEffect, useRef, useState } from 'react'
import { POSES, SPRITE, TILTS, frame, nudge, release, step } from '../lib/bounce.js'

// Caleb's head bouncing around the screen as pixel art, facing the way it's travelling (maths in
// lib/bounce.js, sprite sheet from scripts/pixel-sprites.mjs). Grab it and throw it: it flies off
// the way it was flung, then settles back to its normal bounce. Each frame picks a sprite and
// writes it straight to the DOM, without re-rendering.
const SHEET = '/images/bounce-sprites.png'
const THROW_WINDOW = 90 // ms of pointer movement to measure a throw's speed from

// Whole-number scaling keeps every art pixel the same size on screen. Big Head Mode doubles it.
const pixelSize = () =>
  (innerWidth >= 600 ? 3 : 2) * (document.documentElement.hasAttribute('data-cheat-bighead') ? 2 : 1)

// Australia Mode turns the page (and the head with it) upside down, so the pointer's screen
// position has to be flipped to land in the head's own frame
function pointerAt(e) {
  const flipped = document.documentElement.hasAttribute('data-cheat-australia')
  return flipped ? [innerWidth - e.clientX, innerHeight - e.clientY] : [e.clientX, e.clientY]
}

// `chosen`: the visitor turned it on themselves (Head Mode), so it runs even with reduced motion
export default function BouncingHead({ chosen = false }) {
  const [on, setOn] = useState(false)
  const head = useRef(null)
  const state = useRef(null)
  // While held: where on the head it was grabbed, and recent pointer positions for the throw
  const held = useRef(null)

  // Only in the browser (not the prerendered HTML), and not for people who ask for reduced motion
  // unless they chose it
  useEffect(() => {
    if (chosen || !matchMedia('(prefers-reduced-motion: reduce)').matches) setOn(true)
  }, [chosen])

  useEffect(() => {
    if (!on) return
    const el = head.current
    let px = pixelSize()
    state.current = {
      x: Math.random() * Math.max(0, innerWidth - SPRITE.width * px),
      y: Math.random() * Math.max(0, innerHeight - SPRITE.height * px),
      travel: nudge(Math.random() * 360),
      squash: 0,
    }
    state.current.facing = state.current.travel
    let last = performance.now()
    let animation

    function tick(now) {
      // Capped, so it doesn't leap after the tab has been in the background
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      px = pixelSize()
      el.style.setProperty('--px', `${px}px`)
      const maxX = Math.max(0, innerWidth - SPRITE.width * px)
      const maxY = Math.max(0, innerHeight - SPRITE.height * px)
      // While it's held, the pointer moves it; otherwise it flies
      if (!held.current) state.current = step(state.current, dt, maxX, maxY)
      const s = state.current
      const { row, col, mirrored } = frame(s.facing)
      // Round to the screen's physical pixels so the sprite stays crisp. (Snapping to whole art
      // pixels, 2–3px, made it stop and jump on alternate frames, which looked like shaking.)
      const dpr = devicePixelRatio || 1
      const x = Math.round(s.x * dpr) / dpr
      const y = Math.round(s.y * dpr) / dpr
      el.style.transform = `translate(${x}px, ${y}px) scaleX(${mirrored ? -1 : 1})`
      el.style.backgroundPosition = `${-col * SPRITE.width * px}px ${-row * SPRITE.height * px}px`
      animation = requestAnimationFrame(tick)
    }
    animation = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animation)
  }, [on])

  function grab(e) {
    e.preventDefault()
    head.current.setPointerCapture(e.pointerId)
    const [px, py] = pointerAt(e)
    const s = state.current
    held.current = { dx: px - s.x, dy: py - s.y, samples: [[performance.now(), px, py]] }
    head.current.classList.add('held')
  }

  function drag(e) {
    const hold = held.current
    if (!hold) return
    const [px, py] = pointerAt(e)
    const size = pixelSize()
    const s = state.current
    const x = Math.min(Math.max(px - hold.dx, 0), Math.max(0, innerWidth - SPRITE.width * size))
    const y = Math.min(Math.max(py - hold.dy, 0), Math.max(0, innerHeight - SPRITE.height * size))
    // Face the way it's being dragged
    const moved = Math.hypot(x - s.x, y - s.y)
    const facing = moved > 1.5 ? (Math.atan2(y - s.y, x - s.x) * 180) / Math.PI : s.facing
    state.current = { ...s, x, y, facing }
    const now = performance.now()
    hold.samples = [...hold.samples, [now, px, py]].filter(([t]) => now - t <= THROW_WINDOW)
  }

  function letGo() {
    const hold = held.current
    if (!hold) return
    held.current = null
    head.current.classList.remove('held')
    // Throw speed: how far the pointer moved over the last few moments
    const [first, latest] = [hold.samples[0], hold.samples.at(-1)]
    const seconds = Math.max((latest[0] - first[0]) / 1000, 0.001)
    const recent = performance.now() - latest[0] < THROW_WINDOW
    const [vx, vy] = recent ? [(latest[1] - first[1]) / seconds, (latest[2] - first[2]) / seconds] : [0, 0]
    state.current = release(state.current, vx, vy)
  }

  if (!on) return null
  return (
    <div
      className="bounce-head"
      ref={head}
      aria-hidden="true"
      onPointerDown={grab}
      onPointerMove={drag}
      onPointerUp={letGo}
      onPointerCancel={letGo}
      style={{
        '--sheet': `url(${SHEET})`,
        '--cols': TILTS.length,
        '--rows': POSES.length,
        '--w': SPRITE.width,
        '--h': SPRITE.height,
      }}
    />
  )
}
