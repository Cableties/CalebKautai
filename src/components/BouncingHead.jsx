import { useEffect, useRef, useState } from 'react'
import { POSES, SPRITE, TILTS, frame, nudge, step } from '../lib/bounce.js'

// Caleb's head bouncing around the screen as pixel art, facing the way it's travelling (maths in
// lib/bounce.js, sprite sheet from scripts/pixel-sprites.mjs). Each frame picks a sprite and
// writes it straight to the DOM, without re-rendering.
const SHEET = '/images/bounce-sprites.png'

// Whole-number scaling keeps every art pixel the same size on screen. Big Head Mode doubles it.
const pixelSize = () =>
  (innerWidth >= 600 ? 3 : 2) * (document.documentElement.hasAttribute('data-cheat-bighead') ? 2 : 1)

// `chosen`: the visitor turned it on themselves (Head Mode), so it runs even with reduced motion
export default function BouncingHead({ chosen = false }) {
  const [on, setOn] = useState(false)
  const head = useRef(null)

  // Only in the browser (not the prerendered HTML), and not for people who ask for reduced motion
  // unless they chose it
  useEffect(() => {
    if (chosen || !matchMedia('(prefers-reduced-motion: reduce)').matches) setOn(true)
  }, [chosen])

  useEffect(() => {
    if (!on) return
    const el = head.current
    let px = pixelSize()
    let state = {
      x: Math.random() * Math.max(0, innerWidth - SPRITE.width * px),
      y: Math.random() * Math.max(0, innerHeight - SPRITE.height * px),
      travel: nudge(Math.random() * 360),
      squash: 0,
    }
    state.facing = state.travel
    let last = performance.now()
    let animation

    function tick(now) {
      // Capped, so it doesn't leap after the tab has been in the background
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      px = pixelSize()
      el.style.setProperty('--px', `${px}px`)
      state = step(state, dt, Math.max(0, innerWidth - SPRITE.width * px), Math.max(0, innerHeight - SPRITE.height * px))
      const { row, col, mirrored } = frame(state.facing)
      // Round to the screen's physical pixels so the sprite stays crisp. (Snapping to whole art
      // pixels, 2–3px, made it stop and jump on alternate frames, which looked like shaking.)
      const dpr = devicePixelRatio || 1
      const x = Math.round(state.x * dpr) / dpr
      const y = Math.round(state.y * dpr) / dpr
      el.style.transform = `translate(${x}px, ${y}px) scaleX(${mirrored ? -1 : 1})`
      el.style.backgroundPosition = `${-col * SPRITE.width * px}px ${-row * SPRITE.height * px}px`
      animation = requestAnimationFrame(tick)
    }
    animation = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animation)
  }, [on])

  if (!on) return null
  return (
    <div
      className="bounce-head"
      ref={head}
      aria-hidden="true"
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
