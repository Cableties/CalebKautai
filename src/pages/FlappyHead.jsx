import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SPRITE, frame } from '../lib/bounce.js'
import { GROUND, HEAD_X, HEIGHT, PIPE_WIDTH, RADIUS, SPEED, WIDTH, facing, flap, start, step } from '../lib/flappy.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'

// Flappy Head: the bouncing head's pixel-art sprites, flapping through pastel pipes. The rules are
// in lib/flappy.js; this draws them on a canvas and handles input.
const GAME = 'flappy-head'
const SHEET = '/images/bounce-sprites.png'
const COLOURS = {
  skyTop: '#cfe6f7',
  skyBottom: '#fbeaf2',
  cloud: 'rgb(255 255 255 / 0.8)',
  pipes: ['#f7b6d2', '#a9d4f2', '#d9ccf5', '#fdeca0'],
  outline: '#2e2a45',
  ground: '#bfe8d6',
  groundStripe: '#a3dcc3',
}
const CLOUDS = [
  [40, 110, 26],
  [150, 70, 20],
  [260, 140, 30],
  [330, 60, 18],
]

function draw(ctx, game, sheet, distance) {
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

  // The head: one frame of the sprite sheet, sized so the face fills the hitbox
  if (sheet.complete && sheet.naturalWidth) {
    const { row, col, mirrored } = frame(game.dead ? 70 : facing(game.vy))
    const scale = (game.radius * 2.3) / SPRITE.art
    const w = SPRITE.width * scale
    const h = SPRITE.height * scale
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.translate(HEAD_X, game.y)
    if (mirrored) ctx.scale(-1, 1)
    ctx.drawImage(sheet, col * SPRITE.width, row * SPRITE.height, SPRITE.width, SPRITE.height, -w / 2, -h / 2, w, h)
    ctx.restore()
  }

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
  const sheet = useRef(null)
  const [phase, setPhase] = useState('ready') // ready | playing | over
  const [score, setScore] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [scores, setScores] = useState(null) // the board, refreshed after saving
  const [best, record] = useBest(GAME)
  const { run, begin } = useRun(GAME)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const fresh = () => start({ radius: RADIUS * (document.documentElement.hasAttribute('data-cheat-bighead') ? 1.6 : 1) })

  // Draw at the canvas's real size on screen, so it's sharp on any display
  useEffect(() => {
    sheet.current = new Image()
    sheet.current.src = SHEET
    game.current = fresh()
    const el = canvas.current
    const ctx = el.getContext('2d')
    let distance = 0
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
        distance += SPEED * dt
        if (game.current.score !== before.score) setScore(game.current.score)
        if (game.current.dead) {
          setPhase('over')
          setNewBest(record(game.current.score))
        }
      } else if (phaseRef.current === 'ready') {
        // Bob gently while waiting to start
        game.current = { ...game.current, y: HEIGHT * 0.42 + Math.sin(now / 300) * 8, vy: Math.cos(now / 300) * -60 }
        distance += SPEED * dt * 0.5
      }
      ctx.setTransform(el.width / WIDTH, 0, 0, el.height / HEIGHT, 0, 0)
      draw(ctx, game.current, sheet.current, distance)
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
    game.current = flap(fresh())
    setScore(0)
    setNewBest(false)
    setPhase('playing')
    begin()
  }
  function press() {
    if (phaseRef.current === 'playing') game.current = flap(game.current)
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
