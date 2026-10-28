import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS } from '../lib/bounce.js'
import { cheatOn, gameHead } from '../lib/gameHead.js'
import {
  COLOURS,
  HEIGHT,
  HUD,
  LAUNCHER,
  LINE_Y,
  R,
  RAINBOW,
  SETTINGS,
  WIDTH,
  aimAt,
  aimed,
  bubblesGame,
  centre,
  fire,
  launcherX,
  start,
  step,
  swap,
} from '../lib/bubbles.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import GameSettings, { useGameSettings } from '../components/GameSettings.jsx'
import { PauseButton, Paused, usePause } from '../components/Pause.jsx'
import SoundToggle from '../components/SoundToggle.jsx'
import useWide, { WIDE_WIDTH } from '../components/useWide.js'
import { useCheats } from '../components/Cheats.jsx'
import { feedback } from '../lib/feedback.js'
import { approach, themeAt } from '../lib/themes.js'

// Bubbles: a bubble shooter, with the head in the launcher, looking where it aims. The rules are in
// lib/bubbles.js; this draws them on a canvas and handles input: point (or drag a finger) to aim and
// let go to fire, tap the next bubble to swap it in; or the arrow keys, Space to fire and Down to
// swap. Settings are behind the cog, and each mix has its own high scores. The aiming guide has its
// own button, to switch on and off mid-game (or press G).
const LEFT_KEYS = ['ArrowLeft', 'a', 'A']
const RIGHT_KEYS = ['ArrowRight', 'd', 'D']
const FIRE_KEYS = [' ', 'ArrowUp', 'w', 'W', 'Enter']
const SWAP_KEYS = ['ArrowDown', 's', 'S']
const NEXT = { dx: 56, r: R * 0.75 } // the next bubble, beside the launcher
const INK = '#2e2a45'
const GUIDE_KEYS = ['g', 'G']
// Each level its own sky, going round: lavender with clouds, underwater with bubbles rising, a
// sunset, a spring morning, and a starry night. The numbers fade each one's bits in and out.
const LEVELS = [
  { top: '#dcd2f7', bottom: '#d4ecf7', ceiling: '#b9a9e8', dots: '#2e2a45', clouds: 1, rising: 0, sun: 0, stars: 0 },
  { top: '#a9dcf0', bottom: '#6fb7dc', ceiling: '#4f97c4', dots: '#16365a', clouds: 0, rising: 1, sun: 0, stars: 0 },
  { top: '#ffd3b6', bottom: '#f7b0cc', ceiling: '#ee8fa6', dots: '#2e2a45', clouds: 0, rising: 0, sun: 1, stars: 0 },
  { top: '#d9f3e2', bottom: '#fdf2c2', ceiling: '#9fd8b4', dots: '#2e2a45', clouds: 1, rising: 0, sun: 0, stars: 0 },
  { top: '#2f2a63', bottom: '#5c4c9c', ceiling: '#211d4b', dots: '#ffffff', clouds: 0, rising: 0, sun: 0, stars: 1 },
]
const noise = (i, n) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1

// The level's sky and what's in it
function backdrop(ctx, W, theme, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  sky.addColorStop(0, theme.top)
  sky.addColorStop(1, theme.bottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, HEIGHT)
  if (theme.sun > 0) {
    ctx.globalAlpha = theme.sun * 0.8
    ctx.fillStyle = '#ffe9a0'
    ctx.beginPath()
    ctx.arc(W / 2, LINE_Y - 10, 120, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 30; i++) {
    const x = noise(i, 1) * W
    if (theme.stars > 0) {
      ctx.globalAlpha = theme.stars * (0.5 + 0.5 * Math.sin(time * 2 + i))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x, HUD + noise(i, 2) * (LINE_Y - HUD), 2, 2)
    }
    if (theme.rising > 0) {
      // Little bubbles rising, swaying as they go
      const y = HEIGHT - ((time * (20 + noise(i, 3) * 30) + noise(i, 4) * HEIGHT) % (HEIGHT - HUD))
      ctx.globalAlpha = theme.rising * 0.5
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x + Math.sin(time * 2 + i) * 6, y, 2 + noise(i, 5) * 4, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (theme.clouds > 0 && i < 5) {
      const cx = ((x + time * 8) % (W + 120)) - 60
      const cy = 200 + noise(i, 6) * 300
      ctx.globalAlpha = theme.clouds * 0.6
      ctx.fillStyle = '#ffffff'
      for (const [dx, dy, r] of [[0, 0, 26], [24, 6, 20], [-24, 8, 18]]) {
        ctx.beginPath()
        ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.globalAlpha = 1
}

function bubble(ctx, x, y, colour, r = R) {
  if (colour === RAINBOW) {
    // A rainbow: a slice of every colour
    COLOURS.forEach((c, i) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.arc(x, y, r, (i / COLOURS.length) * Math.PI * 2, ((i + 1) / COLOURS.length) * Math.PI * 2)
      ctx.fill()
    })
  } else {
    ctx.fillStyle = COLOURS[colour]
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, r - 1, 0, Math.PI * 2)
  ctx.stroke()
  // The shine
  ctx.fillStyle = 'rgb(255 255 255 / 0.55)'
  ctx.beginPath()
  ctx.ellipse(x - r * 0.35, y - r * 0.38, r * 0.32, r * 0.2, -0.6, 0, Math.PI * 2)
  ctx.fill()
}

// What's on a power-up bubble
function power(ctx, kind, x, y, time) {
  ctx.lineWidth = 2
  if (kind === 'bomb') {
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.arc(x, y + 2, R * 0.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.beginPath()
    ctx.moveTo(x + 4, y - 4)
    ctx.quadraticCurveTo(x + 8, y - 10, x + 5, y - 13)
    ctx.stroke()
    ctx.fillStyle = Math.sin(time * 20) > 0 ? '#ffe27a' : '#ff8a4c'
    ctx.fillRect(x + 3, y - 16, 4, 4)
  } else if (kind === 'bolt') {
    ctx.fillStyle = '#ffe27a'
    ctx.strokeStyle = INK
    ctx.beginPath()
    for (const [px, py] of [[2, -11], [-6, 1], [-1, 1], [-3, 11], [6, -2], [1, -2]]) ctx.lineTo(x + px, y + py)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = INK
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? 4.5 : 10
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

// `level`: which level's look, fading from one to the next as each is cleared
function draw(ctx, game, head, looks, time, level) {
  const W = game.width // the screen's width: wider on a desktop
  const theme = themeAt(LEVELS, level).palette
  backdrop(ctx, W, theme, time)

  // The ceiling, lower with each drop
  const [, firstY] = centre(game, 0, 0)
  ctx.fillStyle = theme.ceiling
  ctx.fillRect(0, HUD, W, firstY - R - HUD)
  ctx.fillStyle = INK
  ctx.fillRect(0, firstY - R - 3, W, 3)

  // The line not to cross
  ctx.strokeStyle = 'rgb(232 66 63 / 0.5)'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 8])
  ctx.beginPath()
  ctx.moveTo(0, LINE_Y)
  ctx.lineTo(W, LINE_Y)
  ctx.stroke()
  ctx.setLineDash([])

  // The bubbles
  game.grid.forEach((row, r) =>
    row.forEach((b, c) => {
      if (!b) return
      const [x, y] = centre(game, r, c)
      bubble(ctx, x, y, b.colour)
      if (b.power) power(ctx, b.power, x, y, time)
    }),
  )
  // Pops burst into a ring; drops fall
  for (const p of game.pops) {
    ctx.globalAlpha = 1 - p.age / 0.3
    ctx.strokeStyle = COLOURS[p.colour] ?? '#fff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(p.x, p.y, R * (1 + p.age * 4), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  for (const f of game.falls) bubble(ctx, f.x, f.y, f.colour)

  // The aim: the whole path, off the walls and all, and a ghost of the loaded bubble where it'll
  // land (or just a few dots, with the guide switched off). Not while a shot's already flying.
  if (!game.shot && !game.over) {
    const { points, cell } = aimed(game, game.guide ? Infinity : 140)
    ctx.fillStyle = theme.dots
    ctx.globalAlpha = 0.5
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1]
      const [bx, by] = points[i]
      const length = Math.hypot(bx - ax, by - ay)
      for (let d = 18; d < length; d += 16) ctx.fillRect(ax + ((bx - ax) * d) / length - 2, ay + ((by - ay) * d) / length - 2, 4, 4)
    }
    ctx.globalAlpha = 1
    if (cell) {
      const [gx, gy] = centre(game, cell.r, cell.c)
      ctx.globalAlpha = 0.4 + 0.15 * Math.sin(time * 6)
      bubble(ctx, gx, gy, game.rainbow ? RAINBOW : game.ammo[0])
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.arc(gx, gy, R + 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // The launcher, with the head beside it looking where it aims, and the next bubble
  const lx = launcherX(game)
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(lx, LAUNCHER.y + 22, 34, Math.PI, 0)
  ctx.fill()
  ctx.save()
  ctx.translate(lx, LAUNCHER.y)
  ctx.rotate(game.aim)
  ctx.fillStyle = '#fff'
  ctx.fillRect(-3, -R - 22, 6, 16)
  ctx.restore()
  if (!game.shot && !game.over) bubble(ctx, lx, LAUNCHER.y, game.rainbow ? RAINBOW : game.ammo[0])
  if (game.ammo[1] != null) bubble(ctx, lx + NEXT.dx, LAUNCHER.y + 16, game.ammo[1], NEXT.r)
  looks.draw(ctx, head, {
    x: lx - 58,
    y: LAUNCHER.y + 8,
    size: 30,
    facing: (game.aim * 180) / Math.PI - 90,
    time,
  })
  if (game.shot) bubble(ctx, game.shot.x, game.shot.y, game.shot.colour)

  // Power-ups just set off, their names floating up
  ctx.font = '800 16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 4
  for (const l of game.labels) {
    ctx.globalAlpha = Math.min(1, 2 * (1.2 - l.age))
    const x = Math.min(Math.max(l.x, 70), W - 70)
    ctx.strokeStyle = INK
    ctx.strokeText(l.text, x, l.y - l.age * 40)
    ctx.fillStyle = '#ffe27a'
    ctx.fillText(l.text, x, l.y - l.age * 40)
  }
  ctx.globalAlpha = 1

  // The score strip
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, HUD)
  ctx.font = '800 20px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.fillText(String(game.score), 14, HUD / 2 + 1)
  ctx.textAlign = 'center'
  ctx.font = '700 15px system-ui, sans-serif'
  ctx.fillText(`Level ${game.level}`, W / 2, HUD / 2 + 1)
}

// What happened this frame, for the sounds (and buzzes)
function effects(g) {
  if (g.fired) feedback('kicker')
  if (g.cleared) feedback('wave')
  else if (g.powered) feedback('bonus')
  else if (g.dropped) feedback('point')
  else if (g.popped) feedback('boom')
  else if (g.stuck) feedback('flip')
  if (g.lowered) feedback('whiff')
}

// The aiming guide, on to start with and remembered in this browser. Returns [on, toggle(), ref]:
// toggle returns the new setting, and the ref is for the game loop and key handler.
function useGuide() {
  const [on, setOn] = useState(true)
  const ref = useRef(on)
  useEffect(() => {
    try {
      if (localStorage.getItem('bubbles-guide') === 'off') {
        ref.current = false
        setOn(false)
      }
    } catch {
      // Storage blocked: on, then
    }
  }, [])
  function toggle() {
    ref.current = !ref.current
    setOn(ref.current)
    try {
      localStorage.setItem('bubbles-guide', ref.current ? 'on' : 'off')
    } catch {
      // Not remembered, then
    }
    return ref.current
  }
  return [on, toggle, ref]
}

// The aiming guide's button: a target, crossed out while it's off. Taps on it stay on it, so they
// don't aim or fire.
function GuideButton({ on, onToggle }) {
  return (
    <button
      type="button"
      className="game-guide"
      aria-label="Aiming guide"
      aria-pressed={on}
      title={`Aiming guide: ${on ? 'on' : 'off'} (G)`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        onToggle()
        // Let go of focus after a tap or click, so Space fires rather than pressing it again
        if (e.detail) e.currentTarget.blur()
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        {!on && <path d="M4 4l16 16" />}
      </svg>
    </button>
  )
}

export default function Bubbles() {
  const canvas = useRef(null)
  const stage = useRef(null)
  const game = useRef(null)
  const input = useRef({})
  const aiming = useRef(false) // a finger's down, aiming: it fires when it lets go
  const head = useRef(null)
  const looks = useRef(null)
  const { player } = useCheats()
  const [phase, setPhase] = useState('ready') // ready | playing | over
  // A wider board on a wide window (components/useWide.js), picked as each game is set up
  const wide = useWide()
  const wideRef = useRef(wide)
  wideRef.current = wide
  const [boardWide, setBoardWide] = useState(false)
  const [score, setScore] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [scores, setScores] = useState(null)
  const [settings, toggleSetting, settingsRef] = useGameSettings('bubbles', SETTINGS)
  const [guide, toggleGuide, guideRef] = useGuide()
  const level = useRef(0) // the level whose look is showing (lib/themes.js), fading to the next
  const GAME = bubblesGame(settings)
  const [best, record] = useBest(GAME)
  const { run, begin } = useRun(GAME)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const { pause, resume } = usePause(phaseRef, setPhase, {
    // Let go of anything held, so it isn't still held on the way back
    onPause: () => {
      input.current = {}
      aiming.current = false
    },
  })
  // In refs, since the game loop and key handler are set up once
  const recordRef = useRef(record)
  recordRef.current = record
  const beginRef = useRef(begin)
  beginRef.current = begin

  const fresh = () => {
    setBoardWide(wideRef.current)
    return start({
      ...settingsRef.current,
      guide: guideRef.current,
      easy: cheatOn('easy'),
      width: wideRef.current ? WIDE_WIDTH : WIDTH,
    })
  }

  // New settings (or the saved ones, once they load), or a different shaped window: a fresh board
  useEffect(() => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') return
    game.current = fresh()
    setScores(null)
    setScore(0)
    setPhase('ready')
  }, [GAME, wide])

  useEffect(() => {
    const sheet = new Image()
    sheet.src = HEADS[player].sheet
    head.current = { sheet, sprite: HEADS[player].sprite }
  }, [player])

  useEffect(() => {
    looks.current = gameHead()
    game.current = fresh()
    const el = canvas.current
    const ctx = el.getContext('2d')
    let last = performance.now()
    let animation

    function resize() {
      const ratio = devicePixelRatio || 1
      el.width = Math.round(el.clientWidth * ratio)
      el.height = Math.round(el.clientHeight * ratio)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)

    function tick(now) {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      if (phaseRef.current === 'playing') {
        const before = game.current
        game.current = step(before, dt, input.current)
        const g = game.current
        effects(g)
        if (g.score !== before.score) setScore(g.score)
        if (g.over) {
          feedback('splat')
          setPhase('over')
          setNewBest(!g.easy && recordRef.current(g.score))
        }
      }
      ctx.setTransform(el.width / game.current.width, 0, 0, el.height / HEIGHT, 0, 0)
      level.current = approach(level.current, game.current.level - 1, dt)
      draw(ctx, game.current, head.current, looks.current, now / 1000, level.current)
      animation = requestAnimationFrame(tick)
    }
    animation = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(animation)
      observer.disconnect()
    }
  }, [])

  function play() {
    stage.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    game.current = fresh()
    setScore(0)
    setNewBest(false)
    setPhase('playing')
    beginRef.current()
  }
  // The aiming guide on or off, there and then
  function switchGuide() {
    const on = toggleGuide()
    if (game.current) game.current = { ...game.current, guide: on }
  }
  function shoot() {
    if (phaseRef.current !== 'playing') return
    game.current = fire(game.current)
    effects(game.current)
  }

  // Where a pointer is on the board (Australia Mode has the page upside down, so it's flipped)
  function at(e) {
    const box = stage.current.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * game.current.width
    const y = ((e.clientY - box.top) / box.height) * HEIGHT
    return document.documentElement.hasAttribute('data-cheat-australia') ? [game.current.width - x, HEIGHT - y] : [x, y]
  }
  function down(e) {
    e.preventDefault()
    if (phaseRef.current === 'ready') return play()
    if (phaseRef.current !== 'playing') return
    const [x, y] = at(e)
    // The next bubble: swap it in
    if (Math.hypot(x - (launcherX(game.current) + NEXT.dx), y - (LAUNCHER.y + 16)) < NEXT.r + 10) {
      game.current = swap(game.current)
      feedback('flip')
      return
    }
    stage.current.setPointerCapture(e.pointerId)
    aiming.current = true
    game.current = aimAt(game.current, x, y)
  }
  function move(e) {
    // A mouse aims just by moving over it; a finger while it's down
    if (!aiming.current && e.pointerType !== 'mouse') return
    if (phaseRef.current !== 'playing') return
    game.current = aimAt(game.current, ...at(e))
  }
  function up() {
    if (!aiming.current) return
    aiming.current = false
    shoot()
  }

  useEffect(() => {
    function key(e) {
      const pressed = e.type === 'keydown'
      if (e.target.closest?.('input, textarea, button, a')) return
      if (FIRE_KEYS.includes(e.key)) {
        e.preventDefault()
        if (!pressed) return
        if (phaseRef.current === 'ready') play()
        else shoot()
        return
      }
      if (GUIDE_KEYS.includes(e.key)) {
        if (pressed && phaseRef.current !== 'over') switchGuide()
        return
      }
      if (SWAP_KEYS.includes(e.key)) {
        e.preventDefault()
        if (pressed && phaseRef.current === 'playing') game.current = swap(game.current)
        return
      }
      const which = LEFT_KEYS.includes(e.key) ? 'left' : RIGHT_KEYS.includes(e.key) ? 'right' : null
      if (!which) return
      e.preventDefault()
      input.current = { ...input.current, [which]: pressed }
    }
    addEventListener('keydown', key)
    addEventListener('keyup', key)
    return () => {
      removeEventListener('keydown', key)
      removeEventListener('keyup', key)
    }
  }, [])

  return (
    <article className="page game-page">
      <p className="game-back">
        <Link to="/games" viewTransition>
          ← All games
        </Link>
        <SoundToggle />
      </p>
      <h1 className="page-title">Bubbles</h1>
      <p className="lede">
        Aim with your finger (or the arrow keys) and let go to fire. Three of a colour pop. Tap the next bubble, or press
        Down, to swap it in. The target button (or G) switches the aiming guide on and off.
      </p>

      <div className="game-layout">
        <div
          className={`game-stage swipe-stage${boardWide ? ' wide' : ''}`}
          ref={stage}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => (aiming.current = false)}
        >
          <canvas ref={canvas} className="game-canvas" role="img" aria-label={`Bubbles. Score: ${score}`} />
          {phase === 'ready' && (
            <div className="game-overlay game-overlay-hint">
              <p>Tap to start</p>
            </div>
          )}
          {phase === 'over' && (
            <div className="game-overlay" onPointerDown={(e) => e.stopPropagation()}>
              <h2>Too low!</h2>
              <p className="game-final" role="status">
                Score: <strong>{score}</strong>
                {newBest ? ' · New best!' : best ? ` · Best: ${best}` : ''}
              </p>
              <ScoreEntry game={GAME} score={score} run={run} easy={game.current?.easy} onSaved={setScores} />
              <button type="button" className="button" onClick={play}>
                Play again
              </button>
            </div>
          )}
          {phase === 'playing' && <PauseButton onPause={pause} />}
          {(phase === 'ready' || phase === 'playing') && <GuideButton on={guide} onToggle={switchGuide} />}
          {phase === 'paused' && <Paused onResume={resume} />}
          <GameSettings options={SETTINGS} settings={settings} onToggle={toggleSetting} hidden={phase === 'playing' || phase === 'paused'} />
        </div>
        <ScoreBoard game={GAME} scores={scores} />
      </div>
    </article>
  )
}
