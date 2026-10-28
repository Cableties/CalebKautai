import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS } from '../lib/bounce.js'
import { cheatOn, gameHead } from '../lib/gameHead.js'
import { BALL, BRICK, HEIGHT, PADDLE, SAFETY_Y, SETTINGS, WIDTH, bricksGame, launch, paddleWidth, start, step } from '../lib/bricks.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import GameSettings, { useGameSettings } from '../components/GameSettings.jsx'
import { PauseButton, Paused, usePause } from '../components/Pause.jsx'
import SoundToggle from '../components/SoundToggle.jsx'
import useWide, { WIDE_WIDTH } from '../components/useWide.js'
import { useCheats } from '../components/Cheats.jsx'
import { feedback } from '../lib/feedback.js'
import { approach, themeAt } from '../lib/themes.js'

// Bricks: the head is the ball, knocking out rows of pastel bricks off a paddle. The rules are in
// lib/bricks.js; this draws them on a canvas and handles input: drag a finger to slide the paddle
// and tap to launch, or the arrow keys and Space. Power-up bricks glow, and show what they do.
// Settings are behind the cog, and each mix has its own high scores. Each level has a new backdrop.
const LEFT_KEYS = ['ArrowLeft', 'a', 'A']
const RIGHT_KEYS = ['ArrowRight', 'd', 'D']
const LAUNCH_KEYS = [' ', 'ArrowUp', 'w', 'W', 'Enter']
const HUD = 44
const COLOURS = {
  rows: ['#f7b6d2', '#ffc9a8', '#fdeca0', '#bfe8d6', '#a9d4f2', '#d9ccf5', '#f7b6d2', '#ffc9a8'],
  outline: '#2e2a45',
  paddle: '#e0559a',
  strip: '#2e2a45',
  power: '#fff6c2',
  safety: '#7fe7ff',
  plough: '#ff8a3d',
}
// What's on a power-up brick, and the name of each one that's running, under the paddle
const POWER_ICONS = { multi: '3×', safety: '▁▁', plough: '»»', wide: '↔', slow: '◔', life: '♥' }
const TIMER_NAMES = { safety: 'Safety', plough: 'Plough', wide: 'Wide', slow: 'Slow-mo' }
// A colour some way towards the outline's ink, for the tough bricks
function darker(hex, amount) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const [ir, ig, ib] = [0x2e, 0x2a, 0x45]
  const to = (c, ink) => Math.round(c + (ink - c) * amount)
  return `rgb(${to(r, ir)} ${to(g, ig)} ${to(b, ib)})`
}

// Each level its own backdrop, going round: lavender, peach, sky blue, mint and lemon, each with
// big soft circles drifting about behind the bricks
const LEVELS = [
  { top: '#e7e0fa', bottom: '#fbeaf2', shapes: '#ffffff' },
  { top: '#ffe0cc', bottom: '#fcd3e1', shapes: '#fff1e6' },
  { top: '#d3e9fa', bottom: '#eef6fd', shapes: '#ffffff' },
  { top: '#d6f2e3', bottom: '#f2fbea', shapes: '#ffffff' },
  { top: '#fbf1c4', bottom: '#fde6d6', shapes: '#fffbe8' },
]
const noise = (i, n) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1

// `level`: which level's backdrop, fading from one to the next
function draw(ctx, game, head, looks, time, level) {
  const W = game.width // the screen's width: wider on a desktop
  const glow = 0.5 + 0.5 * Math.sin(time * 6)
  const theme = themeAt(LEVELS, level).palette
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  sky.addColorStop(0, theme.top)
  sky.addColorStop(1, theme.bottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, HEIGHT)
  ctx.fillStyle = theme.shapes
  ctx.globalAlpha = 0.45
  for (let i = 0; i < 8; i++) {
    ctx.beginPath()
    ctx.arc(noise(i, 1) * W + Math.sin(time * 0.2 + i) * 20, HUD + noise(i, 2) * (HEIGHT - HUD) + Math.cos(time * 0.25 + i) * 20, 30 + noise(i, 3) * 70, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Bricks: a tough one is darker, and shows a crack once it's been hit
  ctx.lineWidth = 2.5
  for (const b of game.bricks) {
    const colour = COLOURS.rows[b.row]
    ctx.fillStyle = b.tough ? darker(colour, 0.3) : colour
    ctx.strokeStyle = COLOURS.outline
    ctx.beginPath()
    ctx.roundRect(b.x, b.y, BRICK.width, BRICK.height, 5)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgb(255 255 255 / 0.45)'
    ctx.fillRect(b.x + 5, b.y + 4, BRICK.width - 18, 3)
    // A power-up: a pale brick with a glowing edge and its symbol
    if (b.power) {
      ctx.save()
      ctx.shadowColor = '#ffe27a'
      ctx.shadowBlur = 6 + glow * 10
      ctx.fillStyle = COLOURS.power
      ctx.beginPath()
      ctx.roundRect(b.x, b.y, BRICK.width, BRICK.height, 5)
      ctx.fill()
      ctx.restore()
      ctx.stroke()
      ctx.font = '800 13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = COLOURS.outline
      ctx.fillText(POWER_ICONS[b.power], b.x + BRICK.width / 2, b.y + BRICK.height / 2 + 1)
    }
    if (b.tough && b.hits === 1) {
      ctx.beginPath()
      ctx.moveTo(b.x + 12, b.y + 3)
      ctx.lineTo(b.x + 18, b.y + 10)
      ctx.lineTo(b.x + 15, b.y + 15)
      ctx.lineTo(b.x + 24, b.y + BRICK.height - 2)
      ctx.stroke()
    }
  }

  // Shards of the bricks just knocked out, falling away
  for (const boom of game.booms) {
    ctx.globalAlpha = 1 - boom.age / 0.4
    ctx.fillStyle = COLOURS.rows[boom.row]
    for (let i = 0; i < 6; i++) {
      const dx = (i - 2.5) * 7 * (1 + boom.age * 3)
      const dy = boom.age * 120 + ((i * 7) % 5) * boom.age * 30
      ctx.fillRect(boom.x + dx - 3, boom.y + dy - 3, 6, 6)
    }
  }
  ctx.globalAlpha = 1

  // The safety bar, flickering as it runs out
  if (game.timers.safety > 0 && (game.timers.safety > 2 || Math.sin(time * 20) > 0)) {
    ctx.save()
    ctx.shadowColor = COLOURS.safety
    ctx.shadowBlur = 12
    ctx.fillStyle = COLOURS.safety
    ctx.fillRect(4, SAFETY_Y, W - 8, 4)
    ctx.restore()
  }

  // The paddle
  const width = paddleWidth(game)
  ctx.fillStyle = COLOURS.paddle
  ctx.strokeStyle = COLOURS.outline
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(game.x - width / 2, PADDLE.y, width, PADDLE.height, PADDLE.height / 2)
  ctx.fill()
  ctx.stroke()

  // The balls: the head, facing the way it's going (on fire while it's a plough ball). Each has
  // its own copy of the cheats' effects, so Head Trail follows each one.
  game.balls.forEach(({ x, y, vx, vy }, i) => {
    if (game.timers.plough > 0) {
      ctx.fillStyle = COLOURS.plough
      ctx.globalAlpha = 0.35 + glow * 0.3
      ctx.beginPath()
      ctx.arc(x, y, BALL * 1.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    looks[i] ??= gameHead()
    looks[i].draw(ctx, head, {
      x,
      y,
      size: BALL * 2.6,
      facing: game.stuck ? -90 : (Math.atan2(vy, vx) * 180) / Math.PI,
      time,
    })
  })

  // The names of power-ups just broken, floating up
  ctx.font = '800 16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 4
  for (const l of game.labels) {
    ctx.globalAlpha = Math.min(1, 2 * (1.2 - l.age))
    ctx.strokeStyle = COLOURS.outline
    ctx.strokeText(l.text, Math.min(Math.max(l.x, 60), W - 60), l.y - l.age * 40)
    ctx.fillStyle = '#ffe27a'
    ctx.fillText(l.text, Math.min(Math.max(l.x, 60), W - 60), l.y - l.age * 40)
  }
  ctx.globalAlpha = 1

  // The power-ups still running, with their seconds left, under the paddle
  const running = Object.entries(game.timers).filter(([, t]) => t > 0)
  if (running.length) {
    ctx.font = '700 12px system-ui, sans-serif'
    ctx.fillStyle = COLOURS.outline
    ctx.fillText(running.map(([k, t]) => `${TIMER_NAMES[k]} ${Math.ceil(t)}`).join('  ·  '), W / 2, PADDLE.y + 36)
  }

  // The score strip: score, level, and a dot per ball left
  ctx.fillStyle = COLOURS.strip
  ctx.fillRect(0, 0, W, HUD)
  ctx.font = '800 20px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.fillText(String(game.score), 14, HUD / 2 + 1)
  ctx.textAlign = 'center'
  ctx.font = '700 15px system-ui, sans-serif'
  ctx.fillText(`Level ${game.level}`, W / 2, HUD / 2 + 1)
  ctx.fillStyle = COLOURS.paddle
  for (let i = 0; i < game.lives; i++) {
    ctx.beginPath()
    ctx.arc(W - 18 - i * 18, HUD / 2, 6, 0, Math.PI * 2)
    ctx.fill()
  }
}

// What happened this frame, for the sounds (and buzzes)
function effects(g) {
  if (g.lost) feedback('drain')
  else if (g.cleared) feedback('wave')
  else if (g.powered) feedback('bonus')
  else if (g.hit) feedback('rollover')
  if (g.bounced) feedback('kicker')
}

export default function Bricks() {
  const canvas = useRef(null)
  const stage = useRef(null)
  const game = useRef(null)
  const input = useRef({})
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
  const [settings, toggleSetting, settingsRef] = useGameSettings('bricks', SETTINGS)
  const GAME = bricksGame(settings)
  const [best, record] = useBest(GAME)
  const { run, begin } = useRun(GAME)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const { pause, resume } = usePause(phaseRef, setPhase, {
    // Let go of anything held, so it isn't still held on the way back
    onPause: () => {
      input.current = {}
    },
  })
  // In refs, since the game loop and key handler are set up once
  const recordRef = useRef(record)
  recordRef.current = record
  const beginRef = useRef(begin)
  beginRef.current = begin

  const fresh = () => {
    setBoardWide(wideRef.current)
    return start({ ...settingsRef.current, easy: cheatOn('easy'), width: wideRef.current ? WIDE_WIDTH : WIDTH })
  }

  // New settings (or the saved ones, once they load): a fresh game with them, and their scores
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
    looks.current = []
    game.current = fresh()
    const el = canvas.current
    const ctx = el.getContext('2d')
    let last = performance.now()
    let animation
    let level = 0 // the level whose backdrop is showing (lib/themes.js), fading to the next

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
      // Waiting to start, the paddle still moves (the ball sitting on it); paused, nothing does
      if (phaseRef.current === 'playing' || phaseRef.current === 'ready') {
        const before = game.current
        game.current = step(before, dt, input.current)
        const g = game.current
        effects(g)
        if (g.score !== before.score) setScore(g.score)
        if (g.over) {
          setPhase('over')
          setNewBest(!g.easy && recordRef.current(g.score))
        }
      }
      ctx.setTransform(el.width / game.current.width, 0, 0, el.height / HEIGHT, 0, 0)
      level = approach(level, game.current.level - 1, dt)
      draw(ctx, game.current, head.current, looks.current, now / 1000, level)
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
  // Launch the ball off the paddle (starting the game first, if it's waiting)
  function fire() {
    if (phaseRef.current === 'over' || phaseRef.current === 'paused') return
    if (phaseRef.current === 'ready') play()
    if (game.current.stuck) {
      game.current = launch(game.current)
      feedback('launch')
    }
  }

  // A finger (or the mouse) on the screen: the paddle slides under it, and a tap launches
  function aim(e) {
    const box = stage.current.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * game.current.width
    // Australia Mode has the page upside down, so the board's left is the screen's right
    return document.documentElement.hasAttribute('data-cheat-australia') ? game.current.width - x : x
  }
  function down(e) {
    e.preventDefault()
    stage.current.setPointerCapture(e.pointerId)
    input.current = { ...input.current, target: aim(e) }
    fire()
  }
  function move(e) {
    // A mouse steers just by moving over it; a finger while it's down
    if (input.current.target != null || e.pointerType === 'mouse') input.current = { ...input.current, target: aim(e) }
  }
  function up(e) {
    if (e.pointerType !== 'mouse') input.current = { ...input.current, target: null }
  }

  useEffect(() => {
    function key(e) {
      const pressed = e.type === 'keydown'
      if (e.target.closest?.('input, textarea, button, a')) return
      if (LAUNCH_KEYS.includes(e.key)) {
        e.preventDefault()
        if (pressed) fire()
        return
      }
      const which = LEFT_KEYS.includes(e.key) ? 'left' : RIGHT_KEYS.includes(e.key) ? 'right' : null
      if (!which) return
      e.preventDefault()
      // Keys take over from the mouse
      input.current = { ...input.current, target: null, [which]: pressed }
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
      <h1 className="page-title">Bricks</h1>
      <p className="lede">
        Slide the paddle with your finger or the arrow keys, and tap or press Space to launch. Knock out every brick.
        The glowing ones are power-ups.
      </p>

      <div className="game-layout">
        <div
          className={`game-stage swipe-stage${boardWide ? ' wide' : ''}`}
          ref={stage}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <canvas ref={canvas} className="game-canvas" role="img" aria-label={`Bricks. Score: ${score}`} />
          {phase === 'ready' && (
            <div className="game-overlay game-overlay-hint">
              <p>Tap to start</p>
            </div>
          )}
          {phase === 'over' && (
            <div className="game-overlay" onPointerDown={(e) => e.stopPropagation()}>
              <h2>Out of balls!</h2>
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
          {phase === 'paused' && <Paused onResume={resume} />}
          <GameSettings options={SETTINGS} settings={settings} onToggle={toggleSetting} hidden={phase === 'playing' || phase === 'paused'} />
        </div>
        <ScoreBoard game={GAME} scores={scores} />
      </div>
    </article>
  )
}
