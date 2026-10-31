import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS } from '../lib/bounce.js'
import { cheatOn, gameHead } from '../lib/gameHead.js'
import { GROUND, HEAD_X, HEIGHT, PIPE_WIDTH, RADIUS, SETTINGS, SPACING, SPEED, WIDTH, autoFlap, facing, flap, flappyGame, start, step } from '../lib/flappy.js'
import { mix, themeAt } from '../lib/themes.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import { useGameSettings, useSettingsPanel } from '../components/GameSettings.jsx'
import { PauseButton, Paused, usePause } from '../components/Pause.jsx'
import GameBar from '../components/GameBar.jsx'
import useWide, { WIDE_WIDTH } from '../components/useWide.js'
import { feedback } from '../lib/feedback.js'
import { useCheats } from '../components/Cheats.jsx'

// Flappy Head: the bouncing head's pixel-art sprites, flapping through pastel pipes. The rules are
// in lib/flappy.js; this draws them on a canvas and handles input. Settings (moving pipes, moon
// gravity) are behind the cog, and each mix has its own high scores.
//
// The further it gets, the more the world changes round it: every few pipes a new place (a meadow,
// a city, a desert, a forest, snowy mountains), and the sun going down and coming back up as it goes.
//
// A secret: tap the score three times quickly and it plays itself (auto flap, lib/flappy.js). Three
// more turn it off. A game it's been on for doesn't count towards the high scores.
const COLOURS = {
  pipes: ['#f7b6d2', '#a9d4f2', '#d9ccf5', '#fdeca0'],
  outline: '#2e2a45',
}
// The places, in order, each with its own sky (by day), scenery (far and near) and ground.
// `accent`: the scenery's extra bits (city windows, cacti, tree trunks, snow caps).
const PLACES = [
  { scenery: 'meadow', skyTop: '#cfe6f7', skyBottom: '#fbeaf2', far: '#d3efdf', near: '#b4e3c9', accent: '#f7b6d2', ground: '#bfe8d6', groundStripe: '#a3dcc3' },
  { scenery: 'city', skyTop: '#d4dff2', skyBottom: '#f6e6ee', far: '#c9cbe4', near: '#a7aacd', accent: '#fdeca0', ground: '#cdcad9', groundStripe: '#b7b3c8' },
  { scenery: 'desert', skyTop: '#cfe3f2', skyBottom: '#fdebcc', far: '#f3d8a8', near: '#ebc48f', accent: '#86c495', ground: '#f4ddae', groundStripe: '#e9cb92' },
  { scenery: 'forest', skyTop: '#c8e4ec', skyBottom: '#eaf4e3', far: '#acd6b7', near: '#78b48e', accent: '#8f6e58', ground: '#a3d3a5', groundStripe: '#8cc591' },
  { scenery: 'snow', skyTop: '#d6e4f4', skyBottom: '#f3f5fb', far: '#bccbe2', near: '#e6edf7', accent: '#ffffff', ground: '#eef3fa', groundStripe: '#dbe4f0' },
]
const PIPES_PER_PLACE = 10
// Where the score is, to tap (round its middle, at the top), and how quick the three taps have to be
const SCORE_TAP = { halfWidth: 70, top: 20, bottom: 100, within: 1200 }
// The time of day, going round: how much its sky takes over from the place's own (`amount`), how
// dark it is (`night`), and where the sun and moon are (down behind the scenery when they're out
// of the sky)
const DAY = { top: '#cfe6f7', bottom: '#fbeaf2', amount: 0, night: 0, sunY: 120, moonY: 600 }
const SUNSET = { top: '#f3a6a8', bottom: '#ffd79e', amount: 0.85, night: 0.2, sunY: 470, moonY: 520 }
const NIGHT = { top: '#1c1c48', bottom: '#4b4079', amount: 1, night: 1, sunY: 600, moonY: 120 }
const DAWN = { top: '#b6b2e6', bottom: '#ffcbb8', amount: 0.75, night: 0.25, sunY: 430, moonY: 420 }
const TIMES = [DAY, DAY, SUNSET, NIGHT, NIGHT, DAWN]
const PIPES_PER_TIME = 6 // a whole day is 36 pipes
const NIGHT_INK = '#1c1c48'

// The same scattered stars every time, across the widest sky
const STARS = Array.from({ length: 60 }, (_, i) => [noise(i, 1) * 840, 60 + noise(i, 2) * 300, noise(i, 3) < 0.25 ? 3 : 2])
// A number from 0 to 1, the same every time for the same inputs
function noise(i, n) {
  return Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1
}

// Something drawn again and again, `tile` apart, scrolling `speed` times as fast as the pipes
function repeat(W, distance, speed, tile, each) {
  const offset = (distance * speed) % tile
  for (let x = -offset - tile, i = Math.floor((distance * speed) / tile) - 1; x < W + tile; x += tile, i++) each(x, i)
}
// A hill line along the horizon, filled down to it
function hills(ctx, W, distance, speed, top, height, colour, seed) {
  const base = HEIGHT - GROUND
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.moveTo(0, base)
  for (let x = 0; x <= W + 8; x += 8) {
    const at = x + distance * speed
    ctx.lineTo(x, top + height * (0.5 + 0.3 * Math.sin(at / 90 + seed) + 0.2 * Math.sin(at / 37 + seed * 3)))
  }
  ctx.lineTo(W, base)
  ctx.fill()
}
function pine(ctx, x, base, height, colour, trunk) {
  ctx.fillStyle = trunk
  ctx.fillRect(x - 3, base - height * 0.2, 6, height * 0.2)
  ctx.fillStyle = colour
  for (const [y, w] of [[0.05, 0.28], [0.3, 0.38], [0.55, 0.48]]) {
    ctx.beginPath()
    ctx.moveTo(x, base - height * (1 - y))
    ctx.lineTo(x - height * w, base - height * (0.6 - y * 0.7))
    ctx.lineTo(x + height * w, base - height * (0.6 - y * 0.7))
    ctx.fill()
  }
}

// The city's buildings, far or near, the same ones every time
function buildings(W, distance, near, each) {
  const [speed, tall, seed] = near ? [0.35, 170, 2] : [0.15, 230, 1]
  repeat(W, distance, speed, 46, (x, i) => {
    const h = 50 + noise(i, seed) * tall
    each(x, HEIGHT - GROUND - h, 34 + noise(i, seed + 9) * 10, h, i)
  })
}
// The near buildings' windows, some lit up after dark (`lit`: how brightly)
function windows(ctx, W, distance, colour, lit) {
  ctx.fillStyle = colour
  buildings(W, distance, true, (x, y, w, h, i) => {
    for (let wy = y + 10; wy < y + h - 12; wy += 16) {
      for (let wx = x + 6; wx < x + w - 8; wx += 12) {
        ctx.globalAlpha = noise(wx * 0.37 + i, wy) < 0.55 ? lit : 0
        ctx.fillRect(wx, wy, 5, 7)
      }
    }
  })
  ctx.globalAlpha = 1
}

// Each place's scenery, from the horizon up: what's far away scrolls slower than what's near
const SCENERY = {
  meadow(ctx, W, distance, p) {
    hills(ctx, W, distance, 0.15, 420, 110, p.far, 1)
    hills(ctx, W, distance, 0.35, 480, 90, p.near, 4)
    // Flowers dotted on the near hills
    repeat(W, distance, 0.35, 70, (x, i) => {
      ctx.fillStyle = noise(i, 5) < 0.5 ? p.accent : '#ffffff'
      ctx.fillRect(x + noise(i, 6) * 50, 560 + noise(i, 7) * 18, 4, 4)
    })
  },
  city(ctx, W, distance, p) {
    for (const [near, colour] of [[false, p.far], [true, p.near]]) {
      ctx.fillStyle = colour
      buildings(W, distance, near, (x, y, w, h) => ctx.fillRect(x, y, w, h))
    }
  },
  desert(ctx, W, distance, p) {
    // Far-off pyramids, then dunes, with cacti on the near ones
    repeat(W, distance, 0.08, 520, (x) => {
      // Each lit on one face and shaded on the other
      for (const [dx, size] of [[120, 80], [215, 55]]) {
        for (const [side, colour] of [[-1, p.far], [1, p.near]]) {
          ctx.fillStyle = colour
          ctx.beginPath()
          ctx.moveTo(x + dx + side * size, 520)
          ctx.lineTo(x + dx, 520 - size)
          ctx.lineTo(x + dx, 520)
          ctx.fill()
        }
      }
    })
    hills(ctx, W, distance, 0.15, 470, 70, p.far, 2)
    hills(ctx, W, distance, 0.35, 515, 50, p.near, 5)
    repeat(W, distance, 0.35, 150, (x, i) => {
      if (noise(i, 3) < 0.35) return
      const cx = x + noise(i, 4) * 100
      const h = 34 + noise(i, 8) * 26
      ctx.fillStyle = p.accent
      ctx.beginPath()
      ctx.roundRect(cx - 5, 584 - h, 10, h, 5)
      ctx.roundRect(cx - 17, 584 - h * 0.75, 8, h * 0.35, 4)
      ctx.roundRect(cx - 17, 584 - h * 0.48, 14, 7, 3)
      ctx.roundRect(cx + 9, 584 - h * 0.85, 8, h * 0.4, 4)
      ctx.roundRect(cx + 3, 584 - h * 0.52, 14, 7, 3)
      ctx.fill()
    })
  },
  forest(ctx, W, distance, p) {
    repeat(W, distance, 0.15, 34, (x, i) => pine(ctx, x + noise(i, 1) * 16, 584, 90 + noise(i, 2) * 70, p.far, p.far))
    repeat(W, distance, 0.35, 52, (x, i) => pine(ctx, x + noise(i, 3) * 20, 590, 80 + noise(i, 4) * 60, p.near, p.accent))
  },
  snow(ctx, W, distance, p, time) {
    // Mountains with snowy tops, then snowy hills, and snow falling
    repeat(W, distance, 0.08, 240, (x, i) => {
      const peak = 300 + noise(i, 1) * 90
      const half = 150 + noise(i, 2) * 40
      const mid = x + 120
      ctx.fillStyle = p.far
      ctx.beginPath()
      ctx.moveTo(mid - half, 584)
      ctx.lineTo(mid, peak)
      ctx.lineTo(mid + half, 584)
      ctx.fill()
      const cap = 0.28
      ctx.fillStyle = p.accent
      ctx.beginPath()
      ctx.moveTo(mid, peak)
      ctx.lineTo(mid - half * cap, peak + (584 - peak) * cap)
      ctx.lineTo(mid - half * cap * 0.4, peak + (584 - peak) * cap * 0.8)
      ctx.lineTo(mid, peak + (584 - peak) * cap)
      ctx.lineTo(mid + half * cap * 0.5, peak + (584 - peak) * cap * 0.75)
      ctx.lineTo(mid + half * cap, peak + (584 - peak) * cap)
      ctx.fill()
    })
    hills(ctx, W, distance, 0.35, 500, 70, p.near, 3)
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 40; i++) {
      const x = (((noise(i, 1) * 900 - distance * 0.5 + Math.sin(time + i) * 10) % (W + 20)) + W + 20) % (W + 20)
      const y = (noise(i, 2) * HEIGHT + time * (30 + noise(i, 3) * 30)) % HEIGHT
      ctx.fillRect(x, y, 3, 3)
    }
  },
}

// Where the world's at, `journey` along this run: the place (and the next, while it's changing
// into it), its palette, and the time of day
function world(journey) {
  const pipes = journey / SPACING
  const place = themeAt(PLACES, pipes / PIPES_PER_PLACE, 0.3)
  const time = themeAt(TIMES, pipes / PIPES_PER_TIME, 0.5).palette
  return { place, time }
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

// `auto`: auto flap's on, so it says so under the score
function draw(ctx, game, head, looks, distance, journey, puffs, time, scroll, auto) {
  const W = game.width // the world's width: wider on a desktop
  const { place, time: day } = world(journey)
  const p = place.palette
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT - GROUND)
  sky.addColorStop(0, mix(p.skyTop, day.top, day.amount))
  sky.addColorStop(1, mix(p.skyBottom, day.bottom, day.amount))
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, HEIGHT)

  // Stars come out after dark, and the sun and moon go down behind the scenery
  for (const [x, y, size] of STARS) {
    if (x > W) continue
    ctx.globalAlpha = day.night * (0.55 + 0.45 * Math.sin(time * 2 + x))
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, size, size)
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = '#ffe9a0'
  ctx.beginPath()
  ctx.arc(W * 0.72, day.sunY, 30, 0, Math.PI * 2)
  ctx.fill()
  // A crescent moon: its disc, less a bite out of it
  ctx.save()
  ctx.beginPath()
  ctx.arc(W * 0.28, day.moonY, 22, 0, Math.PI * 2)
  ctx.clip()
  ctx.arc(W * 0.28 + 10, day.moonY - 6, 18, 0, Math.PI * 2)
  ctx.fillStyle = '#f4f1ff'
  ctx.fill('evenodd')
  ctx.restore()

  // Clouds drift slower than the pipes, for a bit of depth, dimmer at night
  ctx.fillStyle = `rgb(255 255 255 / ${0.8 - day.night * 0.55})`
  for (const [x, y, r] of CLOUDS) {
    const cx = ((((x - distance * 0.2) % (W + 80)) + W + 80) % (W + 80)) - 40
    for (const [dx, dy, s] of [[0, 0, 1], [r * 0.9, 4, 0.75], [-r * 0.9, 6, 0.7]]) {
      ctx.beginPath()
      ctx.arc(cx + dx, y + dy, r * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // The scenery: the place it's in, fading into the next one as it gets there. Darker at night,
  // but for the city's lit windows.
  const showing = [[PLACES[place.from], 1 - place.t], [PLACES[place.to], place.t]].filter(([, alpha]) => alpha > 0)
  for (const [{ scenery, accent }, alpha] of showing) {
    ctx.globalAlpha = alpha
    SCENERY[scenery](ctx, W, distance, { ...p, accent }, time)
  }
  ctx.fillStyle = NIGHT_INK
  ctx.globalAlpha = day.night * 0.45
  ctx.fillRect(0, 0, W, HEIGHT - GROUND)
  ctx.globalAlpha = 1
  for (const [{ scenery, accent }, alpha] of showing) {
    if (scenery === 'city') windows(ctx, W, distance, accent, Math.max(0, day.night * 1.4 - 0.4) * alpha)
  }

  ctx.lineWidth = 3
  ctx.strokeStyle = COLOURS.outline
  for (const p of game.pipes) {
    // Its colour from where its opening started, so a moving pipe keeps the same one as it drifts
    ctx.fillStyle = COLOURS.pipes[Math.abs(Math.round(p.baseY ?? p.gapY)) % COLOURS.pipes.length]
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

  ctx.fillStyle = mix(p.ground, NIGHT_INK, day.night * 0.35)
  ctx.fillRect(0, HEIGHT - GROUND, W, GROUND)
  ctx.fillStyle = mix(p.groundStripe, NIGHT_INK, day.night * 0.35)
  for (let x = -(distance % 32); x < W; x += 32) {
    ctx.beginPath()
    ctx.moveTo(x, HEIGHT - GROUND + 10)
    ctx.lineTo(x + 16, HEIGHT - GROUND + 10)
    ctx.lineTo(x + 6, HEIGHT)
    ctx.lineTo(x - 10, HEIGHT)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.moveTo(0, HEIGHT - GROUND)
  ctx.lineTo(W, HEIGHT - GROUND)
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
  ctx.strokeText(String(game.score), W / 2, 84)
  ctx.fillStyle = '#fff'
  ctx.fillText(String(game.score), W / 2, 84)
  if (auto) {
    ctx.font = '800 15px system-ui, sans-serif'
    ctx.lineWidth = 5
    ctx.strokeText('AUTO', W / 2, 108)
    ctx.fillStyle = '#fdeca0'
    ctx.fillText('AUTO', W / 2, 108)
  }
}

export default function FlappyHead() {
  const canvas = useRef(null)
  const stage = useRef(null)
  const game = useRef(null)
  const head = useRef(null) // the sprite sheet of whoever's playing, and its frame size
  const looks = useRef(null) // the cheats' effects on it (lib/gameHead.js)
  const { player } = useCheats()
  const [phase, setPhase] = useState('ready') // ready | playing | over
  // A wider board on a wide window (components/useWide.js), picked as each game is set up
  const wide = useWide()
  const wideRef = useRef(wide)
  wideRef.current = wide
  const [boardWide, setBoardWide] = useState(false)
  const [score, setScore] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [scores, setScores] = useState(null) // the board, refreshed after saving
  const [settings, toggleSetting, settingsRef] = useGameSettings('flappy-head', SETTINGS)
  const { cog, panel } = useSettingsPanel(SETTINGS, settings, toggleSetting)
  const GAME = flappyGame(settings)
  const [best, record] = useBest(GAME)
  const { run, begin } = useRun(GAME)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const { pause, resume } = usePause(phaseRef, setPhase)
  // In refs, since the game loop and key handler are set up once
  const recordRef = useRef(record)
  recordRef.current = record
  const beginRef = useRef(begin)
  beginRef.current = begin
  const puffs = useRef([])
  const distance = useRef(0)
  const journey = useRef(0) // how far this run's gone, for the places and the time of day
  const frameTime = useRef(0) // the animation's clock, in seconds, so puffs age in step with it
  const auto = useRef(false) // auto flap's on (it plays itself)
  const plan = useRef(null) // auto flap's plan, from one frame to the next
  const scoreTaps = useRef([]) // when the score was last tapped (ms)
  const [autoUsed, setAutoUsed] = useState(false) // this game, so it can't go on the board

  // A game auto flap's been on for is marked (`auto`), so it doesn't count
  const fresh = () => {
    setBoardWide(wideRef.current)
    plan.current = null
    return {
      ...start({
        ...settingsRef.current,
        radius: RADIUS * (cheatOn('bighead') ? 1.6 : 1),
        easy: cheatOn('easy'),
        width: wideRef.current ? WIDE_WIDTH : WIDTH,
      }),
      auto: auto.current,
    }
  }

  // New settings (or the saved ones, once they load): ready to go with them, and their scores
  useEffect(() => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') return
    game.current = fresh()
    journey.current = 0
    setScores(null)
    setScore(0)
    setPhase('ready')
  }, [GAME, wide])

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
        let now = before
        if (auto.current) {
          const next = autoFlap(before, plan.current)
          plan.current = next.plan
          if (next.flap) now = flapNow(before)
        }
        game.current = step(now, dt)
        distance.current += SPEED * dt
        journey.current += SPEED * dt
        if (game.current.score !== before.score) {
          setScore(game.current.score)
          feedback('point')
        }
        if (game.current.dead) {
          feedback('splat')
          setPhase('over')
          setAutoUsed(!!game.current.auto)
          setNewBest(!game.current.easy && !game.current.auto && recordRef.current(game.current.score))
        }
      } else if (phaseRef.current === 'ready') {
        // Bob gently while waiting to start
        game.current = { ...game.current, y: HEIGHT * 0.42 + Math.sin(now / 300) * 8, vy: Math.cos(now / 300) * -60 }
        distance.current += SPEED * dt * 0.5
      }
      ctx.setTransform(el.width / game.current.width, 0, 0, el.height / HEIGHT, 0, 0)
      frameTime.current = now / 1000
      puffs.current = puffs.current.filter((p) => frameTime.current - p.time < PUFF_SECONDS)
      const scroll = phaseRef.current === 'playing' && !game.current.dead ? SPEED : phaseRef.current === 'ready' ? SPEED * 0.5 : 0
      draw(ctx, game.current, head.current, looks.current, distance.current, journey.current, puffs.current, frameTime.current, scroll, auto.current)
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
    journey.current = 0
    setScore(0)
    setNewBest(false)
    setPhase('playing')
    beginRef.current()
  }
  function press() {
    if (phaseRef.current === 'playing') game.current = flapNow(game.current)
    else if (phaseRef.current === 'ready') play()
  }

  // A tap on the stage flaps (or starts it). Three quick ones on the score turn auto flap on or off;
  // on, it marks this game as played with it. (Australia Mode has the page upside down, so the
  // tap's flipped.)
  function tap(e) {
    e.preventDefault()
    press()
    const box = stage.current.getBoundingClientRect()
    const W = game.current.width
    let [x, y] = [((e.clientX - box.left) / box.width) * W, ((e.clientY - box.top) / box.height) * HEIGHT]
    if (document.documentElement.hasAttribute('data-cheat-australia')) [x, y] = [W - x, HEIGHT - y]
    if (Math.abs(x - W / 2) > SCORE_TAP.halfWidth || y < SCORE_TAP.top || y > SCORE_TAP.bottom) return void (scoreTaps.current = [])
    const now = performance.now()
    scoreTaps.current = [...scoreTaps.current.filter((t) => now - t < SCORE_TAP.within), now]
    if (scoreTaps.current.length < 3) return
    scoreTaps.current = []
    auto.current = !auto.current
    plan.current = null
    if (auto.current) game.current = { ...game.current, auto: true }
    feedback(auto.current ? 'bonus' : 'whiff')
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
        <div className="game-screen">
          <GameBar>
            {phase === 'playing' ? <PauseButton onPause={pause} /> : phase !== 'paused' && cog}
          </GameBar>
          <div className={`game-stage${boardWide ? ' wide' : ''}`} ref={stage} onPointerDown={tap}>
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
                <ScoreEntry game={GAME} score={score} run={run} easy={game.current?.easy || autoUsed} cheat={autoUsed ? 'Auto flap' : 'Easy mode'} onSaved={setScores} />
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
