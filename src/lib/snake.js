// The rules of Snake (pages/Snake.jsx), kept free of the DOM so they can be unit tested. The board
// is COLS × ROWS cells; the snake is a list of cells, head first, and moves one cell per tick,
// quicker with each snack. Turns queue up (two at most), so a quick double swipe still lands.
// Settings, each its own high-score board (snakeGame()):
// - wrap: the walls wrap round to the other side instead of ending it
// - obstacles: rocks to steer round, and another one every few snacks
// - portals: two pairs of portals; go into one and come out of its partner, still going the same way
export const COLS = 12
export const ROWS = 20
const START_LENGTH = 3
const TICK = { start: 0.16, min: 0.085, faster: 0.004 } // seconds per move
const EASY = { slower: 1.3 } // Easy Mode (a secret cheat): this much slower
const ROCKS = { start: 6, every: 4 } // obstacles: how many to start with, and a new one every few snacks
const PORTAL_PAIRS = 2
export const SETTINGS = ['wrap', 'obstacles', 'portals']
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }
// The quickest a snack could ever be eaten, so the server can tell a real score from a made-up one:
// a move at top speed per snack
export const SECONDS_PER_SNACK = TICK.min

// The high-score board for a mix of settings: "snake", "snake-wrap", "snake-obstacles-portals", …
export const snakeGame = (settings = {}) => ['snake', ...SETTINGS.filter((s) => settings[s])].join('-')
export const SNAKE_GAMES = Array.from({ length: 2 ** SETTINGS.length }, (_, n) =>
  snakeGame(Object.fromEntries(SETTINGS.map((s, i) => [s, Boolean(n & (1 << i))]))),
)

export const tickFor = (score, easy = false) =>
  Math.max(TICK.min, TICK.start - score * TICK.faster) * (easy ? EASY.slower : 1)

const same = ([ax, ay], [bx, by]) => ax === bx && ay === by
const taken = (s) => [...s.snake, ...s.rocks, ...s.portals.flat(), ...(s.food ? [s.food] : [])]

// A random empty cell, kept clear of `avoid` (null if the board's full)
function freeCell(avoid, random, allowed = () => true) {
  const used = new Set(avoid.map(([x, y]) => y * COLS + x))
  const free = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) if (!used.has(y * COLS + x) && allowed([x, y])) free.push([x, y])
  }
  return free.length ? free[Math.floor(random() * free.length)] : null
}
export const placeFood = (state, random = Math.random) => freeCell(taken({ ...state, food: null }), random)

// Rocks and portals stay out of the starting row (and the rows either side), and off the edges, so
// the start is never a trap and nothing blocks a portal's way out
const clearOfStart = ([x, y]) => Math.abs(y - Math.floor(ROWS / 2)) > 1 && x > 0 && x < COLS - 1 && y > 0 && y < ROWS - 1

export function start({ easy = false, wrap = false, obstacles = false, portals = false } = {}, random = Math.random) {
  const y = Math.floor(ROWS / 2)
  const s = {
    snake: Array.from({ length: START_LENGTH }, (_, i) => [3 - i, y]),
    dir: 'right',
    queue: [],
    rocks: [],
    portals: [], // pairs of cells
    food: null,
    score: 0,
    dead: false,
    clock: 0,
    easy,
    wrap,
    obstacles,
  }
  if (portals) {
    for (let i = 0; i < PORTAL_PAIRS; i++) {
      const a = freeCell(taken(s), random, clearOfStart)
      const b = freeCell([...taken(s), a], random, clearOfStart)
      s.portals.push([a, b])
    }
  }
  if (obstacles) for (let i = 0; i < ROCKS.start; i++) s.rocks.push(freeCell(taken(s), random, clearOfStart))
  s.food = placeFood(s, random)
  return s
}

// Steer: ignored if it's straight back the way it's going (or already the way it'll be going)
export function turn(state, dir) {
  const last = state.queue.at(-1) ?? state.dir
  if (state.dead || !DIRS[dir] || dir === last || dir === OPPOSITE[last] || state.queue.length >= 2) return state
  return { ...state, queue: [...state.queue, dir] }
}

// Through a portal: out of its partner
function through(portals, cell) {
  for (const [a, b] of portals) {
    if (same(a, cell)) return b
    if (same(b, cell)) return a
  }
  return cell
}

// One cell along
function move(state, random) {
  const [dir, ...queue] = state.queue.length ? state.queue : [state.dir]
  const [dx, dy] = DIRS[dir]
  let [x, y] = state.snake[0]
  x += dx
  y += dy
  if (state.wrap) {
    x = (x + COLS) % COLS
    y = (y + ROWS) % ROWS
  }
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return { ...state, dir, queue, dead: true }
  const cell = through(state.portals, [x, y])
  const eating = state.food && same(cell, state.food)
  // The tail moves out of the way as the head moves in, unless it's growing
  const body = eating ? state.snake : state.snake.slice(0, -1)
  if (body.some((b) => same(b, cell)) || state.rocks.some((r) => same(r, cell))) return { ...state, dir, queue, dead: true }
  const s = { ...state, dir, queue, snake: [cell, ...body] }
  if (!eating) return s
  s.score++
  // Obstacles: another rock every few snacks, somewhere not right in front of the head
  if (s.obstacles && s.score % ROCKS.every === 0) {
    const ahead = [cell[0] + dx, cell[1] + dy]
    const rock = freeCell([...taken({ ...s, food: null }), ahead], random, ([rx, ry]) => Math.abs(rx - cell[0]) + Math.abs(ry - cell[1]) > 2)
    if (rock) s.rocks = [...s.rocks, rock]
  }
  s.food = placeFood(s, random)
  return s
}

// `dt` seconds of play: as many moves as are due
export function step(state, dt, random = Math.random) {
  if (state.dead) return state
  let s = { ...state, clock: state.clock + dt }
  while (!s.dead && s.clock >= tickFor(s.score, s.easy)) {
    s = move({ ...s, clock: s.clock - tickFor(s.score, s.easy) }, random)
  }
  return s
}

// Which way the head's face points (degrees, 0 = right, 90 = down)
export const facing = (dir) => ({ right: 0, down: 90, left: 180, up: -90 })[dir]
