// The rules of Bricks (pages/Bricks.jsx), kept free of the DOM so they can be unit tested. The
// screen is a fixed WIDTH × HEIGHT box in its own units (y grows downwards); the page scales it to
// fit. The ball (the head) bounces off the walls, the bricks and the paddle along the bottom, which
// sends it off at an angle depending on where it hits. Clear the bricks for the next level: a new
// layout, a faster ball. Each frame is split into substeps so a fast ball can't pass through a brick.
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
// The fastest anyone could score, for the server's sanity check: a top-row tough brick every
// substep-ish bounce, far beyond anything playable
export const POINTS_PER_SECOND = 600

// The levels, top row first: # a brick, @ a tough one (two hits), . a gap. After the last, they go
// round again, faster each time.
export const LEVELS = [
  ['########', '########', '########', '########', '########'],
  ['@@@@@@@@', '########', '#.#..#.#', '########', '########'],
  ['...##...', '..####..', '.######.', '@@@@@@@@', '.######.', '..####..', '...##...'],
  ['@.@.@.@.', '.#.#.#.#', '#.#.#.#.', '.@.@.@.@', '#.#.#.#.', '.#.#.#.#'],
  ['#......#', '##....##', '@@@..@@@', '########', '@@@@@@@@', '########'],
]
const left = (WIDTH - (BRICK.cols * BRICK.width + (BRICK.cols - 1) * BRICK.gap)) / 2

function bricksFor(level) {
  const layout = LEVELS[(level - 1) % LEVELS.length]
  const bricks = []
  layout.forEach((line, row) =>
    [...line].forEach((c, col) => {
      if (c === '.') return
      bricks.push({
        x: left + col * (BRICK.width + BRICK.gap),
        y: BRICK.top + row * (BRICK.height + BRICK.gap),
        row,
        hits: c === '@' ? 2 : 1,
        tough: c === '@',
      })
    }),
  )
  return bricks
}

const paddleWidth = (s) => PADDLE.width * (s.easy ? EASY.paddle : 1)
const baseSpeed = (s) => (SPEED.start + (s.level - 1) * SPEED.perLevel) * (s.easy ? EASY.speed : 1)

// The ball sitting on the paddle, ready to launch
const resting = (s) => ({ ...s, ball: { x: s.x, y: PADDLE.y - BALL - 1, vx: 0, vy: 0 }, stuck: true, speed: baseSpeed(s) })

export function start({ easy = false } = {}) {
  const s = { x: WIDTH / 2, lives: LIVES + (easy ? EASY.lives : 0), score: 0, level: 1, easy, over: false, booms: [] }
  return resting({ ...s, bricks: bricksFor(1) })
}

export function launch(state, random = Math.random) {
  if (!state.stuck || state.over) return state
  // Off at a slight angle, so it doesn't go straight up and down forever
  const angle = (random() < 0.5 ? -1 : 1) * (0.2 + random() * 0.25)
  return { ...state, stuck: false, ball: { ...state.ball, vx: Math.sin(angle) * state.speed, vy: -Math.cos(angle) * state.speed } }
}

// One frame. `input`: { left, right } (keys held), or { target } (a finger: the paddle slides to
// x = target). Flags what happened this frame for the sounds: `hit` (a brick), `bounced` (the
// paddle), `lost` (a ball down the bottom), `cleared` (a level done).
export function step(state, dt, input = {}) {
  if (state.over) return state
  let s = { ...state, hit: false, bounced: false, lost: false, cleared: false }
  s.booms = s.booms.map((b) => ({ ...b, age: b.age + dt })).filter((b) => b.age < 0.4)

  // The paddle
  const half = paddleWidth(s) / 2
  const reach = PADDLE.speed * dt
  let dx = input.target != null ? Math.max(-reach * 2, Math.min(reach * 2, input.target - s.x)) : 0
  if (input.left) dx -= reach
  if (input.right) dx += reach
  s.x = Math.max(half, Math.min(WIDTH - half, s.x + dx))
  if (s.stuck) return { ...s, ball: { ...s.ball, x: s.x } }

  let { x, y, vx, vy } = s.ball
  let bricks = s.bricks
  const h = dt / SUBSTEPS
  for (let i = 0; i < SUBSTEPS; i++) {
    x += vx * h
    y += vy * h
    // Walls and the ceiling
    if (x < BALL) [x, vx] = [BALL, Math.abs(vx)]
    if (x > WIDTH - BALL) [x, vx] = [WIDTH - BALL, -Math.abs(vx)]
    if (y < BALL) [y, vy] = [BALL, Math.abs(vy)]

    // The paddle: off at an angle set by where it hit, a touch faster each time
    if (vy > 0 && y + BALL >= PADDLE.y && y + BALL <= PADDLE.y + PADDLE.height + 8 && Math.abs(x - s.x) <= half + BALL * 0.6) {
      const offset = Math.max(-1, Math.min(1, (x - s.x) / half))
      s.speed = Math.min(SPEED.max, s.speed + SPEED.perHit)
      const angle = offset * MAX_ANGLE
      vx = Math.sin(angle) * s.speed
      vy = -Math.cos(angle) * s.speed
      y = PADDLE.y - BALL
      s.bounced = true
    }

    // A brick: knocked (or cracked, if it's tough), and the ball turns back along whichever side
    // it came in through
    const hitIndex = bricks.findIndex(
      (b) => x + BALL > b.x && x - BALL < b.x + BRICK.width && y + BALL > b.y && y - BALL < b.y + BRICK.height,
    )
    if (hitIndex >= 0) {
      const b = bricks[hitIndex]
      const overlapX = Math.min(x + BALL - b.x, b.x + BRICK.width - (x - BALL))
      const overlapY = Math.min(y + BALL - b.y, b.y + BRICK.height - (y - BALL))
      if (overlapX < overlapY) {
        vx = x < b.x + BRICK.width / 2 ? -Math.abs(vx) : Math.abs(vx)
        x += vx > 0 ? overlapX : -overlapX
      } else {
        vy = y < b.y + BRICK.height / 2 ? -Math.abs(vy) : Math.abs(vy)
        y += vy > 0 ? overlapY : -overlapY
      }
      s.hit = true
      if (b.hits > 1) bricks = bricks.map((other, j) => (j === hitIndex ? { ...other, hits: other.hits - 1 } : other))
      else {
        bricks = bricks.filter((_, j) => j !== hitIndex)
        s.score += POINTS[b.row] * (b.tough ? 2 : 1)
        s.booms = [...s.booms, { x: b.x + BRICK.width / 2, y: b.y + BRICK.height / 2, row: b.row, age: 0 }]
      }
    }

    // Down past the paddle: that ball's gone
    if (y - BALL > HEIGHT) {
      s.lives--
      s.lost = true
      if (s.lives <= 0) return { ...s, bricks, over: true, ball: { x, y, vx: 0, vy: 0 } }
      return resting({ ...s, bricks })
    }
  }
  s = { ...s, bricks, ball: { x, y, vx, vy } }

  // All gone: the next level
  if (!bricks.length) {
    s.level++
    s.cleared = true
    return resting({ ...s, bricks: bricksFor(s.level) })
  }
  return s
}
