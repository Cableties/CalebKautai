import { allSettingsGames, settingsGame } from './settings.js'

// The rules of Bricks (pages/Bricks.jsx), kept free of the DOM so they can be unit tested. The
// screen is a WIDTH (wider on a desktop) × HEIGHT box in its own units (y grows downwards); the page scales it to
// fit. The ball (the head) bounces off the walls, the bricks and the paddle along the bottom, which
// sends it off at an angle depending on where it hits. Clear the bricks for the next level: a new
// layout, a faster ball. Each frame is split into substeps so a fast ball can't pass through a brick.
//
// A few bricks each level are power-ups, which do their thing the moment they break (POWERS). With
// multi-ball there can be several balls; a life only goes when the last one does.
export const WIDTH = 360
export const HEIGHT = 640
export const BALL = 10 // radius
export const PADDLE = { y: 584, width: 76, height: 12, speed: 420 }
export const BRICK = { cols: 8, width: 40, height: 18, gap: 4, top: 96 }
const SPEED = { start: 340, max: 560, perHit: 6, perLevel: 30 } // the ball's, px/s
const MAX_ANGLE = (62 * Math.PI) / 180 // from straight up, off the paddle's very end
const SUBSTEPS = 6
export const LIVES = 3
// Points by row, top to bottom (a tough brick, which takes two hits, scores double)
export const POINTS = [50, 40, 30, 20, 10, 10, 10, 10]
// Easy Mode (a secret cheat): a wider paddle, a slower ball, a spare life
const EASY = { paddle: 1.3, speed: 0.85, lives: 1 }

// Power-up bricks, and what each does when it breaks (`seconds` for the ones that wear off)
export const POWERS = {
  multi: { label: 'Multi-ball!' }, // two more balls, off the one that broke it
  safety: { label: 'Safety bar!', seconds: 12 }, // a bar along the bottom that bounces balls back up
  plough: { label: 'Plough ball!', seconds: 8 }, // balls smash straight through bricks
  wide: { label: 'Wide paddle!', seconds: 14 },
  slow: { label: 'Slow-mo!', seconds: 10 },
  life: { label: 'Extra ball!' },
}
const POWER_ORDER = ['multi', 'safety', 'plough', 'wide', 'slow', 'multi', 'life']
const POWER_BRICKS = 4 // per level
const SAFETY_Y = HEIGHT - 22

export const SETTINGS = [
  { id: 'nopowers', name: 'No power-ups', note: 'Just bricks, the old way.' },
  { id: 'small', name: 'Small paddle', note: 'Two thirds the size. For the brave.' },
]
export const bricksGame = (settings = {}) => settingsGame('bricks', SETTINGS, settings)
export const BRICKS_GAMES = allSettingsGames('bricks', SETTINGS)

// The fastest anyone could score, for the server's sanity check: tough top-row bricks off every
// bounce of three balls at once, far beyond anything playable
export const POINTS_PER_SECOND = 2000

// The levels, top row first: # a brick, @ a tough one (two hits), . a gap. After the last, they go
// round again, faster each time.
export const LEVELS = [
  ['########', '########', '########', '########', '########'],
  ['@@@@@@@@', '########', '#.#..#.#', '########', '########'],
  ['...##...', '..####..', '.######.', '@@@@@@@@', '.######.', '..####..', '...##...'],
  ['@.@.@.@.', '.#.#.#.#', '#.#.#.#.', '.@.@.@.@', '#.#.#.#.', '.#.#.#.#'],
  ['#......#', '##....##', '@@@..@@@', '########', '@@@@@@@@', '########'],
]
// A wider screen (a desktop) has more columns, each level's layout carried on across
const colsFor = (width) => (width > WIDTH ? 18 : BRICK.cols)

function bricksFor(level, powers, random, width = WIDTH) {
  const layout = LEVELS[(level - 1) % LEVELS.length]
  const cols = colsFor(width)
  const left = (width - (cols * BRICK.width + (cols - 1) * BRICK.gap)) / 2
  const bricks = []
  layout.forEach((line, row) =>
    Array.from({ length: cols }, (_, col) => line[col % line.length]).forEach((c, col) => {
      if (c === '.') return
      bricks.push({
        x: left + col * (BRICK.width + BRICK.gap),
        y: BRICK.top + row * (BRICK.height + BRICK.gap),
        row,
        hits: c === '@' ? 2 : 1,
        tough: c === '@',
        power: null,
      })
    }),
  )
  // A few of the plain ones become power-ups, a different mix each level
  if (powers) {
    const plain = bricks.filter((b) => !b.tough)
    for (let i = 0; i < POWER_BRICKS * (cols / BRICK.cols) && plain.length; i++) {
      const [b] = plain.splice(Math.floor(random() * plain.length), 1)
      b.power = POWER_ORDER[(level - 1 + i) % POWER_ORDER.length]
    }
  }
  return bricks
}

const paddleWidth = (s) => PADDLE.width * (s.easy ? EASY.paddle : 1) * (s.small ? 2 / 3 : 1) * (s.timers.wide > 0 ? 1.6 : 1)
const baseSpeed = (s) => (SPEED.start + (s.level - 1) * SPEED.perLevel) * (s.easy ? EASY.speed : 1)

// One ball sitting on the paddle, ready to launch
const resting = (s) => ({ ...s, balls: [{ x: s.x, y: PADDLE.y - BALL - 1, vx: 0, vy: 0 }], stuck: true, speed: baseSpeed(s) })

// `width`: the screen's width (wider on a desktop)
export function start({ easy = false, nopowers = false, small = false, width = WIDTH } = {}, random = Math.random) {
  const s = {
    width,
    x: width / 2,
    lives: LIVES + (easy ? EASY.lives : 0),
    score: 0,
    level: 1,
    easy,
    small,
    powers: !nopowers,
    timers: { safety: 0, plough: 0, wide: 0, slow: 0 },
    over: false,
    booms: [], // bricks just broken, for the shards: { x, y, row, age }
    labels: [], // power-ups just broken, for their name: { x, y, text, age }
  }
  return resting({ ...s, bricks: bricksFor(1, s.powers, random, width) })
}

export function launch(state, random = Math.random) {
  if (!state.stuck || state.over) return state
  // Off at a slight angle, so it doesn't go straight up and down forever
  const angle = (random() < 0.5 ? -1 : 1) * (0.2 + random() * 0.25)
  const [ball] = state.balls
  return { ...state, stuck: false, balls: [{ ...ball, vx: Math.sin(angle) * state.speed, vy: -Math.cos(angle) * state.speed }] }
}

// A power-up's effect, the moment its brick breaks
function power(s, kind, ball, b) {
  s.labels = [...s.labels, { x: b.x + BRICK.width / 2, y: b.y, text: POWERS[kind].label, age: 0 }]
  if (POWERS[kind].seconds) s.timers = { ...s.timers, [kind]: POWERS[kind].seconds }
  if (kind === 'life') s.lives++
  if (kind === 'multi') {
    // Two more, fanned out either side of the one that broke it
    const speed = Math.hypot(ball.vx, ball.vy) || s.speed
    const angle = Math.atan2(ball.vy, ball.vx)
    for (const turn of [-0.5, 0.5]) {
      s.added.push({ x: ball.x, y: ball.y, vx: Math.cos(angle + turn) * speed, vy: Math.sin(angle + turn) * speed })
    }
  }
}

// One ball for one substep; false once it's gone off the bottom
function moveBall(s, ball, h, half) {
  ball.x += ball.vx * h
  ball.y += ball.vy * h
  // Walls and the ceiling
  if (ball.x < BALL) [ball.x, ball.vx] = [BALL, Math.abs(ball.vx)]
  if (ball.x > s.width - BALL) [ball.x, ball.vx] = [s.width - BALL, -Math.abs(ball.vx)]
  if (ball.y < BALL) [ball.y, ball.vy] = [BALL, Math.abs(ball.vy)]

  // The paddle: off at an angle set by where it hit, a touch faster each time
  if (
    ball.vy > 0 &&
    ball.y + BALL >= PADDLE.y &&
    ball.y + BALL <= PADDLE.y + PADDLE.height + 8 &&
    Math.abs(ball.x - s.x) <= half + BALL * 0.6
  ) {
    const offset = Math.max(-1, Math.min(1, (ball.x - s.x) / half))
    s.speed = Math.min(SPEED.max, s.speed + SPEED.perHit)
    const angle = offset * MAX_ANGLE
    ball.vx = Math.sin(angle) * s.speed
    ball.vy = -Math.cos(angle) * s.speed
    ball.y = PADDLE.y - BALL
    s.bounced = true
  }
  // The safety bar, while it's up
  if (s.timers.safety > 0 && ball.vy > 0 && ball.y + BALL >= SAFETY_Y) {
    ball.vy = -Math.abs(ball.vy)
    ball.y = SAFETY_Y - BALL
    s.bounced = true
  }

  // A brick: knocked (or cracked, if it's tough), and the ball turns back along whichever side it
  // came in through. A plough ball breaks it outright and keeps going.
  const hitIndex = s.bricks.findIndex(
    (b) => ball.x + BALL > b.x && ball.x - BALL < b.x + BRICK.width && ball.y + BALL > b.y && ball.y - BALL < b.y + BRICK.height,
  )
  if (hitIndex >= 0) {
    const b = s.bricks[hitIndex]
    const plough = s.timers.plough > 0
    if (!plough) {
      const overlapX = Math.min(ball.x + BALL - b.x, b.x + BRICK.width - (ball.x - BALL))
      const overlapY = Math.min(ball.y + BALL - b.y, b.y + BRICK.height - (ball.y - BALL))
      if (overlapX < overlapY) {
        ball.vx = ball.x < b.x + BRICK.width / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx)
        ball.x += ball.vx > 0 ? overlapX : -overlapX
      } else {
        ball.vy = ball.y < b.y + BRICK.height / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy)
        ball.y += ball.vy > 0 ? overlapY : -overlapY
      }
    }
    s.hit = true
    if (b.hits > 1 && !plough) s.bricks = s.bricks.map((other, j) => (j === hitIndex ? { ...other, hits: other.hits - 1 } : other))
    else {
      s.bricks = s.bricks.filter((_, j) => j !== hitIndex)
      s.score += POINTS[b.row] * (b.tough ? 2 : 1)
      s.booms = [...s.booms, { x: b.x + BRICK.width / 2, y: b.y + BRICK.height / 2, row: b.row, age: 0 }]
      if (b.power) {
        power(s, b.power, ball, b)
        s.powered = b.power
      }
    }
  }
  return ball.y - BALL <= HEIGHT
}

// One frame. `input`: { left, right } (keys held), or { target } (a finger: the paddle slides to
// x = target). Flags what happened this frame for the sounds: `hit` (a brick), `bounced` (the
// paddle), `powered` (a power-up), `lost` (the last ball down the bottom), `cleared` (a level done).
export function step(state, dt, input = {}, random = Math.random) {
  if (state.over) return state
  const s = structuredClone(state)
  Object.assign(s, { hit: false, bounced: false, lost: false, cleared: false, powered: null })
  s.booms = s.booms.map((b) => ({ ...b, age: b.age + dt })).filter((b) => b.age < 0.4)
  s.labels = s.labels.map((l) => ({ ...l, age: l.age + dt })).filter((l) => l.age < 1.2)
  s.timers = Object.fromEntries(Object.entries(s.timers).map(([k, t]) => [k, Math.max(0, t - dt)]))

  // The paddle
  const half = paddleWidth(s) / 2
  const reach = PADDLE.speed * dt
  let dx = input.target != null ? Math.max(-reach * 2, Math.min(reach * 2, input.target - s.x)) : 0
  if (input.left) dx -= reach
  if (input.right) dx += reach
  s.x = Math.max(half, Math.min(s.width - half, s.x + dx))
  if (s.stuck) {
    s.balls[0].x = s.x
    return s
  }

  // Slow-mo slows the balls, not the paddle
  const h = (dt * (s.timers.slow > 0 ? 0.6 : 1)) / SUBSTEPS
  // (Balls a multi-ball adds join after each pass, not partway through it)
  for (let i = 0; i < SUBSTEPS; i++) {
    s.added = []
    s.balls = [...s.balls.filter((ball) => moveBall(s, ball, h, half)), ...s.added]
  }
  delete s.added

  // The last ball down the bottom: a life gone
  if (!s.balls.length) {
    s.lives--
    s.lost = true
    s.timers = { safety: 0, plough: 0, wide: 0, slow: 0 }
    if (s.lives <= 0) return { ...s, over: true }
    return resting(s)
  }

  // All the bricks gone: the next level
  if (!s.bricks.length) {
    s.level++
    s.cleared = true
    return resting({ ...s, bricks: bricksFor(s.level, s.powers, random, s.width) })
  }
  return s
}

export { SAFETY_Y, paddleWidth }
