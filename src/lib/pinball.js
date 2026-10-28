// The physics and rules of Pinball (pages/Pinball.jsx), kept free of the DOM so they can be unit
// tested. A table is a fixed WIDTH × HEIGHT box in its own units (y grows downwards); the page
// scales it to the screen. The ball is Caleb's head.
//
// Every table shares the same frame (side walls, the arc over the top, the shooter lane, the guides
// and flippers at the bottom) and fills the space above with its own pieces:
// - walls: segments the ball bounces off
// - kickers: slingshot faces that kick the ball away when hit
// - bumpers: circles that kick it away from their centre
// - holes: grab the ball for a moment, then fire it out again
// - rollovers: lanes that light a letter each; light the whole word for a bonus and a multiplier
// Each frame is split into small substeps so a fast ball can't pass through a thin wall.
export const WIDTH = 360
export const HEIGHT = 640
export const BALL = 11 // radius
export const BALLS = 3 // per game
// Easy Mode (a secret cheat): an extra ball, and the table tilted a little less
const EASY = { balls: 1, gravity: 0.9 }
const GRAVITY = 820 // the table's tilt
const MAX_SPEED = 1500
const SUBSTEPS = 10
const BOUNCE = 0.45 // walls and flippers keep this much of the speed into them
const BUMPER_KICK = 560 // a bumper sends the ball away at least this fast
const KICKER_KICK = 300 // and a slingshot face this fast (any harder and a ball can ping-pong between the two forever)
const KICKER_POINTS = 10
const HOLE = { hold: 0.7, cooldown: 0.6 } // seconds it holds the ball, then can't grab it again
const LAUNCH = { min: 900, max: 1180 } // the plunger's speed, random each time: some balls ride the whole arc, some drop in early
export const ROLLOVER_POINTS = 50
export const WORD_BONUS = 1000 // times the multiplier, which then goes up by one
// The fastest anyone could score, for the server's sanity check: a bumper hit every 0.06 seconds,
// with a generous multiplier, plus the odd bonus and hole
export const POINTS_PER_SECOND = 8000

// The shooter lane down the right-hand side, where each ball starts
export const LANE = { left: 318, right: 348, floor: 612 }
export const LAUNCH_SPOT = { x: (LANE.left + LANE.right) / 2, y: LANE.floor - BALL }

// Flippers swing between rest and up, about their pivot. Angles in radians, 0 = pointing right.
const FLIPPER = { length: 58, radius: 7, rest: 0.52, up: -0.52, speed: 22 }
// Far enough apart that a ball can drop between them at rest
export const FLIPPERS = {
  left: { x: 92, y: 552, side: 1 },
  right: { x: 238, y: 552, side: -1 },
}
const flipperAngle = (side, raised) => {
  const a = raised ? FLIPPER.up : FLIPPER.rest
  return side === 1 ? a : Math.PI - a
}
export function flipperTip(f, angle) {
  return [f.x + Math.cos(angle) * FLIPPER.length, f.y + Math.sin(angle) * FLIPPER.length]
}

// The top is an arc, made of short segments
const ARC = { x: 180, y: 180, r: 168 }
const arcPoints = Array.from({ length: 19 }, (_, i) => {
  const a = Math.PI + (i / 18) * Math.PI // left (180°) over the top to right (360°)
  return [ARC.x + ARC.r * Math.cos(a), ARC.y + ARC.r * Math.sin(a)]
})
export const FRAME = [
  [12, 180, 12, 470], // left side
  [348, 180, 348, 640], // right side (the lane's outer wall)
  [LANE.left, 640, LANE.left, 210], // the lane's inner wall
  [LANE.left, LANE.floor, LANE.right, LANE.floor], // the plunger
  [12, 470, 90, 546], // left guide, down to the flipper
  [LANE.left, 470, 240, 546], // right guide
  ...arcPoints.slice(1).map(([x, y], i) => [arcPoints[i][0], arcPoints[i][1], x, y]),
]

// Slingshots above the flippers: a kicking face toward the middle, closed off behind. They sit
// high enough to leave a channel (wider than the ball) down the guide to each flipper.
const SLINGS = {
  walls: [
    [44, 404, 44, 458],
    [44, 458, 80, 482],
    [286, 404, 286, 458],
    [286, 458, 250, 482],
  ],
  kickers: [
    [44, 404, 80, 482],
    [286, 404, 250, 482],
  ],
}

// Top lanes spelling `word`, evenly spread between x = from and x = to, with dividers between
function lanes(word, from, to) {
  const n = word.length
  const step = (to - from) / n
  return {
    rollovers: [...word].map((letter, i) => ({ x: from + step * (i + 0.5), y: 84, letter, w: step / 2 - 4 })),
    walls: Array.from({ length: n - 1 }, (_, i) => [from + step * (i + 1), 62, from + step * (i + 1), 104]),
  }
}

function table({ id, name, word, from = 90, to = 270, walls = [], kickers = [], bumpers = [], holes = [], theme }) {
  const top = lanes(word, from, to)
  return {
    id,
    name,
    word,
    walls: [...FRAME, ...SLINGS.walls, ...top.walls, ...walls],
    kickers: [...SLINGS.kickers, ...kickers],
    bumpers,
    holes,
    rollovers: top.rollovers,
    theme,
  }
}

export const TABLES = [
  table({
    id: 'classic',
    name: 'Classic',
    word: 'CAL',
    walls: [
      // Turns a ball riding the arc back into the middle, instead of down the left wall
      [23, 120, 66, 158],
      [60, 330, 72, 372],
      [276, 372, 288, 330],
    ],
    bumpers: [
      { x: 118, y: 220, r: 24, points: 100 },
      { x: 222, y: 214, r: 24, points: 100 },
      { x: 170, y: 300, r: 24, points: 100 },
    ],
    theme: 'classic',
  }),
  table({
    id: 'mainframe',
    name: 'Mainframe',
    word: 'HACK',
    from: 80,
    to: 280,
    walls: [
      [23, 120, 66, 158],
      // A "firewall" funnel in the middle, open at the bottom
      [130, 360, 150, 392],
      [200, 360, 180, 392],
    ],
    bumpers: [
      { x: 105, y: 222, r: 21, points: 100 },
      { x: 165, y: 190, r: 21, points: 100 },
      { x: 225, y: 222, r: 21, points: 100 },
      { x: 165, y: 270, r: 21, points: 150 },
    ],
    // The backdoor: grabs the ball and fires it back up the middle
    holes: [{ x: 46, y: 300, r: 15, points: 500, eject: [520, -620], label: 'BACKDOOR' }],
    theme: 'mainframe',
  }),
  table({
    id: 'space',
    name: 'Close Encounters',
    word: 'UFO',
    walls: [
      [23, 120, 66, 158],
      // Asteroids: short angled walls
      [258, 330, 286, 316],
      [44, 300, 60, 330],
    ],
    kickers: [[120, 392, 150, 404]],
    // Planets of different sizes
    bumpers: [
      { x: 112, y: 232, r: 28, points: 100 },
      { x: 236, y: 256, r: 20, points: 150 },
      { x: 178, y: 326, r: 15, points: 200 },
    ],
    // A black hole near the top right flings the ball back out to the left
    holes: [{ x: 262, y: 160, r: 16, points: 500, eject: [-560, 120], label: 'BLACK HOLE' }],
    theme: 'space',
  }),
  table({
    id: 'disco',
    name: 'Dance Floor',
    word: 'DISCO',
    from: 78,
    to: 282,
    walls: [[23, 120, 66, 158]],
    // A W of small, quick bumpers
    bumpers: [
      { x: 90, y: 220, r: 16, points: 100 },
      { x: 130, y: 280, r: 16, points: 100 },
      { x: 170, y: 220, r: 16, points: 100 },
      { x: 210, y: 280, r: 16, points: 100 },
      { x: 250, y: 220, r: 16, points: 100 },
    ],
    kickers: [
      [100, 352, 140, 372],
      [240, 352, 200, 372],
    ],
    theme: 'disco',
  }),
]
export const tableById = (id) => TABLES.find((t) => t.id === id) ?? TABLES[0]

export function start(t = TABLES[0], { easy = false } = {}) {
  return {
    table: t.id,
    ball: { ...LAUNCH_SPOT, vx: 0, vy: 0 },
    inLane: true, // waiting for a launch
    flippers: {
      left: { angle: flipperAngle(1, false), spin: 0 },
      right: { angle: flipperAngle(-1, false), spin: 0 },
    },
    score: 0,
    balls: BALLS + (easy ? EASY.balls : 0), // left, including the one in play
    total: BALLS + (easy ? EASY.balls : 0),
    easy,
    lit: t.rollovers.map(() => false),
    rolling: null, // the top lane the ball is in right now, so it lights once on the way in
    multiplier: 1,
    flash: { bumpers: t.bumpers.map(() => 0), kickers: t.kickers.map(() => 0) }, // seconds left on each hit flash
    held: null, // { hole, t }: a hole has the ball
    cooldown: 0,
    over: false,
  }
}

export function launch(state, random = Math.random) {
  if (!state.inLane || state.over) return state
  const speed = LAUNCH.min + random() * (LAUNCH.max - LAUNCH.min)
  return { ...state, inLane: false, ball: { ...state.ball, vx: 0, vy: -speed } }
}

// Closest point on segment a→b to p
function closest(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)))
  return [x1 + dx * t, y1 + dy * t]
}

// Bounce the ball off a surface touching it at (cx, cy) with `reach` = ball radius plus the
// surface's own thickness. (svx, svy) is how fast the surface itself is moving there (a swinging
// flipper), so a flipper hits the ball rather than just being in the way. Returns the hit's normal.
function collide(ball, cx, cy, reach, svx = 0, svy = 0) {
  const dx = ball.x - cx
  const dy = ball.y - cy
  const d = Math.hypot(dx, dy)
  if (d >= reach || d === 0) return null
  const nx = dx / d
  const ny = dy / d
  ball.x = cx + nx * reach
  ball.y = cy + ny * reach
  const rvx = ball.vx - svx
  const rvy = ball.vy - svy
  const vn = rvx * nx + rvy * ny
  if (vn < 0) {
    ball.vx = rvx - (1 + BOUNCE) * vn * nx + svx
    ball.vy = rvy - (1 + BOUNCE) * vn * ny + svy
  }
  return [nx, ny]
}

// Make sure the ball leaves along (nx, ny) at least `speed` fast
function kick(ball, nx, ny, speed) {
  const out = ball.vx * nx + ball.vy * ny
  if (out < speed) {
    ball.vx += (speed - out) * nx
    ball.vy += (speed - out) * ny
  }
}

// One frame. `held` says which flippers are up: { left, right }.
export function step(state, dt, held = {}, t = tableById(state.table)) {
  if (state.over) return state
  const s = structuredClone(state)
  const h = dt / SUBSTEPS
  s.flash.bumpers = s.flash.bumpers.map((f) => Math.max(0, f - dt))
  s.flash.kickers = s.flash.kickers.map((f) => Math.max(0, f - dt))
  s.cooldown = Math.max(0, s.cooldown - dt)

  for (let i = 0; i < SUBSTEPS; i++) {
    // Flippers swing toward where they should be
    for (const name of ['left', 'right']) {
      const flipper = s.flippers[name]
      const diff = flipperAngle(FLIPPERS[name].side, held[name]) - flipper.angle
      const move = Math.sign(diff) * Math.min(Math.abs(diff), FLIPPER.speed * h)
      flipper.angle += move
      flipper.spin = move / h
    }
    if (s.inLane) break // the ball sits on the plunger

    const b = s.ball
    // In a hole: held still, then fired out
    if (s.held) {
      s.held.t -= h
      if (s.held.t > 0) continue
      const hole = t.holes[s.held.hole]
      ;[b.vx, b.vy] = hole.eject
      s.held = null
      s.cooldown = HOLE.cooldown
    }

    b.vy += GRAVITY * (s.easy ? EASY.gravity : 1) * h
    const speed = Math.hypot(b.vx, b.vy)
    if (speed > MAX_SPEED) {
      b.vx *= MAX_SPEED / speed
      b.vy *= MAX_SPEED / speed
    }
    b.x += b.vx * h
    b.y += b.vy * h

    for (const [x1, y1, x2, y2] of t.walls) collide(b, ...closest(b.x, b.y, x1, y1, x2, y2), BALL)

    t.kickers.forEach(([x1, y1, x2, y2], n) => {
      const hit = collide(b, ...closest(b.x, b.y, x1, y1, x2, y2), BALL)
      if (!hit) return
      kick(b, ...hit, KICKER_KICK)
      if (s.flash.kickers[n] <= 0.05) s.score += KICKER_POINTS * s.multiplier
      s.flash.kickers[n] = 0.12
    })

    for (const name of ['left', 'right']) {
      const f = FLIPPERS[name]
      const { angle, spin } = s.flippers[name]
      const [tx, ty] = flipperTip(f, angle)
      const [cx, cy] = closest(b.x, b.y, f.x, f.y, tx, ty)
      // The surface's speed where it touches: spin × distance from the pivot, at right angles
      collide(b, cx, cy, BALL + FLIPPER.radius, -spin * (cy - f.y), spin * (cx - f.x))
    }

    t.bumpers.forEach((bumper, n) => {
      const hit = collide(b, bumper.x, bumper.y, BALL + bumper.r)
      if (!hit) return
      kick(b, ...hit, BUMPER_KICK)
      if (s.flash.bumpers[n] <= 0.05) s.score += bumper.points * s.multiplier
      s.flash.bumpers[n] = 0.15
    })

    if (!s.cooldown) {
      const n = t.holes.findIndex((hole) => Math.hypot(b.x - hole.x, b.y - hole.y) < hole.r)
      if (n >= 0) {
        const hole = t.holes[n]
        s.ball = { x: hole.x, y: hole.y, vx: 0, vy: 0 }
        s.held = { hole: n, t: HOLE.hold }
        s.score += hole.points * s.multiplier
        continue
      }
    }

    const lane = t.rollovers.findIndex((r) => Math.abs(b.x - r.x) <= r.w && Math.abs(b.y - r.y) <= 14)
    const entered = lane >= 0 && lane !== s.rolling ? lane : -1
    s.rolling = lane >= 0 ? lane : null
    if (entered >= 0 && !s.lit[entered]) {
      s.lit[entered] = true
      s.score += ROLLOVER_POINTS * s.multiplier
      if (s.lit.every(Boolean)) {
        s.score += WORD_BONUS * s.multiplier
        s.multiplier++
        s.lit = s.lit.map(() => false)
      }
    }

    // Back down the lane: it sits on the plunger again, ready for another launch (no ball lost)
    if (b.x > LANE.left && b.y >= LAUNCH_SPOT.y - 1 && Math.abs(b.vy) < 60) {
      s.ball = { ...LAUNCH_SPOT, vx: 0, vy: 0 }
      s.inLane = true
      break
    }

    // Down the middle: that ball's gone
    if (b.y > HEIGHT + BALL) {
      s.balls--
      if (s.balls <= 0) {
        s.over = true
        s.ball = { ...b, vx: 0, vy: 0 }
      } else {
        s.ball = { ...LAUNCH_SPOT, vx: 0, vy: 0 }
        s.inLane = true
      }
      break
    }
  }
  return s
}
