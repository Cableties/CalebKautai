import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { SPRITE } from '../lib/bounce.js'

// The cheat codes that need more than CSS (components/Cheats.jsx switches them on and off).

// Matrix Mode: green characters raining down behind the page. Drawn ~20 times a second, which is
// plenty for the effect and easy on phones.
export function MatrixRain() {
  const canvas = useRef(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el.getContext('2d')
    const glyphs = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789CALEBKAUTAI'
    const size = 16
    let drops = []
    let timer

    function fit() {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      el.width = innerWidth * dpr
      el.height = innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drops = Array.from({ length: Math.ceil(innerWidth / size) }, () => Math.random() * -50)
    }
    function draw() {
      ctx.fillStyle = 'rgb(0 0 0 / 0.12)'
      ctx.fillRect(0, 0, innerWidth, innerHeight)
      ctx.font = `${size}px ui-monospace, monospace`
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() < 0.04 ? '#d6ffe3' : '#33ff77'
        ctx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], i * size, y * size)
        drops[i] = y * size > innerHeight && Math.random() > 0.97 ? 0 : y + 1
      })
    }
    fit()
    timer = setInterval(draw, 50)
    addEventListener('resize', fit)
    return () => {
      clearInterval(timer)
      removeEventListener('resize', fit)
    }
  }, [])

  return <canvas className="matrix-rain" ref={canvas} aria-hidden="true" />
}

// Head Trail: tiny pixel heads following the cursor, or a finger dragging on a phone. They live
// outside #root, so they line up with the pointer even when Australia Mode has flipped the page.
export function HeadTrail() {
  useEffect(() => {
    let last = 0
    let lastX = 0
    function drop(x, y) {
      const now = performance.now()
      if (now - last < 45) return
      last = now
      const head = document.createElement('div')
      head.className = 'head-trail'
      // The profile pose, untilted, from the bouncing head's sprite sheet
      head.style.backgroundPosition = `${-2 * SPRITE.width}px ${-2 * SPRITE.height}px`
      const flip = x < lastX ? -1 : 1
      lastX = x
      const at = `translate(${x - SPRITE.width / 2}px, ${y - SPRITE.height / 2}px) scaleX(${flip})`
      document.body.append(head)
      head
        .animate(
          [
            { transform: `${at} scale(1)`, opacity: 1 },
            { transform: `${at} translateY(10px) scale(0.3)`, opacity: 0 },
          ],
          { duration: 700, easing: 'ease-out' },
        )
        .finished.then(() => head.remove(), () => head.remove())
    }
    const onPointer = (e) => e.pointerType !== 'touch' && drop(e.clientX, e.clientY)
    const onTouch = (e) => drop(e.touches[0].clientX, e.touches[0].clientY)
    addEventListener('pointermove', onPointer, { passive: true })
    addEventListener('touchmove', onTouch, { passive: true })
    return () => {
      removeEventListener('pointermove', onPointer)
      removeEventListener('touchmove', onTouch)
      document.querySelectorAll('.head-trail').forEach((h) => h.remove())
    }
  }, [])
  return null
}

// 8-bit Mode: an SVG filter that turns photos into chunky blocks (styles.css applies it to images)
export function PixelFilter() {
  return createPortal(
    <svg className="pixel-filter" aria-hidden="true" width="0" height="0">
      <filter id="cheat-pixelate" x="0" y="0" width="100%" height="100%">
        <feFlood x="2" y="2" width="1" height="1" />
        <feComposite width="6" height="6" />
        <feTile result="grid" />
        <feComposite in="SourceGraphic" in2="grid" operator="in" />
        <feMorphology operator="dilate" radius="3" />
      </filter>
    </svg>,
    document.body,
  )
}

// Gravity Mode: tapping something knocks it loose; it falls to the bottom of the screen, bounces
// and lands. The header, the cheat switches and forms keep working so you can get back out.
// Switching the cheat off (or changing page) puts everything back.
const FALLS = 'img, h1, h2, h3, p, a, button, li, figure, blockquote, .card, .project, .choice, .map, .holo'
const STAYS = '.site-header, .cheat-switch, .cheats .button, .player, .hack, .cheat-toast, form, .review-form'

export function Gravity({ on, pathname }) {
  const fallen = useRef(new Map())

  function restore() {
    for (const [el, style] of fallen.current) {
      el.getAnimations().forEach((a) => a.cancel())
      el.style.position = style.position
      el.style.zIndex = style.zIndex
    }
    fallen.current.clear()
  }

  useEffect(() => {
    if (!on) return restore()
    function knock(e) {
      if (e.target.closest(STAYS)) return
      const el = e.target.closest(FALLS)
      if (!el || !el.closest('main') || fallen.current.has(el)) return
      e.preventDefault()
      e.stopPropagation()
      fallen.current.set(el, { position: el.style.position, zIndex: el.style.zIndex })
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
      el.style.zIndex = '30'
      const box = el.getBoundingClientRect()
      const floor = Math.max(40, innerHeight - box.bottom - 4)
      const spin = (Math.random() * 2 - 1) * 28
      const at = (y, turn) => ({ transform: `translateY(${y}px) rotate(${spin * turn}deg)` })
      el.animate(
        [
          { transform: 'none', easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
          { ...at(floor, 1), offset: 0.55, easing: 'ease-out' },
          { ...at(floor - Math.min(60, floor / 4), 1.3), offset: 0.72, easing: 'ease-in' },
          { ...at(floor, 1.5), offset: 0.86, easing: 'ease-out' },
          { ...at(floor - 12, 1.6), offset: 0.93, easing: 'ease-in' },
          at(floor, 1.6),
        ],
        { duration: 900 + floor * 0.6, fill: 'forwards' },
      )
    }
    document.addEventListener('click', knock, true)
    return () => document.removeEventListener('click', knock, true)
  }, [on])

  // A new page starts tidy
  useEffect(() => () => fallen.current.clear(), [pathname])

  return null
}
