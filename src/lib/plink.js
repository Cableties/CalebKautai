import { allSettingsGames, settingsGame } from './settings.js'

// The rules of Plink (pages/Plink.jsx), kept free of the DOM so they can be unit tested. The
// screen is a WIDTH (wider on a desktop) × HEIGHT box in its own units (y grows downwards). The
// launcher's at the top: aim, and fire the ball (my head) down into a board of pegs. It bounces off
// them under gravity, lighting each one it touches, and the lit ones go once it's off the bottom.
// Clear every gold peg to finish the level; run out of balls first and it's over. A bucket slides
// along the bottom: land in it for a free ball.
//
// Each peg lit in a shot is worth more than the last: every five steps the multiplier up. Power-up
// pegs (green) do their thing when they're hit: an extra ball, a blast that lights everything
// round it, a longer aiming guide, or a bigger bucket. A pink peg is a big bonus.
//
// The ball moves in fixed steps (SUB seconds), and so do the moving pegs and bucket, so the aiming
// guide (aimed()) takes exactly the path a shot fired now would.
export const WIDTH = 360
export const HEIGHT = 640
export const HUD = 44
export const BALL_R = 8
export const PEG_R = 7
export const LAUNCHER = { y: HUD + 30 }
const SUB = 1 / 240 // seconds per step
const GRAVITY = 620
const LAUNCH = 470
const WIDE_LAUNCH = 1.3 // times as fast on a wide board, to reach its far top corners
const MAX_SPEED = 900
const BOUNCE = { peg: 0.72, wall: 0.85 }
// Radians either side of straight down (a little past level, for the top corners); radians per
// second with keys
const AIM = { max: 1.85, turn: 1.4 }
export const BUCKET = { y: HEIGHT - 22, width: 76, big: 124, rim: 6, speed: 0.7 }
const BALLS = { normal: 10, wide: 12, easy: 3 } // a level's balls (and Easy Mode's extra)
const STILL = { distance: 18, seconds: 1.5 } // a ball that hasn't got this far in this long is stuck
const POINTS = { plain: 10, gold: 50, power: 25, bonus: 300 }
const CHAIN = 5 // pegs in a shot for each step up in its multiplier
const CLEAR_BONUS = 500 // per ball left, when a level's cleared
const BLAST = 80 // how far round a blast lights pegs
const SWAY = { amp: 22, speed: 0.9 } // moving pegs
export const POWERS = { multi: 'Extra ball!', blast: 'Blast!', aim: 'Long aim ×3', bucket: 'Big bucket ×3' }

export const SETTINGS = [
  { id: 'nopowers', name: 'No power-ups', note: 'Just pegs.' },
  { id: 'nobucket', name: 'No bucket', note: 'No catching the ball for another go.' },
  { id: 'moving', name: 'Moving pegs', note: 'Rows of pegs slide from side to side.' },
]
export const plinkGame = (settings = {}) => settingsGame('plink', SETTINGS, settings)
export const PLINK_GAMES = allSettingsGames('plink', SETTINGS)

// The fastest anyone could score, for the server's sanity check: a long chain of bonus pegs every
// second, far beyond anything playable
export const POINTS_PER_SECOND = 500_000

export const launcherX = (s) => s.width / 2

// Where the pegs go: a pattern for each level, going round
const AREA = { top: 150, bottom: 560, margin: 26, spacing: 34 }
function grid(W) {
  const out = []
  for (let r = 0, y = AREA.top; y <= AREA.bottom; r++, y += 42) {
    for (let x = AREA.margin + (r % 2 ? 22 : 0); x <= W - AREA.margin; x += 44) out.push([x, y])
  }
  return out
}
function waves(W) {
  const out = []
  for (let r = 0, y = AREA.top + 16; y <= AREA.bottom - 16; r++, y += 58) {
    for (let x = AREA.margin; x <= W - AREA.margin; x += 36) out.push([x, y + Math.sin(x / 46 + r * 1.7) * 18])
  }
  return out
}
function rings(W) {
  const out = []
  const across = Math.max(2, Math.round((W - 40) / 170))
  for (const cy of [250, 450]) {
    for (let i = 0; i < across; i++) {
      const cx = (W * (i + 0.5)) / across
      out.push([cx, cy])
      for (let k = 0; k < 12; k++) out.push([cx + Math.cos((k * Math.PI) / 6) * 66, cy + Math.sin((k * Math.PI) / 6) * 66])
    }
  }
  for (let x = AREA.margin; x <= W - AREA.margin; x += 40) out.push([x, 350], [x + 20, AREA.bottom])
  return out
}
function arches(W) {
  const out = []
  for (let r = 0; r < 5; r++) {
    for (let x = AREA.margin + (r % 2) * 18; x <= W - AREA.margin; x += 36) {
      const t = (x - W / 2) / (W / 2)
      out.push([x, AREA.top + 70 + r * 80 - (1 - t * t) * 60])
    }
  }
  return out
}
function spiral(W) {
  const out = []
  const n = Math.max(1, Math.round(W / 360))
  for (let i = 0; i < n; i++) {
    const cx = (W * (i + 0.5)) / n
    for (let r = 20, a = i * Math.PI; r < 200; a += 36 / r, r += (36 / r) * 7) {
      out.push([cx + Math.cos(a) * r, 360 + Math.sin(a) * r])
    }
  }
  for (let x = AREA.margin; x <= W - AREA.margin; x += 44) out.push([x, AREA.bottom])
  return out
}
export const PATTERNS = [grid, waves, rings, arches, spiral]

// Just the ones on the board, and no two too close
function spaced(points, W) {
  const kept = []
  for (const [x, y] of points) {
    if (x < AREA.margin - 1 || x > W - AREA.margin + 1 || y < AREA.top - 30 || y > AREA.bottom + 1) continue
    if (kept.every(([kx, ky]) => Math.hypot(kx - x, ky - y) >= AREA.spacing)) kept.push([x, y])
  }
  return kept
}

function shuffled(n, random) {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

function level(s, random) {
  const points = spaced(PATTERNS[(s.level - 1) % PATTERNS.length](s.width), s.width)
  // Moving pegs slide in bands, each the other way to the ones above it
  s.pegs = points.map(([x, y]) => ({
    x,
    y,
    kind: 'plain',
    lit: false,
    gone: false,
    sway: s.moving ? (Math.floor((y - AREA.top + 30) / 70) % 2 ? -1 : 1) : 0,
  }))
  const order = shuffled(s.pegs.length, random)
  // A wide board has more than twice the pegs, so fewer of them gold, to clear in a few more balls
  const golds = Math.round(s.pegs.length * Math.min(0.3, 0.2 + 0.02 * (s.level - 1)) * Math.sqrt(WIDTH / s.width))
  order.slice(0, golds).forEach((i) => (s.pegs[i].kind = 'gold'))
  if (s.pegs[order[golds]]) s.pegs[order[golds]].kind = 'bonus'
  if (s.powers) {
    const kinds = Object.keys(POWERS).filter((k) => k !== 'bucket' || s.bucket)
    for (const i of order.slice(golds + 1, golds + 3)) Object.assign(s.pegs[i], { kind: 'power', power: kinds[Math.floor(random() * kinds.length)] })
  }
  s.balls = (s.width > WIDTH ? BALLS.wide : BALLS.normal) + (s.easy ? BALLS.easy : 0)
}

// `width`: the screen's width (wider on a desktop)
// `superAim`: the aiming guide's longest, switched on and off mid-game (it doesn't get its own high
// scores)
export function start(
  { easy = false, nopowers = false, nobucket = false, moving = false, superAim = false, width = WIDTH } = {},
  random = Math.random,
) {
  const s = {
    width,
    easy,
    superAim,
    moving,
    powers: !nopowers,
    bucket: !nobucket,
    level: 1,
    score: 0,
    aim: 0,
    clock: 0, // seconds, in whole steps: where the moving pegs and bucket are
    due: 0, // time owed from frames that weren't a whole number of steps
    inPlay: [], // balls in flight: { x, y, vx, vy, ax, ay, still } (ax, ay, still: for spotting a stuck one)
    chain: 0, // pegs lit this shot
    shotScore: 0,
    longAim: 0, // shots left with the long aiming guide
    bigBucket: 0, // shots left with the big bucket
    over: false,
    pops: [], // pegs just gone, for the burst: { x, y, kind, age }
    labels: [], // power-ups and such, for their name: { x, y, text, age }
  }
  level(s, random)
  return s
}

export const pegX = (s, p, clock = s.clock) => p.x + p.sway * SWAY.amp * Math.sin(clock * SWAY.speed + p.y / 50)
export const bucketWidth = (s) => (s.bigBucket > 0 ? BUCKET.big : BUCKET.width)
export function bucketX(s, clock = s.clock) {
  const reach = s.width / 2 - bucketWidth(s) / 2 - 8
  return s.width / 2 + reach * Math.sin((clock * BUCKET.speed * WIDTH) / s.width)
}

// Aim at a point (a finger or the mouse), within the limits
export function aimAt(state, x, y) {
  const angle = Math.atan2(x - launcherX(state), y - LAUNCHER.y)
  return { ...state, aim: Math.max(-AIM.max, Math.min(AIM.max, angle)) }
}

// Turn the aim by `by` radians (a finger dragging), within the limits
export const turn = (state, by) => ({ ...state, aim: Math.max(-AIM.max, Math.min(AIM.max, state.aim + by)) })

const launch = (s) => ({
  x: launcherX(s),
  y: LAUNCHER.y,
  vx: Math.sin(s.aim) * LAUNCH * (s.width > WIDTH ? WIDE_LAUNCH : 1),
  vy: Math.cos(s.aim) * LAUNCH * (s.width > WIDTH ? WIDE_LAUNCH : 1),
  ax: launcherX(s),
  ay: LAUNCHER.y,
  still: 0,
})

export function fire(state) {
  if (state.inPlay.length || state.over || state.balls <= 0) return state
  return {
    ...state,
    inPlay: [launch(state)],
    balls: state.balls - 1,
    chain: 0,
    shotScore: 0,
    longAim: Math.max(0, state.longAim - 1),
    fired: true,
  }
}

// Off a circle at (cx, cy) of radius r, if it's touching; true if it bounced
function bounce(ball, cx, cy, r) {
  const reach = r + BALL_R
  const dy = ball.y - cy
  if (Math.abs(dy) >= reach) return false
  const dx = ball.x - cx
  const d = Math.hypot(dx, dy)
  if (d >= reach || d === 0) return false
  const [nx, ny] = [dx / d, dy / d]
  ball.x += nx * (reach - d)
  ball.y += ny * (reach - d)
  const along = ball.vx * nx + ball.vy * ny
  if (along >= 0) return false
  ball.vx -= (1 + BOUNCE.peg) * along * nx
  ball.vy -= (1 + BOUNCE.peg) * along * ny
  return true
}

// A ball one step along, at `clock` (where the moving things are). Calls hit(peg) for each peg it
// bounces off. Returns 'caught' (in the bucket), 'gone' (off the bottom), or null.
function move(s, ball, clock, hit) {
  ball.vy += GRAVITY * SUB
  ball.x += ball.vx * SUB
  ball.y += ball.vy * SUB
  if (ball.x < BALL_R) {
    ball.x = BALL_R
    ball.vx = Math.abs(ball.vx) * BOUNCE.wall
  } else if (ball.x > s.width - BALL_R) {
    ball.x = s.width - BALL_R
    ball.vx = -Math.abs(ball.vx) * BOUNCE.wall
  }
  if (ball.y < HUD + BALL_R) {
    ball.y = HUD + BALL_R
    ball.vy = Math.abs(ball.vy) * BOUNCE.wall
  }
  for (const p of s.pegs) {
    if (!p.gone && bounce(ball, pegX(s, p, clock), p.y, PEG_R)) hit(p)
  }
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed > MAX_SPEED) {
    ball.vx *= MAX_SPEED / speed
    ball.vy *= MAX_SPEED / speed
  }
  if (s.bucket) {
    const bx = bucketX(s, clock)
    const half = bucketWidth(s) / 2
    bounce(ball, bx - half, BUCKET.y, BUCKET.rim)
    bounce(ball, bx + half, BUCKET.y, BUCKET.rim)
    const was = ball.y - ball.vy * SUB
    if (ball.y >= BUCKET.y && was < BUCKET.y && Math.abs(ball.x - bx) < half - BUCKET.rim) return 'caught'
  }
  return ball.y > HEIGHT + BALL_R ? 'gone' : null
}

// Where a shot fired now would go, for the aiming guide: its path, up to its first peg (or third,
// with the long guide; second in Easy Mode; fifth with Super Aim, the page's hidden cheat), and where it touches that one (`contact`, or null if it
// touches none), and which peg (`peg`, its index)
export function aimed(state) {
  const hits = state.superAim ? 5 : state.longAim > 0 ? 3 : state.easy ? 2 : 1
  const ball = launch(state)
  const points = [[ball.x, ball.y]]
  let clock = state.clock
  let last = null
  let count = 0
  for (let i = 1; i <= 3 / SUB; i++) {
    clock += SUB
    let touched = null
    const out = move(state, ball, clock, (p) => (touched ??= p))
    if (i % 5 === 0) points.push([ball.x, ball.y])
    if (touched && touched !== last) {
      last = touched
      if (++count >= hits) {
        points.push([ball.x, ball.y])
        return { points, contact: [ball.x, ball.y], peg: state.pegs.indexOf(touched) }
      }
    }
    if (out) break
  }
  points.push([ball.x, ball.y])
  return { points, contact: null, peg: -1 }
}

// A peg lit: its points (more the longer the chain), and its power-up if it has one
function light(s, p, ball, added) {
  if (p.lit) return
  p.lit = true
  s.chain++
  const points = POINTS[p.kind] * s.level * (1 + Math.floor((s.chain - 1) / CHAIN))
  s.score += points
  s.shotScore += points
  const x = pegX(s, p)
  // What the sound's for: gold over the rest
  if (s.hit !== 'gold') s.hit = p.kind
  if (p.kind === 'gold' && !s.pegs.some((q) => q.kind === 'gold' && !q.lit)) {
    s.labels.push({ x, y: p.y, text: 'Last gold!', age: 0 })
    s.lastGold = true
  }
  if (p.kind === 'bonus') s.labels.push({ x, y: p.y, text: `+${points}`, age: 0 })
  if (p.kind !== 'power') return
  s.labels.push({ x, y: p.y, text: POWERS[p.power], age: 0 })
  s.powered = p.power
  if (p.power === 'multi') added.push({ ...ball, vx: -ball.vx || 120, ax: ball.x, ay: ball.y, still: 0 })
  if (p.power === 'aim') s.longAim = 3
  // The rest of this shot, and the next three
  if (p.power === 'bucket') s.bigBucket = 4
  if (p.power === 'blast') {
    for (const q of s.pegs) if (!q.gone && Math.hypot(pegX(s, q) - x, q.y - p.y) < BLAST) light(s, q, ball, added)
  }
}

// A ball that's stopped moving, wedged between pegs or sitting on one: the pegs round it go
function unstick(s, ball, added) {
  const near = s.pegs.filter((p) => !p.gone && Math.hypot(pegX(s, p) - ball.x, p.y - ball.y) < BALL_R + PEG_R + 8)
  for (const p of near) {
    light(s, p, ball, added)
    p.gone = true
    s.pops.push({ x: pegX(s, p), y: p.y, kind: p.kind, age: 0 })
  }
  // On the bucket's rim, say: a nudge
  if (!near.length) ball.vx += ball.x < s.width / 2 ? 80 : -80
}

// The shot's over (every ball's gone): its lit pegs go, then on to the next level, or the next shot,
// or it's over
function settle(s, random) {
  for (const p of s.pegs) if (p.lit && !p.gone) s.pops.push({ x: pegX(s, p), y: p.y, kind: p.kind, age: 0 })
  s.pegs = s.pegs.filter((p) => !p.lit && !p.gone)
  if (s.shotScore) s.labels.push({ x: s.width / 2, y: HEIGHT - 70, text: `+${s.shotScore}`, age: 0 })
  s.bigBucket = Math.max(0, s.bigBucket - 1)
  s.settled = true
  if (!s.pegs.some((p) => p.kind === 'gold')) {
    const bonus = s.balls * CLEAR_BONUS * s.level
    s.score += bonus
    s.labels.push({ x: s.width / 2, y: HEIGHT / 2, text: bonus ? `Cleared! +${bonus}` : 'Cleared!', age: 0 })
    s.level++
    s.cleared = true
    s.longAim = 0
    s.bigBucket = 0
    level(s, random)
    return
  }
  if (s.balls === 0) s.over = true
}

// One frame. `input`: { left, right } (keys held, turning the aim). Flags what happened this frame,
// for the sounds: `fired`, `hit` (the kind of peg), `lastGold`, `powered`, `caught` (a free ball),
// `settled` (the shot's over), `cleared` (a level done).
export function step(state, dt, input = {}, random = Math.random) {
  if (state.over) return state
  const s = structuredClone(state)
  Object.assign(s, { fired: false, hit: null, lastGold: false, powered: null, caught: false, settled: false, cleared: false })
  s.pops = s.pops.map((p) => ({ ...p, age: p.age + dt })).filter((p) => p.age < 0.35)
  s.labels = s.labels.map((l) => ({ ...l, age: l.age + dt })).filter((l) => l.age < 1.2)
  if (input.left) s.aim = Math.max(-AIM.max, s.aim - AIM.turn * dt)
  if (input.right) s.aim = Math.min(AIM.max, s.aim + AIM.turn * dt)

  s.due += dt
  while (s.due >= SUB) {
    s.due -= SUB
    s.clock += SUB
    if (!s.inPlay.length) continue
    const added = []
    s.inPlay = s.inPlay.filter((ball) => {
      const out = move(s, ball, s.clock, (p) => light(s, p, ball, added))
      if (out === 'caught') {
        s.balls++
        s.caught = true
        s.labels.push({ x: bucketX(s), y: BUCKET.y - 30, text: 'Free ball!', age: 0 })
      }
      if (out) return false
      if (Math.hypot(ball.x - ball.ax, ball.y - ball.ay) > STILL.distance) Object.assign(ball, { ax: ball.x, ay: ball.y, still: 0 })
      else if ((ball.still += SUB) > STILL.seconds) {
        unstick(s, ball, added)
        ball.still = 0
      }
      return true
    })
    s.inPlay.push(...added)
    if (!s.inPlay.length) settle(s, random)
    if (s.over) break
  }
  return s
}
