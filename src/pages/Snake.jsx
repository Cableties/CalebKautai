import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS } from '../lib/bounce.js'
import { cheatOn, gameHead } from '../lib/gameHead.js'
import { COLS, ROWS, SETTINGS, WIDE_COLS, facing, snakeGame, start, step, tickFor, turn } from '../lib/snake.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import GameSettings, { useGameSettings } from '../components/GameSettings.jsx'
import { PauseButton, Paused, usePause } from '../components/Pause.jsx'
import SoundToggle from '../components/SoundToggle.jsx'
import useWide from '../components/useWide.js'
import { useCheats } from '../components/Cheats.jsx'
import { feedback } from '../lib/feedback.js'
import { approach, themeAt } from '../lib/themes.js'

// Snake: the head leads a pastel tail round the board, eating pixel fruit. The rules are in
// lib/snake.js; this draws them on a canvas and handles input: swipe, or the arrow keys / WASD.
// The snake glides between cells rather than jumping: each segment is drawn partway from where it
// was to where it's going, as far as the next move has come. Settings (wrap-around walls,
// obstacles, portals) are behind the cog, and each mix has its own high scores. The seasons change
// as it grows.
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
  body: '#f7b6d2',
  shine: '#fcd9e8',
  outline: '#2e2a45',
  strip: '#2e2a45',
  rock: ['#8d919b', '#b9bcc4'],
  portals: ['#3fb8e0', '#f2a541'], // a colour per pair
}

// The fruit, as pixel art: each a picture and the colours its letters stand for
const FRUITS = [
  {
    name: 'apple',
    colours: { r: '#e8423f', d: '#b8282a', w: '#ffd7d0', g: '#4caf50', b: '#7a4a24' },
    rows: ['....bg...', '....b....', '.rrrdrrr.', 'rwrrrrrrr', 'rwrrrrrrd', 'rrrrrrrrd', 'rrrrrrrrd', '.rrrrrrd.', '..rr.rd..'],
  },
  {
    name: 'cherries',
    colours: { r: '#d8263c', w: '#ff9aa8', g: '#4caf50' },
    rows: ['.....gg..', '....g.g..', '...g...g.', '..g....g.', '.rr...rr.', 'rwrr.rwrr', 'rrrr.rrrr', 'rrrr.rrrr', '.rr...rr.'],
  },
  {
    name: 'orange',
    colours: { o: '#f59a23', d: '#d9771a', w: '#ffd59a', g: '#4caf50' },
    rows: ['....g....', '...gg....', '..ooooo..', '.wooooood', 'owooooood', 'ooooooood', 'ooooooood', '.ooooood.', '..ooood..'],
  },
  {
    name: 'strawberry',
    colours: { r: '#e8334a', y: '#ffe27a', g: '#4caf50' },
    rows: ['..g.g.g..', '.ggggggg.', 'rrrrrrrrr', 'ryrrryrrr', 'rrrryrrry', '.ryrrrrr.', '.rrrryrr.', '..rryrr..', '...rrr...'],
  },
  {
    name: 'grapes',
    colours: { p: '#8a5cd6', w: '#c9b2f2', g: '#4caf50' },
    rows: ['....gg...', '.....g...', '..pp.pp..', '.pwppwpp.', '.pppppppp', '..pwpppp.', '..pppppp.', '...pppp..', '....pp...'],
  },
]
// Which fruit a snack is: mixed up, but the same one for as long as it sits there
const fruitFor = (game) => FRUITS[(game.score * 2 + game.food[0] + game.food[1]) % FRUITS.length]

const centre = ([x, y]) => [x * CELL + CELL / 2, TOP + y * CELL + CELL / 2]

function fruit(ctx, kind, x, y, time, bob = true) {
  const px = 3 * (bob ? 1 + Math.sin(time * 5) * 0.06 : 1)
  const left = x - (kind.rows[0].length * px) / 2
  const top = y - (kind.rows.length * px) / 2
  // A soft shadow under it, then the fruit
  ctx.fillStyle = 'rgb(46 42 69 / 0.18)'
  ctx.beginPath()
  ctx.ellipse(x, y + (kind.rows.length * px) / 2, 9, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  kind.rows.forEach((line, r) =>
    [...line].forEach((c, i) => {
      if (c === '.') return
      ctx.fillStyle = kind.colours[c]
      ctx.fillRect(left + i * px, top + r * px, px + 0.5, px + 0.5)
    }),
  )
}

// Where each segment is drawn this frame: partway from the cell it was in to the one it's in now,
// as far through the move as the clock has got. Through a portal or round a wrapped wall it's a
// jump, so those go straight there.
function bodyPoints(game) {
  const t = game.dead || !game.prev ? 1 : Math.min(1, game.clock / tickFor(game.score, game.easy))
  return game.snake.map((cell, i) => {
    const [x, y] = centre(cell)
    const from = game.prev?.[i]
    if (!from || Math.abs(from[0] - cell[0]) + Math.abs(from[1] - cell[1]) !== 1) return [x, y]
    const [fx, fy] = centre(from)
    return [fx + (x - fx) * t, fy + (y - fy) * t]
  })
}

// The seasons, one after another as the snake grows: the board's chequer, the little things dotted
// on it, and what's falling (petals, leaves or snow, faded in and out by their numbers)
const SEASONS = [
  { board: ['#dff3e8', '#d1ecdd'], dots: '#f7b6d2', petals: 1, leaves: 0, snow: 0 }, // spring
  { board: ['#ecf6cc', '#deeeb6'], dots: '#f5c94a', petals: 0, leaves: 0, snow: 0 }, // summer
  { board: ['#f7e5c8', '#efd6b1'], dots: '#e2864a', petals: 0, leaves: 1, snow: 0 }, // autumn
  { board: ['#eef4fb', '#e0e9f4'], dots: '#ffffff', petals: 0, leaves: 0, snow: 1 }, // winter
]
const SNACKS_PER_SEASON = 8
const FALLING = { petals: '#f7b6d2', leaves: '#e2864a', snow: '#ffffff' }
const noise = (i, n) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1

// `season`: which season's look, fading from one to the next
function draw(ctx, game, head, looks, time, season) {
  const W = game.cols * CELL // the board's width: wider on a desktop
  const theme = themeAt(SEASONS, season).palette
  // The board, chequered, with a few little things dotted about it
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < game.cols; x++) {
      ctx.fillStyle = theme.board[(x + y) % 2]
      ctx.fillRect(x * CELL, TOP + y * CELL, CELL, CELL)
      const i = y * WIDE_COLS + x
      if (noise(i, 1) < 0.12) {
        ctx.fillStyle = theme.dots
        ctx.fillRect(x * CELL + 6 + noise(i, 2) * (CELL - 16), TOP + y * CELL + 6 + noise(i, 3) * (CELL - 16), 4, 4)
      }
    }
  }
  // Petals, leaves or snow drifting down
  for (const [kind, colour] of Object.entries(FALLING)) {
    if (!theme[kind]) continue
    ctx.globalAlpha = theme[kind] * 0.7
    ctx.fillStyle = colour
    for (let i = 0; i < 24; i++) {
      const fall = (time * (18 + noise(i, 4) * 18) + noise(i, 5) * ROWS * CELL) % (ROWS * CELL)
      const x = (noise(i, 6) * W + Math.sin(time + i) * 12 + W) % W
      ctx.fillRect(x, TOP + fall, kind === 'snow' ? 3 : 5, 3)
    }
  }
  ctx.globalAlpha = 1
  // Wrap-around walls: a dashed edge, since it's open
  if (game.wrap) {
    ctx.strokeStyle = COLOURS.outline
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 3
    ctx.setLineDash([8, 8])
    ctx.lineDashOffset = -time * 20
    ctx.strokeRect(1.5, TOP + 1.5, W - 3, ROWS * CELL - 3)
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
  if (game.food) fruit(ctx, fruitFor(game), ...centre(game.food), time)

  // The tail: one smooth line through the segments (broken where it jumps through a portal or
  // round a wall), an outline under the colour, and a shine down the middle
  const points = bodyPoints(game)
  const runs = [[points[0]]]
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1]
    const [x, y] = points[i]
    if (Math.hypot(x - px, y - py) > CELL * 1.1) runs.push([])
    // Mid-turn the two segments either side of a corner are off at an angle: go through the corner
    // cell's middle between them, so the tail turns square rather than cutting across
    else if (Math.abs(x - px) > 0.5 && Math.abs(y - py) > 0.5) runs.at(-1).push(centre(game.snake[i]))
    runs.at(-1).push(points[i])
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'miter'
  for (const [width, colour] of [
    [CELL - 4, COLOURS.outline],
    [CELL - 10, COLOURS.body],
    [4, COLOURS.shine],
  ]) {
    ctx.lineWidth = width
    ctx.strokeStyle = colour
    for (const run of runs) {
      ctx.beginPath()
      ctx.moveTo(...run[0])
      // A single point still needs a line to show its round end
      for (const p of run.length > 1 ? run.slice(1) : [[run[0][0] + 0.01, run[0][1]]]) ctx.lineTo(...p)
      ctx.stroke()
    }
  }
  // The head itself, facing the way it's going
  const [hx, hy] = points[0]
  looks.draw(ctx, head, { x: hx, y: hy, size: CELL * 1.3, facing: facing(game.dir), time, alpha: game.dead ? 0.6 : 1 })

  // The score strip, with the fruit that's out
  ctx.fillStyle = COLOURS.strip
  ctx.fillRect(0, 0, W, TOP)
  ctx.font = '800 24px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(String(game.score), 14, TOP / 2 + 1)
  if (game.food) fruit(ctx, fruitFor(game), W - 24, TOP / 2 - 2, time, false)
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
  // A wider board on a wide window (components/useWide.js), picked as each game is set up
  const wide = useWide()
  const wideRef = useRef(wide)
  wideRef.current = wide
  const [boardWide, setBoardWide] = useState(false)
  const [score, setScore] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [scores, setScores] = useState(null)
  const [settings, toggleSetting, settingsRef] = useGameSettings('snake', SETTINGS)
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
  const season = useRef(0) // the season showing (lib/themes.js), fading to the next
  const { pause, resume } = usePause(phaseRef, setPhase, {
    // Let go of anything held, so it isn't still held on the way back
    onPause: () => {
      swipe.current = null
    },
  })

  const fresh = () => {
    setBoardWide(wideRef.current)
    return start({ ...settingsRef.current, easy: cheatOn('easy'), cols: wideRef.current ? WIDE_COLS : COLS })
  }

  // New settings (or the saved ones, once they load): a fresh board with them, and their scores
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
      ctx.setTransform(el.width / (game.current.cols * CELL), 0, 0, el.height / HEIGHT, 0, 0)
      season.current = approach(season.current, Math.floor(game.current.score / SNACKS_PER_SEASON), dt)
      draw(ctx, game.current, head.current, looks.current, now / 1000, season.current)
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
    if (phaseRef.current === 'over' || phaseRef.current === 'paused') return
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
      <p className="lede">Swipe, or use the arrow keys, to steer. Eat the fruit. Don't hit the walls, or yourself.</p>

      <div className="game-layout">
        <div
          className={`game-stage swipe-stage${boardWide ? ' wide' : ''}`}
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
          {phase === 'playing' && <PauseButton onPause={pause} />}
          {phase === 'paused' && <Paused onResume={resume} />}
          <GameSettings options={SETTINGS} settings={settings} onToggle={toggleSetting} hidden={phase === 'playing' || phase === 'paused'} />
        </div>
        <ScoreBoard game={GAME} scores={scores} />
      </div>
    </article>
  )
}
