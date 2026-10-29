import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS } from '../lib/bounce.js'
import { cheatOn, gameHead } from '../lib/gameHead.js'
import {
  BALL_R,
  BUCKET,
  HEIGHT,
  HUD,
  LAUNCHER,
  PEG_R,
  SETTINGS,
  WIDTH,
  aimAt,
  aimed,
  bucketWidth,
  bucketX,
  fire,
  launcherX,
  pegX,
  plinkGame,
  start,
  step,
} from '../lib/plink.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import { useGameSettings, useSettingsPanel } from '../components/GameSettings.jsx'
import { PauseButton, Paused, usePause } from '../components/Pause.jsx'
import GameBar from '../components/GameBar.jsx'
import useWide, { WIDE_WIDTH } from '../components/useWide.js'
import { useCheats } from '../components/Cheats.jsx'
import { feedback } from '../lib/feedback.js'
import { approach, themeAt } from '../lib/themes.js'

// Plink: fire my head down into a board of pegs, and clear the gold ones. The rules are in
// lib/plink.js; this draws them on a canvas and handles input: point (or drag a finger) to aim and
// let go to fire, or the arrow keys and Space. Settings are behind the cog, and each mix has its
// own high scores.
const LEFT_KEYS = ['ArrowLeft', 'a', 'A']
const RIGHT_KEYS = ['ArrowRight', 'd', 'D']
const FIRE_KEYS = [' ', 'ArrowDown', 's', 'S', 'Enter']
const INK = '#2e2a45'
const PEGS = { gold: '#f5b937', power: '#5cc97a', bonus: '#f05d8a' } // plain ones are the level's colour
// Each level its own look, going round: lilac, sea, sunset, mint, night. `peg`: the plain pegs.
const LEVELS = [
  { top: '#e6defa', bottom: '#cfe6f7', peg: '#8f7fd6', dots: '#2e2a45', glow: 0 },
  { top: '#bfe6f2', bottom: '#7cc0df', peg: '#3f7fb3', dots: '#16365a', glow: 0 },
  { top: '#ffe0c4', bottom: '#f7b6cf', peg: '#c56a8c', dots: '#2e2a45', glow: 0 },
  { top: '#e3f6e9', bottom: '#fdf2c2', peg: '#4f9f74', dots: '#2e2a45', glow: 0 },
  { top: '#2f2a63', bottom: '#4c3f8a', peg: '#9d93e0', dots: '#ffffff', glow: 1 },
]
const lighter = (hex) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.4 + 255 * 0.6).toString(16).padStart(2, '0')).join('')}`

function peg(ctx, x, y, colour, lit, time) {
  if (lit) {
    // Lit: pale, with a halo
    ctx.fillStyle = 'rgb(255 255 255 / 0.35)'
    ctx.beginPath()
    ctx.arc(x, y, PEG_R + 4 + Math.sin(time * 10) * 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = lit ? lighter(colour) : colour
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, PEG_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgb(255 255 255 / 0.6)'
  ctx.beginPath()
  ctx.arc(x - 2.2, y - 2.2, 1.8, 0, Math.PI * 2)
  ctx.fill()
}

// What's on a power-up or bonus peg
function mark(ctx, kind, x, y) {
  ctx.fillStyle = '#fff'
  if (kind === 'power') {
    ctx.fillRect(x - 3.5, y - 1, 7, 2)
    ctx.fillRect(x - 1, y - 3.5, 2, 7)
  } else {
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? 1.6 : 4
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
    }
    ctx.fill()
  }
}

function backdrop(ctx, W, theme, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  sky.addColorStop(0, theme.top)
  sky.addColorStop(1, theme.bottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, HEIGHT)
  // The night's stars
  if (theme.glow > 0) {
    ctx.fillStyle = '#fff'
    for (let i = 0; i < 40; i++) {
      const n = (k) => Math.abs(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1
      ctx.globalAlpha = theme.glow * (0.4 + 0.4 * Math.sin(time * 2 + i))
      ctx.fillRect(n(1) * W, HUD + n(2) * (HEIGHT - HUD), 2, 2)
    }
    ctx.globalAlpha = 1
  }
}

function ball(ctx, looks, head, x, y, facing, time) {
  // A plain ball under the head, in case the head's picture hasn't loaded
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, BALL_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  looks.draw(ctx, head, { x, y, size: BALL_R * 2.6, facing, time })
}

// `level`: which level's look, fading from one to the next as each is cleared
function draw(ctx, game, head, looks, time, level) {
  const W = game.width
  const theme = themeAt(LEVELS, level).palette
  backdrop(ctx, W, theme, time)

  // The aim: dots along the path to the first peg it'll hit (further with the long guide), and a
  // ring where it touches. Not while a shot's still going.
  const ready = !game.inPlay.length && !game.over && game.balls > 0
  if (ready) {
    const { points, contact } = aimed(game)
    ctx.fillStyle = theme.dots
    ctx.globalAlpha = 0.45
    for (let i = 2; i < points.length; i += 2) ctx.fillRect(points[i][0] - 2, points[i][1] - 2, 4, 4)
    ctx.globalAlpha = 1
    if (contact) {
      ctx.strokeStyle = theme.dots
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.arc(contact[0], contact[1], BALL_R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // The pegs
  for (const p of game.pegs) {
    if (p.gone) continue
    const x = pegX(game, p)
    peg(ctx, x, p.y, PEGS[p.kind] ?? theme.peg, p.lit, time)
    if (p.kind === 'power' || p.kind === 'bonus') mark(ctx, p.kind, x, p.y)
  }
  // Gone ones burst into a ring
  for (const p of game.pops) {
    ctx.globalAlpha = 1 - p.age / 0.35
    ctx.strokeStyle = PEGS[p.kind] ?? theme.peg
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(p.x, p.y, PEG_R * (1 + p.age * 5), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // The bucket, sliding along the bottom
  if (game.bucket) {
    const bx = bucketX(game)
    const half = bucketWidth(game) / 2
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.moveTo(bx - half, BUCKET.y)
    ctx.lineTo(bx + half, BUCKET.y)
    ctx.lineTo(bx + half - 10, HEIGHT)
    ctx.lineTo(bx - half + 10, HEIGHT)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = game.bigBucket > 0 ? PEGS.power : PEGS.gold
    ctx.fillRect(bx - half + 8, BUCKET.y + 4, half * 2 - 16, 4)
    for (const rx of [bx - half, bx + half]) {
      ctx.beginPath()
      ctx.arc(rx, BUCKET.y, BUCKET.rim, 0, Math.PI * 2)
      ctx.fillStyle = INK
      ctx.fill()
    }
  }

  // The launcher at the top, pointing where it aims, with the next ball in it
  const lx = launcherX(game)
  ctx.save()
  ctx.translate(lx, LAUNCHER.y)
  ctx.rotate(-game.aim)
  ctx.fillStyle = INK
  ctx.fillRect(-7, 0, 14, 26)
  ctx.restore()
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(lx, HUD, 26, 0, Math.PI)
  ctx.fill()
  const facing = (Math.atan2(Math.cos(game.aim), Math.sin(game.aim)) * 180) / Math.PI
  if (ready) ball(ctx, looks[0], head, lx, LAUNCHER.y, facing, time)
  game.inPlay.forEach((b, i) => {
    looks[i] ??= gameHead()
    ball(ctx, looks[i], head, b.x, b.y, (Math.atan2(b.vy, b.vx) * 180) / Math.PI, time)
  })

  // Labels floating up: power-ups, free balls, each shot's points
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

  // The score strip: score, level and gold left, balls left
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, HUD)
  ctx.font = '800 20px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.fillText(String(game.score), 14, HUD / 2 + 1)
  ctx.font = '700 15px system-ui, sans-serif'
  ctx.textAlign = 'center'
  const golds = game.pegs.filter((p) => p.kind === 'gold' && !p.lit).length
  ctx.fillText(`Level ${game.level}`, W / 2 - (W > WIDTH ? 60 : 0), HUD / 2 + 1)
  if (W > WIDTH) {
    ctx.fillStyle = PEGS.gold
    ctx.fillText(`${golds} gold left`, W / 2 + 60, HUD / 2 + 1)
  }
  ctx.textAlign = 'right'
  ctx.fillStyle = '#fff'
  ctx.fillText(`${game.balls} ${game.balls === 1 ? 'ball' : 'balls'}`, W - 14, HUD / 2 + 1)
  // On a narrow board the gold left goes under the strip, beside the launcher
  if (W <= WIDTH) {
    ctx.fillStyle = INK
    ctx.textAlign = 'left'
    ctx.font = '700 13px system-ui, sans-serif'
    ctx.fillText(`${golds} gold left`, 12, HUD + 16)
  }
}

// What happened this frame, for the sounds (and buzzes)
function effects(g) {
  if (g.fired) feedback('kicker')
  if (g.cleared) feedback('wave')
  else if (g.caught || g.powered || g.lastGold) feedback('bonus')
  else if (g.hit === 'gold' || g.hit === 'bonus') feedback('point')
  else if (g.hit) feedback('rollover')
}

export default function Plink() {
  const canvas = useRef(null)
  const stage = useRef(null)
  const game = useRef(null)
  const input = useRef({})
  const aiming = useRef(false) // a finger's down, aiming: it fires when it lets go
  const head = useRef(null)
  const looks = useRef([]) // one per ball, for each one's trail
  const { player } = useCheats()
  const [phase, setPhase] = useState('ready') // ready | playing | paused | over
  // A wider board on a wide window (components/useWide.js), picked as each game is set up
  const wide = useWide()
  const wideRef = useRef(wide)
  wideRef.current = wide
  const [boardWide, setBoardWide] = useState(false)
  const [score, setScore] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [scores, setScores] = useState(null)
  const [settings, toggleSetting, settingsRef] = useGameSettings('plink', SETTINGS)
  const { cog, panel } = useSettingsPanel(SETTINGS, settings, toggleSetting)
  const level = useRef(0) // the level whose look is showing (lib/themes.js), fading to the next
  const GAME = plinkGame(settings)
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
    return start({ ...settingsRef.current, easy: cheatOn('easy'), width: wideRef.current ? WIDE_WIDTH : WIDTH })
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
    looks.current = [gameHead()]
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
      // The bucket and moving pegs keep going before the first shot too, so the aim's right
      if (phaseRef.current === 'playing' || phaseRef.current === 'ready') {
        const before = game.current
        game.current = step(before, dt, phaseRef.current === 'playing' ? input.current : {})
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
    stage.current.setPointerCapture(e.pointerId)
    aiming.current = true
    game.current = aimAt(game.current, ...at(e))
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
      </p>
      <h1 className="page-title">Plink</h1>
      <p className="lede">
        Aim with your finger (or the arrow keys) and let go to fire my head into the pegs. Hit every gold one to clear the
        level. Land in the bucket for a free ball. Green pegs are power-ups.
      </p>

      <div className="game-layout">
        <div className="game-screen">
          <GameBar>{phase === 'playing' ? <PauseButton onPause={pause} /> : phase !== 'paused' && cog}</GameBar>
          <div
            className={`game-stage swipe-stage${boardWide ? ' wide' : ''}`}
            ref={stage}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => (aiming.current = false)}
          >
            <canvas ref={canvas} className="game-canvas" role="img" aria-label={`Plink. Score: ${score}`} />
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
            {phase === 'paused' && <Paused onResume={resume} />}
            {panel}
          </div>
        </div>
        <ScoreBoard game={GAME} scores={scores} />
      </div>
    </article>
  )
}
