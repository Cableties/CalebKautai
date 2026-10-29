import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS } from '../lib/bounce.js'
import { cheatOn, gameHead } from '../lib/gameHead.js'
import { BLOCK, HEIGHT, PLAYER, SAUCER, SETTINGS, WIDTH, alienAt, invadersGame, start, step } from '../lib/invaders.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import { useGameSettings, useSettingsPanel } from '../components/GameSettings.jsx'
import { PauseButton, Paused, usePause } from '../components/Pause.jsx'
import GameBar from '../components/GameBar.jsx'
import useWide, { WIDE_WIDTH } from '../components/useWide.js'
import { useCheats } from '../components/Cheats.jsx'
import { feedback } from '../lib/feedback.js'
import { approach, themeAt } from '../lib/themes.js'

// Invaders: pixel aliens march down on the head, riding a cannon along the bottom. The other head
// flies over now and then in a saucer, for bonus points. The rules are in lib/invaders.js; this
// draws them on a canvas and handles input: hold a finger down to slide and fire, or the arrow keys
// and Space. Settings (no bunkers, rapid fire) are behind the cog, and each mix has its own scores.
// Each wave is fought somewhere new in space.
const LEFT_KEYS = ['ArrowLeft', 'a', 'A']
const RIGHT_KEYS = ['ArrowRight', 'd', 'D']
const FIRE_KEYS = [' ', 'ArrowUp', 'w', 'W']
const HUD = 44 // the score strip across the top

// The aliens, two frames each for the march: the top row, the middle two, the bottom row
const SQUID = [
  ['...##...', '..####..', '.######.', '##.##.##', '########', '..#..#..', '.#.##.#.', '#.#..#.#'],
  ['...##...', '..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#', '.#....#.'],
]
const CRAB = [
  ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'],
  ['..#.....#..', '#..#...#..#', '#.#######.#', '###.###.###', '###########', '.#########.', '..#.....#..', '.#.......#.'],
]
const OCTOPUS = [
  ['....####....', '.##########.', '############', '###..##..###', '############', '...##..##...', '..##.##.##..', '##........##'],
  ['....####....', '.##########.', '############', '###..##..###', '############', '..###..###..', '.##..##..##.', '..##....##..'],
]
const ROWS = [SQUID, CRAB, CRAB, OCTOPUS]
const ROW_COLOURS = ['#f7b6d2', '#a9d4f2', '#a9d4f2', '#bfe8d6']
const CANNON = ['......#......', '.....###.....', '.###########.', '#############', '#############', '#############']
const COLOURS = { star: '#d9ccf5', cannon: '#7dffb2', bunker: '#7dffb2', shot: '#fff', bomb: '#ffe27a', hud: '#bfe8d6' }
// Each wave somewhere else in space, going round: its own black, a glowing cloud of gas and a
// planet in the distance (where, as fractions of the screen, and how big)
const SECTORS = [
  { space: '#0d0c16', nebula: '#2f2457', planet: '#f7b6d2', px: 0.78, py: 0.55, pr: 46 },
  { space: '#08131d', nebula: '#173f4f', planet: '#7fd3c4', px: 0.2, py: 0.6, pr: 30 },
  { space: '#170b14', nebula: '#4c1d3a', planet: '#ffb38a', px: 0.7, py: 0.62, pr: 70 },
  { space: '#0a160f', nebula: '#1b4128', planet: '#d9ccf5', px: 0.3, py: 0.5, pr: 38 },
  { space: '#130f08', nebula: '#4a3a1b', planet: '#a9d4f2', px: 0.82, py: 0.58, pr: 56 },
]

// The wave's patch of space
function backdrop(ctx, W, sector) {
  const glow = ctx.createRadialGradient(W * 0.3, HEIGHT * 0.35, 0, W * 0.3, HEIGHT * 0.35, HEIGHT * 0.6)
  glow.addColorStop(0, sector.nebula)
  glow.addColorStop(1, sector.space)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, HEIGHT)
  // The planet, dim enough to stay behind the aliens, lit from the left and half in shadow
  const [x, y, r] = [W * sector.px, HEIGHT * sector.py, sector.pr]
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = sector.planet
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.clip()
  ctx.globalAlpha = 0.6
  ctx.fillStyle = sector.space
  ctx.beginPath()
  ctx.arc(x + r * 0.35, y + r * 0.2, r * 0.95, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// The same scattered stars every time, across the widest screen (a narrow one shows the left half)
const STARS = Array.from({ length: 100 }, (_, i) => {
  const r = (n) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1
  return [r(1) * WIDE_WIDTH, HUD + r(2) * (HEIGHT - HUD), r(3) < 0.2 ? 2 : 1]
})

function bitmap(ctx, rows, x, y, px, colour) {
  ctx.fillStyle = colour
  const left = x - (rows[0].length * px) / 2
  const top = y - (rows.length * px) / 2
  rows.forEach((line, r) =>
    [...line].forEach((c, i) => c === '#' && ctx.fillRect(left + i * px, top + r * px, px + 0.3, px + 0.3)),
  )
}

// `wave`: which wave's patch of space, fading from one to the next
function draw(ctx, game, heads, time, looking, wave) {
  const W = game.width // the screen's width: wider on a desktop
  const sector = themeAt(SECTORS, wave).palette
  backdrop(ctx, W, sector)
  for (const [x, y, size] of STARS) {
    if (x > W) continue
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 1.5 + x)
    ctx.fillStyle = COLOURS.star
    ctx.fillRect(x, y, size, size)
  }
  ctx.globalAlpha = 1

  // Bunkers
  ctx.fillStyle = COLOURS.bunker
  for (const b of game.blocks) ctx.fillRect(b.x, b.y, BLOCK, BLOCK)

  // The fleet
  const f = game.fleet
  f.alive.forEach((alive, i) => {
    if (!alive) return
    const row = Math.floor(i / f.cols)
    const [x, y] = alienAt(f, i % f.cols, row)
    bitmap(ctx, ROWS[row][f.frame], x, y, 2.5, ROW_COLOURS[row])
  })

  // The saucer: the other head, in a flying saucer
  if (game.saucer) {
    const { x, dir } = game.saucer
    heads.saucer.draw(ctx, heads.other, { x, y: SAUCER.y - 4, size: 22, facing: dir > 0 ? 0 : 180, time, grows: false })
    ctx.fillStyle = '#b9bcc4'
    ctx.beginPath()
    ctx.ellipse(x, SAUCER.y + 8, 26, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = Math.sin(time * 12) > 0 ? '#ffe27a' : '#f7b6d2'
    for (const dx of [-14, 0, 14]) ctx.fillRect(x + dx - 2, SAUCER.y + 7, 4, 3)
  }

  // Shots and bombs
  ctx.fillStyle = COLOURS.shot
  for (const b of game.bullets) ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12)
  ctx.fillStyle = COLOURS.bomb
  for (const b of game.bombs) {
    const wiggle = Math.floor(b.y / 4) % 2 ? 1.5 : -1.5
    ctx.fillRect(b.x - 1.5 + wiggle, b.y - 8, 3, 4)
    ctx.fillRect(b.x - 1.5 - wiggle, b.y - 4, 3, 4)
    ctx.fillRect(b.x - 1.5 + wiggle, b.y, 3, 4)
  }

  // The cannon, with whoever's playing riding it (flashing while they get their breath back)
  if (!game.over && (!game.hurt || Math.sin(time * 30) > 0)) {
    heads.player.draw(ctx, heads.me, { x: game.x, y: PLAYER.y - 16, size: 24, facing: looking, time, grows: false })
    bitmap(ctx, CANNON, game.x, PLAYER.y + 6, 3, COLOURS.cannon)
  }

  // Explosions, and the saucer's points where it was
  for (const b of game.booms) {
    const reach = 6 + b.age * 60
    ctx.globalAlpha = 1 - b.age / 0.3
    ctx.fillStyle = '#fff'
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2
      ctx.fillRect(b.x + Math.cos(angle) * reach - 1.5, b.y + Math.sin(angle) * reach - 1.5, 3, 3)
    }
    if (b.points) {
      ctx.font = '700 16px ui-monospace, Menlo, Consolas, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffe27a'
      ctx.fillText(String(b.points), b.x, b.y)
    }
  }
  ctx.globalAlpha = 1

  // The score strip: score, wave, and a little cannon per life left
  ctx.fillStyle = sector.space
  ctx.fillRect(0, 0, W, HUD)
  ctx.fillStyle = 'rgb(255 255 255 / 0.15)'
  ctx.fillRect(0, HUD - 2, W, 2)
  ctx.font = '700 16px ui-monospace, Menlo, Consolas, monospace'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COLOURS.hud
  ctx.textAlign = 'left'
  ctx.fillText(`SCORE ${game.score}`, 12, HUD / 2)
  ctx.textAlign = 'center'
  ctx.fillText(`WAVE ${game.wave}`, W / 2 + 10, HUD / 2)
  for (let i = 0; i < game.lives; i++) bitmap(ctx, CANNON, W - 22 - i * 26, HUD / 2, 1.6, COLOURS.cannon)
}

// What changed between one frame and the next, for the sounds (and buzzes)
function effects(a, b) {
  if (b.shot) feedback('shoot')
  if (b.lives < a.lives) feedback('hit')
  else if (b.wave > a.wave) feedback('wave')
  else if (b.score > a.score) feedback('boom')
  if (b.saucer && !a.saucer) feedback('saucer')
}

export default function Invaders() {
  const canvas = useRef(null)
  const stage = useRef(null)
  const game = useRef(null)
  const input = useRef({}) // what's held: { left, right, fire, target }
  // Both heads (whoever's playing rides the cannon, the other flies the saucer), and the cheats'
  // effects on each (lib/gameHead.js)
  const heads = useRef({})
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
  const [settings, toggleSetting, settingsRef] = useGameSettings('invaders', SETTINGS)
  const { cog, panel } = useSettingsPanel(SETTINGS, settings, toggleSetting)
  const GAME = invadersGame(settings)
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

  // New settings (or the saved ones, once they load): ready to go with them, and their scores
  useEffect(() => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') return
    game.current = fresh()
    setScores(null)
    setScore(0)
    setPhase('ready')
  }, [GAME, wide])

  useEffect(() => {
    const load = (who) => {
      const sheet = new Image()
      sheet.src = HEADS[who].sheet
      return { sheet, sprite: HEADS[who].sprite }
    }
    heads.current.me = load(player)
    heads.current.other = load(player === 'amber' ? 'caleb' : 'amber')
  }, [player])

  useEffect(() => {
    heads.current.player = gameHead()
    heads.current.saucer = gameHead()
    game.current = fresh()
    const el = canvas.current
    const ctx = el.getContext('2d')
    let last = performance.now()
    let animation
    let looking = 0 // the cannon's rider faces the way it last slid
    let wave = 0 // the wave whose patch of space is showing (lib/themes.js), fading to the next

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
        if (Math.abs(g.x - before.x) > 0.5) looking = g.x > before.x ? 0 : 180
        effects(before, g)
        if (g.score !== before.score) setScore(g.score)
        if (g.over) {
          setPhase('over')
          setNewBest(!g.easy && recordRef.current(g.score))
        }
      }
      ctx.setTransform(el.width / game.current.width, 0, 0, el.height / HEIGHT, 0, 0)
      wave = approach(wave, game.current.wave - 1, dt)
      draw(ctx, game.current, heads.current, now / 1000, looking, wave)
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

  // A finger (or the mouse) held down: the cannon slides under it and keeps firing
  function aim(e) {
    const box = stage.current.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * game.current.width
    // Australia Mode has the page upside down, so the board's left is the screen's right
    return document.documentElement.hasAttribute('data-cheat-australia') ? game.current.width - x : x
  }
  function down(e) {
    e.preventDefault()
    stage.current.setPointerCapture(e.pointerId)
    if (phaseRef.current === 'ready') play()
    input.current = { ...input.current, target: aim(e), fire: true }
  }
  function move(e) {
    if (input.current.target != null) input.current = { ...input.current, target: aim(e) }
  }
  function up() {
    input.current = { ...input.current, target: null, fire: false }
  }

  useEffect(() => {
    function key(e) {
      const pressed = e.type === 'keydown'
      const which = LEFT_KEYS.includes(e.key) ? 'left' : RIGHT_KEYS.includes(e.key) ? 'right' : FIRE_KEYS.includes(e.key) ? 'fire' : null
      if (!which || e.target.closest?.('input, textarea, button, a')) return
      e.preventDefault()
      if (pressed && phaseRef.current === 'ready') play()
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
      </p>
      <h1 className="page-title">Invaders</h1>
      <p className="lede">
        Hold a finger down to slide and fire, or use the arrow keys and Space. Shoot the saucer for bonus points.
      </p>

      <div className="game-layout">
        <div className="game-screen">
          <GameBar>
            {phase === 'playing' ? <PauseButton onPause={pause} /> : phase !== 'paused' && cog}
          </GameBar>
          <div
            className={`game-stage swipe-stage${boardWide ? ' wide' : ''}`}
            ref={stage}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <canvas ref={canvas} className="game-canvas" role="img" aria-label={`Invaders. Score: ${score}`} />
            {phase === 'ready' && (
              <div className="game-overlay game-overlay-hint">
                <p>Tap to start</p>
              </div>
            )}
            {phase === 'over' && (
              <div className="game-overlay" onPointerDown={(e) => e.stopPropagation()}>
                <h2>Invaded!</h2>
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
            {phase === 'paused' && <Paused onResume={resume} />}
            {panel}
          </div>
        </div>
        <ScoreBoard game={GAME} scores={scores} />
      </div>
    </article>
  )
}
