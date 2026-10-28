import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS } from '../lib/bounce.js'
import { cheatOn, gameHead } from '../lib/gameHead.js'
import { COLS, ROWS, facing, snakeGame, start, step, turn } from '../lib/snake.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import SoundToggle from '../components/SoundToggle.jsx'
import { useCheats } from '../components/Cheats.jsx'
import { feedback } from '../lib/feedback.js'

// Snake: the head leads a pastel tail round the board, eating pixel hearts. The rules are in
// lib/snake.js; this draws them on a canvas and handles input: swipe, or the arrow keys / WASD.
// Settings (wrap-around walls, obstacles, portals) are remembered, and each mix has its own board.
const SETTINGS_KEY = 'snake-settings'
const SETTING_NAMES = [
  { id: 'wrap', name: 'Wrap-around walls' },
  { id: 'obstacles', name: 'Obstacles' },
  { id: 'portals', name: 'Portals' },
]
const WIDTH = 360
const HEIGHT = 640
const CELL = WIDTH / COLS
const TOP = HEIGHT - ROWS * CELL // the score strip across the top
const SWIPE = 16 // px a finger has to move to count as a swipe
const KEYS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}
const COLOURS = {
  board: ['#dff3e8', '#d1ecdd'],
  body: ['#f7b6d2', '#f0a2c4'],
  outline: '#2e2a45',
  strip: '#2e2a45',
  rock: ['#8d919b', '#b9bcc4'],
  portals: ['#3fb8e0', '#f2a541'], // a colour per pair
}
// The snack: a pixel heart, like the one the bouncing heads make (w = its shine)
const HEART = ['.##...##.', '#ww#.####', '#w#######', '#########', '.#######.', '..#####..', '...###...', '....#....']

const centre = ([x, y]) => [x * CELL + CELL / 2, TOP + y * CELL + CELL / 2]
// Neighbouring cells (not a wrap round the edge, in Easy Mode), so the tail joins up between them
const touching = ([ax, ay], [bx, by]) => Math.abs(ax - bx) + Math.abs(ay - by) === 1

function heart(ctx, x, y, time) {
  const px = 3 * (1 + Math.sin(time * 5) * 0.06)
  const left = x - (HEART[0].length * px) / 2
  const top = y - (HEART.length * px) / 2
  HEART.forEach((line, r) =>
    [...line].forEach((c, i) => {
      if (c === '.') return
      ctx.fillStyle = c === 'w' ? '#ffd2e1' : '#ff3d7f'
      ctx.fillRect(left + i * px, top + r * px, px + 0.5, px + 0.5)
    }),
  )
}

function draw(ctx, game, head, looks, time) {
  // The board, chequered
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = COLOURS.board[(x + y) % 2]
      ctx.fillRect(x * CELL, TOP + y * CELL, CELL, CELL)
    }
  }
  // Wrap-around walls: a dashed edge, since it's open
  if (game.wrap) {
    ctx.strokeStyle = COLOURS.outline
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 3
    ctx.setLineDash([8, 8])
    ctx.lineDashOffset = -time * 20
    ctx.strokeRect(1.5, TOP + 1.5, WIDTH - 3, ROWS * CELL - 3)
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }
  // Portals: swirling rings, each pair its own colour
  game.portals.forEach((pair, i) => {
    for (const cell of pair) {
      const [cx, cy] = centre(cell)
      ctx.lineWidth = 3
      ctx.strokeStyle = COLOURS.portals[i]
      for (let ring = 0; ring < 3; ring++) {
        const r = CELL * (0.42 - ring * 0.12)
        const turn = time * (ring % 2 ? -3 : 3) + ring
        ctx.beginPath()
        ctx.arc(cx, cy, r, turn, turn + Math.PI * 1.4)
        ctx.stroke()
      }
    }
  })
  // Rocks
  for (const rock of game.rocks) {
    const [cx, cy] = centre(rock)
    ctx.fillStyle = COLOURS.outline
    ctx.beginPath()
    ctx.roundRect(cx - CELL / 2 + 2, cy - CELL / 2 + 2, CELL - 4, CELL - 4, 8)
    ctx.fill()
    ctx.fillStyle = COLOURS.rock[0]
    ctx.beginPath()
    ctx.roundRect(cx - CELL / 2 + 5, cy - CELL / 2 + 5, CELL - 10, CELL - 10, 6)
    ctx.fill()
    ctx.fillStyle = COLOURS.rock[1]
    ctx.fillRect(cx - 7, cy - 7, 6, 4)
  }
  if (game.food) heart(ctx, ...centre(game.food), time)

  // The tail: an outline pass, then the colour, each segment joined to the next
  const { snake } = game
  for (const [size, colour] of [
    [CELL - 4, () => COLOURS.outline],
    [CELL - 10, (i) => COLOURS.body[i % 2]],
  ]) {
    for (let i = snake.length - 1; i >= 0; i--) {
      const [cx, cy] = centre(snake[i])
      ctx.fillStyle = colour(i)
      ctx.beginPath()
      ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size / 3)
      ctx.fill()
      if (i > 0 && touching(snake[i], snake[i - 1])) {
        const [nx, ny] = centre(snake[i - 1])
        if (cy === ny) ctx.fillRect(Math.min(cx, nx), cy - size / 2, CELL, size)
        else ctx.fillRect(cx - size / 2, Math.min(cy, ny), size, CELL)
      }
    }
  }
  // The head itself, facing the way it's going
  const [hx, hy] = centre(snake[0])
  looks.draw(ctx, head, { x: hx, y: hy, size: CELL * 1.3, facing: facing(game.dir), time, alpha: game.dead ? 0.6 : 1 })

  // The score strip
  ctx.fillStyle = COLOURS.strip
  ctx.fillRect(0, 0, WIDTH, TOP)
  ctx.font = '800 24px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(String(game.score), 14, TOP / 2 + 1)
  heart(ctx, WIDTH - 24, TOP / 2, 0)
}

export default function Snake() {
  const canvas = useRef(null)
  const stage = useRef(null)
  const game = useRef(null)
  const head = useRef(null)
  const looks = useRef(null)
  const swipe = useRef(null) // where the finger was, while it's down
  const { player } = useCheats()
  const [phase, setPhase] = useState('ready') // ready | playing | over
  const [score, setScore] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [scores, setScores] = useState(null)
  // Off to start with, like the prerendered page; the saved ones load after mount
  const [settings, setSettings] = useState({ wrap: false, obstacles: false, portals: false })
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const GAME = snakeGame(settings)
  const [best, record] = useBest(GAME)
  const { run, begin } = useRun(GAME)
  // In refs, since the key handler is set up once and the board changes with the settings
  const beginRef = useRef(begin)
  beginRef.current = begin
  const recordRef = useRef(record)
  recordRef.current = record
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const fresh = () => start({ ...settingsRef.current, easy: cheatOn('easy') })

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
      const loaded = Object.fromEntries(SETTING_NAMES.map(({ id }) => [id, saved[id] === true]))
      settingsRef.current = loaded
      setSettings(loaded)
      game.current = fresh()
    } catch {
      // Nothing saved, or storage blocked
    }
  }, [])

  // A setting changed: a fresh board with it, and its own scores
  function toggleSetting(id) {
    const next = { ...settingsRef.current, [id]: !settingsRef.current[id] }
    settingsRef.current = next
    setSettings(next)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    } catch {
      // Not remembered, then
    }
    game.current = fresh()
    setScores(null)
    setScore(0)
    setPhase('ready')
  }

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
      const dt = Math.min((now - last) / 1000, 1 / 20)
      last = now
      if (phaseRef.current === 'playing') {
        const before = game.current
        game.current = step(before, dt)
        if (game.current.score !== before.score) {
          setScore(game.current.score)
          feedback('chomp')
        }
        if (game.current.dead) {
          feedback('splat')
          setPhase('over')
          setNewBest(!game.current.easy && recordRef.current(game.current.score))
        }
      }
      ctx.setTransform(el.width / WIDTH, 0, 0, el.height / HEIGHT, 0, 0)
      draw(ctx, game.current, head.current, looks.current, now / 1000)
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
  // Steer (starting the game first, if it's waiting)
  function steer(dir) {
    if (phaseRef.current === 'over') return
    if (phaseRef.current === 'ready') play()
    const before = game.current
    game.current = turn(before, dir)
    if (game.current !== before) feedback('turn')
  }

  // A swipe steers the way it went; a few in a row, without lifting, each count
  function down(e) {
    e.preventDefault()
    swipe.current = [e.clientX, e.clientY]
    if (phaseRef.current === 'ready') play()
  }
  function move(e) {
    if (!swipe.current) return
    const [x0, y0] = swipe.current
    const dx = e.clientX - x0
    const dy = e.clientY - y0
    if (Math.hypot(dx, dy) < SWIPE) return
    // Australia Mode has the page upside down, so a swipe goes the other way on the board
    const flip = document.documentElement.hasAttribute('data-cheat-australia') ? -1 : 1
    steer(Math.abs(dx) > Math.abs(dy) ? (dx * flip > 0 ? 'right' : 'left') : dy * flip > 0 ? 'down' : 'up')
    swipe.current = [e.clientX, e.clientY]
  }
  const up = () => (swipe.current = null)

  useEffect(() => {
    function key(e) {
      const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase?.()]
      if (!dir || e.target.closest?.('input, textarea')) return
      e.preventDefault()
      steer(dir)
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
      <h1 className="page-title">Snake</h1>
      <p className="lede">Swipe, or use the arrow keys, to steer. Eat the hearts. Don't hit the walls, or yourself.</p>
      <div className="game-settings" role="group" aria-label="Settings">
        {SETTING_NAMES.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            role="switch"
            aria-checked={settings[id]}
            className="game-setting"
            disabled={phase === 'playing'}
            onClick={() => toggleSetting(id)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="game-layout">
        <div
          className="game-stage swipe-stage"
          ref={stage}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <canvas ref={canvas} className="game-canvas" role="img" aria-label={`Snake. Score: ${score}`} />
          {phase === 'ready' && (
            <div className="game-overlay game-overlay-hint">
              <p>Swipe to start</p>
            </div>
          )}
          {phase === 'over' && (
            <div className="game-overlay" onPointerDown={(e) => e.stopPropagation()}>
              <h2>Ouch!</h2>
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
        </div>
        <ScoreBoard game={GAME} scores={scores} />
      </div>
    </article>
  )
}
