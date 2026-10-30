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
  aimThrough,
  aimed,
  bucketWidth,
  bucketX,
  fire,
  launcherX,
  multiplier,
  pegX,
  plinkGame,
  start,
  step,
  turn,
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
// lib/plink.js; this draws them on a canvas and handles input: point the mouse where the ball should
// go and click to fire, drag a finger side to side to aim and let go to fire, or the arrow keys and Space. Settings
// are behind the cog, and each mix has its own high scores. Super Aim's a hidden cheat: tap the
// score three times, and the aiming guide shows the path through two pegs, from then on in this
// browser (three more taps to switch it off). It still counts for the high scores.
const LEFT_KEYS = ['ArrowLeft', 'a', 'A']
const RIGHT_KEYS = ['ArrowRight', 'd', 'D']
const FIRE_KEYS = [' ', 'ArrowDown', 's', 'S', 'Enter']
const INK = '#2e2a45'
const SUPER = { taps: 3, window: 1500, key: 'plink-superaim' } // taps on the score, within ms
const SCORE_BOX = { width: 120 } // where the score is, in the strip at the top
const DRAG = 0.012 // radians the aim turns per pixel a finger drags (a 100px drag: about 70°)
// A tap of an arrow key nudges the aim this much (radians: about half a degree); held this long
// (ms), it turns steadily
const NUDGE = { by: 0.01, hold: 250 }
const PEGS = { gold: '#f5b937', power: '#5cc97a', bonus: '#f05d8a' } // plain ones are the level's colour
// Each level its own scene, going round, fading from one to the next. `peg`: the plain pegs; `dots`:
// the aim and writing on the board; `far` and `near`: the hills along the bottom. The numbers fade
// each scene's bits in and out: clouds, bubbles rising, rays of light, a low sun, petals falling,
// stars and the moon.
const LEVELS = [
  {
    top: '#e6defa', bottom: '#cfe6f7', peg: '#8f7fd6', dots: '#2e2a45', far: '#d6cdf5', near: '#b9a9e8',
    clouds: 1, rising: 0, rays: 0, sun: 0, petals: 0, stars: 0,
  },
  {
    top: '#bfe6f2', bottom: '#5fa9d3', peg: '#3f7fb3', dots: '#16365a', far: '#4f97c4', near: '#ecd9a4',
    clouds: 0, rising: 1, rays: 1, sun: 0, petals: 0, stars: 0,
  },
  {
    top: '#ffd9b8', bottom: '#f7a8c4', peg: '#8e4f9e', dots: '#2e2a45', far: '#d77fa0', near: '#8f4a78',
    clouds: 0.5, rising: 0, rays: 0, sun: 1, petals: 0, stars: 0,
  },
  {
    top: '#dff4ff', bottom: '#fdf2c2', peg: '#5b8fd6', dots: '#2e2a45', far: '#b5e3bf', near: '#7cc58f',
    clouds: 0.6, rising: 0, rays: 0, sun: 0, petals: 1, stars: 0,
  },
  {
    top: '#1f1b4d', bottom: '#4c3f8a', peg: '#9d93e0', dots: '#ffffff', far: '#2c2766', near: '#16133a',
    clouds: 0, rising: 0, rays: 0, sun: 0, petals: 0, stars: 1,
  },
]
const NAMES = ['Lavender sky', 'Under the sea', 'Sunset', 'Spring meadow', 'Starry night']
const TITLE_SECONDS = 2.2 // a level's name, as it starts
const noise = (i, n) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1
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

// A row of rolling hills along the bottom
function hills(ctx, W, colour, base, height, wave, shift) {
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.moveTo(0, HEIGHT)
  for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, base - height * (0.5 + 0.5 * Math.sin(x / wave + shift)))
  ctx.lineTo(W, HEIGHT)
  ctx.closePath()
  ctx.fill()
}

// The level's scene, behind the pegs
function backdrop(ctx, W, theme, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  sky.addColorStop(0, theme.top)
  sky.addColorStop(1, theme.bottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, HEIGHT)

  // A low sun, glowing, half behind the hills
  if (theme.sun > 0) {
    const glow = ctx.createRadialGradient(W / 2, HEIGHT - 80, 30, W / 2, HEIGHT - 80, 260)
    glow.addColorStop(0, `rgb(255 236 170 / ${0.7 * theme.sun})`)
    glow.addColorStop(1, 'rgb(255 236 170 / 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, HEIGHT)
    ctx.globalAlpha = theme.sun
    ctx.fillStyle = '#ffe08a'
    ctx.beginPath()
    ctx.arc(W / 2, HEIGHT - 80, 90, 0, Math.PI * 2)
    ctx.fill()
  }
  // Stars twinkling, and a crescent moon
  if (theme.stars > 0) {
    ctx.fillStyle = '#fff'
    for (let i = 0; i < 25 + W / 10; i++) {
      ctx.globalAlpha = theme.stars * (0.35 + 0.35 * Math.sin(time * 2 + i * 1.7))
      const size = noise(i, 3) < 0.15 ? 3 : 2
      ctx.fillRect(noise(i, 1) * W, HUD + noise(i, 2) * (HEIGHT - HUD - 80), size, size)
    }
    ctx.globalAlpha = theme.stars
    // The moon, with a bite out of it (everywhere but a circle just off it)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, W, HEIGHT)
    ctx.arc(W - 48, HUD + 62, 24, 0, Math.PI * 2)
    ctx.clip('evenodd')
    ctx.fillStyle = '#fff3c4'
    ctx.beginPath()
    ctx.arc(W - 60, HUD + 70, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // Rays of light down through the water, swaying
  if (theme.rays > 0) {
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < Math.ceil(W / 120); i++) {
      const x = i * 120 + 40 + Math.sin(time * 0.4 + i) * 30
      ctx.globalAlpha = theme.rays * (0.1 + 0.05 * Math.sin(time * 0.7 + i * 2))
      ctx.beginPath()
      ctx.moveTo(x, HUD)
      ctx.lineTo(x + 40, HUD)
      ctx.lineTo(x + 130, HEIGHT)
      ctx.lineTo(x + 60, HEIGHT)
      ctx.closePath()
      ctx.fill()
    }
  }
  for (let i = 0; i < 30; i++) {
    const x = noise(i, 1) * W
    // Little bubbles rising, swaying as they go
    if (theme.rising > 0) {
      const y = HEIGHT - ((time * (20 + noise(i, 3) * 30) + noise(i, 4) * HEIGHT) % (HEIGHT - HUD))
      ctx.globalAlpha = theme.rising * 0.5
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x + Math.sin(time * 2 + i) * 6, y, 2 + noise(i, 5) * 4, 0, Math.PI * 2)
      ctx.stroke()
    }
    // Petals drifting down, turning as they fall
    if (theme.petals > 0 && i < 22) {
      const y = HUD + ((time * (18 + noise(i, 3) * 20) + noise(i, 4) * HEIGHT) % (HEIGHT - HUD))
      ctx.globalAlpha = theme.petals * 0.8
      ctx.fillStyle = i % 3 ? '#f7b6cf' : '#ffffff'
      ctx.save()
      ctx.translate(x + Math.sin(time + i) * 20, y)
      ctx.rotate(time * (1 + noise(i, 6)) + i)
      ctx.beginPath()
      ctx.ellipse(0, 0, 4.5, 2.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    // Clouds drifting across
    if (theme.clouds > 0 && i < Math.ceil(W / 70)) {
      const cx = ((x + time * (6 + noise(i, 7) * 6)) % (W + 120)) - 60
      const cy = HUD + 40 + noise(i, 6) * 260
      ctx.globalAlpha = theme.clouds * 0.55
      ctx.fillStyle = '#ffffff'
      for (const [dx, dy, r] of [[0, 0, 24], [22, 6, 18], [-22, 7, 16]]) {
        ctx.beginPath()
        ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.globalAlpha = 1

  // The hills (or the seabed), far and near
  hills(ctx, W, theme.far, HEIGHT - 52, 34, 70, 1)
  hills(ctx, W, theme.near, HEIGHT - 18, 22, 45, 3)
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
// `since`: seconds since this level started, for its name
function draw(ctx, game, head, looks, time, level, since) {
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
  // Gone ones burst into a ring, and sparks flying out
  game.pops.forEach((p, n) => {
    const colour = PEGS[p.kind] ?? theme.peg
    ctx.globalAlpha = 1 - p.age / 0.35
    ctx.strokeStyle = colour
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(p.x, p.y, PEG_R * (1 + p.age * 5), 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = colour
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + n
      const r = PEG_R + p.age * 110
      ctx.fillRect(p.x + Math.cos(a) * r - 1.5, p.y + Math.sin(a) * r - 1.5 + p.age * p.age * 200, 3, 3)
    }
  })
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

  // The level's name as it starts, fading out
  if (since < TITLE_SECONDS && !game.over) {
    ctx.globalAlpha = Math.min(1, (TITLE_SECONDS - since) * 2, since * 4)
    ctx.font = '800 28px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.lineWidth = 6
    ctx.strokeStyle = INK
    const name = NAMES[(game.level - 1) % NAMES.length]
    ctx.strokeText(name, W / 2, HEIGHT * 0.42)
    ctx.fillStyle = '#fff'
    ctx.fillText(name, W / 2, HEIGHT * 0.42)
    ctx.globalAlpha = 1
  }

  // The score strip: score, level and gold left, balls left
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, HUD)
  ctx.font = '800 20px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.fillText(String(game.score), 14, HUD / 2 + 1)
  // The shot's multiplier, while it's more than one
  const times = multiplier(game)
  if (game.inPlay.length && times > 1) {
    const after = 14 + ctx.measureText(String(game.score)).width + 8
    ctx.font = '800 15px system-ui, sans-serif'
    ctx.fillStyle = PEGS.gold
    ctx.fillText(`×${times}`, after, HUD / 2 + 1)
  }
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
    ctx.fillStyle = theme.dots
    ctx.textAlign = 'left'
    ctx.font = '700 13px system-ui, sans-serif'
    ctx.fillText(`${golds} gold left`, 12, HUD + 16)
  }
}

// What happened this frame, for the sounds (and buzzes)
function effects(g) {
  if (g.fired) feedback('kicker')
  if (g.cleared) feedback('wave')
  else if (g.caught || g.powered || g.lastGold || g.trick) feedback('bonus')
  else if (g.combo || g.hit === 'gold' || g.hit === 'bonus') feedback('point')
  else if (g.hit) feedback('rollover')
}

export default function Plink() {
  const canvas = useRef(null)
  const stage = useRef(null)
  const game = useRef(null)
  const input = useRef({})
  const aiming = useRef(false) // a finger's down, aiming: it fires when it lets go
  const dragX = useRef(0) // where the finger was, last time it turned the aim
  const superAim = useRef(false)
  const taps = useRef([]) // recent taps on the score
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
  const started = useRef({ level: 0, at: 0 }) // which level's name was shown, and when (seconds)
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
    return start({
      ...settingsRef.current,
      easy: cheatOn('easy'),
      superAim: superAim.current,
      width: wideRef.current ? WIDE_WIDTH : WIDTH,
    })
  }

  // Super Aim, as it was left in this browser
  useEffect(() => {
    try {
      superAim.current = localStorage.getItem(SUPER.key) === 'on'
      if (game.current) game.current = { ...game.current, superAim: superAim.current }
    } catch {
      // Storage blocked: off, then
    }
  }, [])
  // A tap on the score: the third in a row switches Super Aim on or off, there and then
  function tapScore() {
    const now = Date.now()
    taps.current = [...taps.current, now].filter((t) => now - t <= SUPER.window)
    if (taps.current.length < SUPER.taps) return
    taps.current = []
    superAim.current = !superAim.current
    try {
      localStorage.setItem(SUPER.key, superAim.current ? 'on' : 'off')
    } catch {
      // Not remembered, then
    }
    const g = game.current
    const label = { x: g.width / 2, y: HEIGHT / 2, text: superAim.current ? 'Super aim!' : 'Super aim off', age: 0 }
    game.current = { ...g, superAim: superAim.current, labels: [...g.labels, label] }
    feedback(superAim.current ? 'bonus' : 'whiff')
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
      // A new level (or a new game): its name, from now
      if (game.current.level !== started.current.level) started.current = { level: game.current.level, at: now / 1000 }
      const since = phaseRef.current === 'ready' ? Infinity : now / 1000 - started.current.at
      draw(ctx, game.current, head.current, looks.current, now / 1000, level.current, since)
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
    started.current = { level: 0, at: 0 }
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
    // On the score: not a shot, but maybe the cheat
    const [x, y] = at(e)
    if (y < HUD && x < SCORE_BOX.width) return tapScore()
    taps.current = []
    if (phaseRef.current === 'ready') return play()
    if (phaseRef.current !== 'playing') return
    stage.current.setPointerCapture(e.pointerId)
    aiming.current = true
    dragX.current = e.clientX
    if (e.pointerType === 'mouse') game.current = aimThrough(game.current, ...at(e))
  }
  function move(e) {
    if (phaseRef.current !== 'playing') return
    // A mouse aims so the ball goes through where it points, just by moving over it
    if (e.pointerType === 'mouse') return void (game.current = aimThrough(game.current, ...at(e)))
    // A finger turns the aim as it drags side to side, from wherever it went down, so small moves
    // are fine adjustments and it isn't covering where it's aiming (Australia Mode's upside down)
    if (!aiming.current) return
    const flip = document.documentElement.hasAttribute('data-cheat-australia') ? -1 : 1
    game.current = turn(game.current, (e.clientX - dragX.current) * DRAG * flip)
    dragX.current = e.clientX
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
      // A tap nudges it; held on, it turns (the key's own repeats ignored)
      clearTimeout(holds[which])
      if (!pressed) {
        input.current = { ...input.current, [which]: false }
        return
      }
      if (e.repeat || phaseRef.current !== 'playing') return
      game.current = turn(game.current, which === 'left' ? -NUDGE.by : NUDGE.by)
      holds[which] = setTimeout(() => (input.current = { ...input.current, [which]: true }), NUDGE.hold)
    }
    const holds = {}
    addEventListener('keydown', key)
    addEventListener('keyup', key)
    return () => {
      removeEventListener('keydown', key)
      removeEventListener('keyup', key)
      clearTimeout(holds.left)
      clearTimeout(holds.right)
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
        Drag your finger side to side to aim (or point the mouse where you want it to go, or use the arrow keys), and let go to fire my head into the pegs. Hit every gold one to clear the
        level. Land in the bucket for a free ball. Green pegs are power-ups. Combos, long shots and bank shots multiply your points.
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
