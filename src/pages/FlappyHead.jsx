import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS } from '../lib/bounce.js'
import { gameHead } from '../lib/gameHead.js'
import { GROUND, HEAD_X, HEIGHT, PIPE_WIDTH, RADIUS, SPEED, WIDTH, facing, flap, start, step } from '../lib/flappy.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import SoundToggle from '../components/SoundToggle.jsx'
import { feedback } from '../lib/feedback.js'
import { useCheats } from '../components/Cheats.jsx'

// Flappy Head: the bouncing head's pixel-art sprites, flapping through pastel pipes. The rules are
// in lib/flappy.js; this draws them on a canvas and handles input.
const GAME = 'flappy-head'
const COLOURS = {
  skyTop: '#cfe6f7',
  skyBottom: '#fbeaf2',
  cloud: 'rgb(255 255 255 / 0.8)',
  pipes: ['#f7b6d2', '#a9d4f2', '#d9ccf5', '#fdeca0'],
  outline: '#2e2a45',
  ground: '#bfe8d6',
  groundStripe: '#a3dcc3',
}
// Each flap puffs a few pixel feathers out behind the head, fanning out as they drift off with
// the world: where each starts beside the head, and how fast it flies off (per second)
const PUFF_SECONDS = 0.4
const FEATHERS = [
  [-18, 0, -90, -30],
  [-16, 10, -110, 20],
  [-10, 18, -50, 70],
]
const CLOUDS = [
  [40, 110, 26],
  [150, 70, 20],
  [260, 140, 30],
  [330, 60, 18],
]

function draw(ctx, game, head, looks, distance, puffs, time, scroll) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  sky.addColorStop(0, COLOURS.skyTop)
  sky.addColorStop(1, COLOURS.skyBottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Clouds drift slower than the pipes, for a bit of depth
  ctx.fillStyle = COLOURS.cloud
  for (const [x, y, r] of CLOUDS) {
    const cx = ((((x - distance * 0.2) % (WIDTH + 80)) + WIDTH + 80) % (WIDTH + 80)) - 40
    for (const [dx, dy, s] of [[0, 0, 1], [r * 0.9, 4, 0.75], [-r * 0.9, 6, 0.7]]) {
      ctx.beginPath()
      ctx.arc(cx + dx, y + dy, r * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.lineWidth = 3
  ctx.strokeStyle = COLOURS.outline
  for (const p of game.pipes) {
    ctx.fillStyle = COLOURS.pipes[Math.abs(Math.round(p.gapY)) % COLOURS.pipes.length]
    const topEnd = p.gapY - p.gap / 2
    const bottomStart = p.gapY + p.gap / 2
    for (const [y, h, lipY] of [[-10, topEnd + 10, topEnd - 18], [bottomStart, HEIGHT - GROUND - bottomStart + 10, bottomStart]]) {
      ctx.beginPath()
      ctx.roundRect(p.x, y, PIPE_WIDTH, h, 6)
      ctx.fill()
      ctx.stroke()
      // A lip at the open end
      ctx.beginPath()
      ctx.roundRect(p.x - 5, lipY, PIPE_WIDTH + 10, 18, 6)
      ctx.fill()
      ctx.stroke()
    }
  }

  ctx.fillStyle = COLOURS.ground
  ctx.fillRect(0, HEIGHT - GROUND, WIDTH, GROUND)
  ctx.fillStyle = COLOURS.groundStripe
  for (let x = -(distance % 32); x < WIDTH; x += 32) {
    ctx.beginPath()
    ctx.moveTo(x, HEIGHT - GROUND + 10)
    ctx.lineTo(x + 16, HEIGHT - GROUND + 10)
    ctx.lineTo(x + 6, HEIGHT)
    ctx.lineTo(x - 10, HEIGHT)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.moveTo(0, HEIGHT - GROUND)
  ctx.lineTo(WIDTH, HEIGHT - GROUND)
  ctx.stroke()

  // Feathers from recent flaps, fading as they fall away behind
  for (const puff of puffs) {
    const age = time - puff.time
    ctx.globalAlpha = Math.max(0, 1 - age / PUFF_SECONDS)
    for (const [dx, dy, vx, vy] of FEATHERS) {
      const x = Math.round(HEAD_X + dx + (puff.distance - distance) + vx * age)
      const y = Math.round(puff.y + dy + vy * age)
      ctx.fillStyle = COLOURS.outline
      ctx.fillRect(x - 1, y - 1, 10, 6)
      ctx.fillStyle = '#fff'
      ctx.fillRect(x, y, 8, 4)
    }
  }
  ctx.globalAlpha = 1

  // The head, sized by its face, so the face fills the hitbox and anything outside it (Amber's hair)
  // can brush the pipes without counting. Big Head Mode has already grown the hitbox (fresh()).
  looks.draw(ctx, head, {
    x: HEAD_X,
    y: game.y,
    size: game.radius * 2.3,
    facing: game.dead ? 70 : facing(game.vy),
    time,
    scroll,
    grows: false,
  })

  // The score, big and outlined, at the top
  ctx.font = '800 56px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.lineWidth = 8
  ctx.lineJoin = 'round'
  ctx.strokeText(String(game.score), WIDTH / 2, 84)
  ctx.fillStyle = '#fff'
  ctx.fillText(String(game.score), WIDTH / 2, 84)
}

export default function FlappyHead() {
  const canvas = useRef(null)
  const stage = useRef(null)
  const game = useRef(null)
  const head = useRef(null) // the sprite sheet of whoever's playing, and its frame size
  const looks = useRef(null) // the cheats' effects on it (lib/gameHead.js)
  const { player } = useCheats()
  const [phase, setPhase] = useState('ready') // ready | playing | over
  const [score, setScore] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [scores, setScores] = useState(null) // the board, refreshed after saving
  const [best, record] = useBest(GAME)
  const { run, begin } = useRun(GAME)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const puffs = useRef([])
  const distance = useRef(0)
  const frameTime = useRef(0) // the animation's clock, in seconds, so puffs age in step with it

  const fresh = () => start({ radius: RADIUS * (document.documentElement.hasAttribute('data-cheat-bighead') ? 1.6 : 1) })

  useEffect(() => {
    const sheet = new Image()
    sheet.src = HEADS[player].sheet
    head.current = { sheet, sprite: HEADS[player].sprite }
  }, [player])

  // Draw at the canvas's real size on screen, so it's sharp on any display
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
        game.current = step(before, dt)
        distance.current += SPEED * dt
        if (game.current.score !== before.score) {
          setScore(game.current.score)
          feedback('point')
        }
        if (game.current.dead) {
          feedback('splat')
          setPhase('over')
          setNewBest(record(game.current.score))
        }
      } else if (phaseRef.current === 'ready') {
        // Bob gently while waiting to start
        game.current = { ...game.current, y: HEIGHT * 0.42 + Math.sin(now / 300) * 8, vy: Math.cos(now / 300) * -60 }
        distance.current += SPEED * dt * 0.5
      }
      ctx.setTransform(el.width / WIDTH, 0, 0, el.height / HEIGHT, 0, 0)
      frameTime.current = now / 1000
      puffs.current = puffs.current.filter((p) => frameTime.current - p.time < PUFF_SECONDS)
      const scroll = phaseRef.current === 'playing' && !game.current.dead ? SPEED : phaseRef.current === 'ready' ? SPEED * 0.5 : 0
      draw(ctx, game.current, head.current, looks.current, distance.current, puffs.current, frameTime.current, scroll)
      animation = requestAnimationFrame(tick)
    }
    animation = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(animation)
      observer.disconnect()
    }
  }, [])

  // A flap, with its whoop and a puff of feathers (left out for people who'd rather less motion)
  function flapNow(g) {
    feedback('flap')
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      puffs.current.push({ time: frameTime.current, y: g.y, distance: distance.current })
    }
    return flap(g)
  }

  function play() {
    stage.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    game.current = flapNow(fresh())
    setScore(0)
    setNewBest(false)
    setPhase('playing')
    begin()
  }
  function press() {
    if (phaseRef.current === 'playing') game.current = flapNow(game.current)
    else if (phaseRef.current === 'ready') play()
  }

  // Space, up arrow or W flap too
  useEffect(() => {
    function key(e) {
      if (![' ', 'ArrowUp', 'w', 'W'].includes(e.key) || e.target.closest?.('input, textarea, button, a')) return
      e.preventDefault()
      press()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [])

  return (
    <article className="page game-page">
      <p className="game-back">
        <Link to="/games" viewTransition>
          ← All games
        </Link>
        <SoundToggle />
      </p>
      <h1 className="page-title">Flappy Head</h1>
      <p className="lede">Tap, click or press Space to flap. Don't touch the pipes.</p>

      <div className="game-layout">
        <div className="game-stage" ref={stage} onPointerDown={(e) => (e.preventDefault(), press())}>
          <canvas ref={canvas} className="game-canvas" role="img" aria-label={`Flappy Head. Score: ${score}`} />
          {phase === 'ready' && (
            <div className="game-overlay game-overlay-hint">
              <p>Tap to start</p>
            </div>
          )}
          {phase === 'over' && (
            <div className="game-overlay" onPointerDown={(e) => e.stopPropagation()}>
              <h2>Splat!</h2>
              <p className="game-final" role="status">
                Score: <strong>{score}</strong>
                {newBest ? ' · New best!' : best ? ` · Best: ${best}` : ''}
              </p>
              <ScoreEntry game={GAME} score={score} run={run} onSaved={setScores} />
              <button type="button" className="button" onClick={play}>
                Play again
              </button>
            </div>
          )}
        </div>
        <ScoreBoard game={GAME} scores={scores} />
      </div>
    </article>
  )
}
