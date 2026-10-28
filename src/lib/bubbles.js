import { allSettingsGames, settingsGame } from './settings.js'

// The rules of Bubbles (pages/Bubbles.jsx), a bubble shooter, kept free of the DOM so they can be
// unit tested. The screen is a WIDTH (wider on a desktop) × HEIGHT box in its own units (y
// grows downwards). Bubbles hang from the ceiling in a honeycomb: rows of `cols`, every other row
// shifted half a bubble over (and one shorter). Fire one up from the launcher at the bottom, off the
// side walls; where it touches the cluster it sticks, and three or more of a colour together pop.
// Anything left hanging by nothing falls, for more points. Every few shots the ceiling comes down a
// row; a bubble past the line at the bottom ends it. Clear the board for the next level.
//
// Power-up bubbles do their thing when they pop or fall: a bomb pops everything round it, lightning
// its whole row, and a star makes the next shot a rainbow, which counts as whatever colour it lands
// against.
export const WIDTH = 360
export const HEIGHT = 640
export const R = 17 // a bubble's radius
const D = R * 2
const ROW_H = D * 0.866 // rows nestle into the ones above
export const HUD = 44
export const LINE_Y = 548 // a bubble past here and it's over
export const LAUNCHER = { y: 600 }
const SHOT_SPEED = 960
// A shot moves in steps this long, always from the launcher, so the aim's preview of where it'll
// land (aimed()) takes exactly the same path and lands in exactly the same place
const STEP = 4
const AIM = { max: 1.35, turn: 1.8 } // radians either side of straight up; radians per second with keys
export const COLOURS = ['#f05d8a', '#4aa3e8', '#5cc97a', '#f5b937', '#9b6ce0', '#ff8a4c'] // pink, blue, green, yellow, purple, orange
export const RAINBOW = -1 // a rainbow shot's colour
const POINTS = { pop: 10, drop: 20 }
const DROP_EVERY = { normal: 7, easy: 10 } // shots between the ceiling coming down a row
export const POWERS = { bomb: 'Bomb!', bolt: 'Lightning!', star: 'Rainbow shot!' }
const POWER_CHANCE = 0.06 // of each bubble in a new level

export const SETTINGS = [
  { id: 'nopowers', name: 'No power-ups', note: 'Just bubbles.' },
  { id: 'six', name: 'Six colours', note: 'Every colour from the start. Much harder.' },
]
export const bubblesGame = (settings = {}) => settingsGame('bubbles', SETTINGS, settings)
export const BUBBLES_GAMES = allSettingsGames('bubbles', SETTINGS)

// The fastest anyone could score, for the server's sanity check: a whole board's worth of bubbles
// falling off every shot, far beyond anything playable
export const POINTS_PER_SECOND = 3000

const colsFor = (width) => Math.floor(width / D)
const rowLength = (s, r) => (r % 2 ? s.cols - 1 : s.cols)
const left = (s) => (s.width - s.cols * D) / 2 + R
const topOf = (s) => HUD + 4 + s.drops * ROW_H
export const centre = (s, r, c) => [left(s) + c * D + (r % 2 ? R : 0), topOf(s) + R + r * ROW_H]
export const launcherX = (s) => s.width / 2

function neighbours(s, r, c) {
  const odd = r % 2
  const cells = [
    [r, c - 1],
    [r, c + 1],
    [r - 1, c - 1 + odd],
    [r - 1, c + odd],
    [r + 1, c - 1 + odd],
    [r + 1, c + odd],
  ]
  return cells.filter(([nr, nc]) => nr >= 0 && nc >= 0 && nc < rowLength(s, nr))
}
const at = (s, r, c) => s.grid[r]?.[c] ?? null
function set(s, r, c, bubble) {
  while (s.grid.length <= r) s.grid.push(Array(rowLength(s, s.grid.length)).fill(null))
  s.grid[r][c] = bubble
}
const every = (s) => s.grid.flatMap((row, r) => row.map((b, c) => (b ? [r, c] : null)).filter(Boolean))

// The colours still on the board, for the next shots (so there's always something to match)
const onBoard = (s) => [...new Set(every(s).map(([r, c]) => at(s, r, c).colour))]
function nextColour(s, random) {
  const left = onBoard(s)
  return left.length ? left[Math.floor(random() * left.length)] : Math.floor(random() * s.colours)
}

function level(s, random) {
  s.grid = []
  s.drops = 0
  s.shots = 0
  s.colours = s.six ? 6 : Math.min(6, 4 + Math.floor((s.level - 1) / 2))
  const rows = Math.min(9, 4 + s.level)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < rowLength(s, r); c++) {
      const power = s.powers && random() < POWER_CHANCE ? ['bomb', 'bolt', 'star'][Math.floor(random() * 3)] : null
      set(s, r, c, { colour: Math.floor(random() * s.colours), power })
    }
  }
  s.ammo = [nextColour(s, random), nextColour(s, random)]
}

// `width`: the screen's width (wider on a desktop). `guide`: the aiming guide, switched on and off
// mid-game (it's up to the player, so it doesn't get its own high scores).
export function start({ easy = false, nopowers = false, six = false, guide = true, width = WIDTH } = {}, random = Math.random) {
  const s = {
    width,
    cols: colsFor(width),
    easy,
    six,
    guide, // the whole path and a ghost where it'll land, or just a few dots
    powers: !nopowers,
    level: 1,
    score: 0,
    aim: 0,
    shot: null, // the bubble in flight: { x, y, vx, vy, colour }
    rainbow: false, // the next shot's a rainbow (a star was popped)
    over: false,
    pops: [], // bubbles just popped, for the burst: { x, y, colour, age }
    falls: [], // bubbles falling: { x, y, vy, colour }
    labels: [], // power-ups just set off, for their name: { x, y, text, age }
  }
  level(s, random)
  return s
}

// Aim at a point (a finger or the mouse), within the limits
export function aimAt(state, x, y) {
  const angle = Math.atan2(x - launcherX(state), LAUNCHER.y - y)
  return { ...state, aim: Math.max(-AIM.max, Math.min(AIM.max, angle)) }
}

export function fire(state) {
  if (state.shot || state.over) return state
  const [colour, next] = state.ammo
  return {
    ...state,
    shot: {
      x: launcherX(state),
      y: LAUNCHER.y,
      dx: Math.sin(state.aim), // which way, a step at a time
      dy: -Math.cos(state.aim),
      due: 0, // how far it's owed, from frames that weren't a whole number of steps
      colour: state.rainbow ? RAINBOW : colour,
    },
    // A rainbow shot is extra: the bubble that was loaded stays loaded
    ammo: state.rainbow ? state.ammo : [next, null],
    rainbow: false,
    fired: true,
  }
}

// Swap the loaded bubble with the next one
export const swap = (state) => (state.shot || !state.ammo[1] ? state : { ...state, ammo: [state.ammo[1], state.ammo[0]] })

// A shot one step along, off the side walls (`bounced` if it did); true once it's touching the
// ceiling or a bubble. `bubbles`: the centres of the ones on the board.
function advance(s, shot, bubbles) {
  shot.x += shot.dx * STEP
  shot.y += shot.dy * STEP
  shot.bounced = false
  if (shot.x < R || shot.x > s.width - R) {
    shot.x = Math.max(R, Math.min(s.width - R, shot.x))
    shot.dx = -shot.dx
    shot.bounced = true
  }
  return shot.y - R <= topOf(s) || bubbles.some(([bx, by]) => Math.hypot(bx - shot.x, by - shot.y) < D * 0.85)
}
const centres = (s) => every(s).map(([r, c]) => centre(s, r, c))

// Where a shot fired now would go: its path (the launcher, each bounce, where it stops) and the
// cell it'd land in. For the aiming guide, and the ghost bubble there. `reach` cuts the path
// short (with no landing), for just a few dots.
export function aimed(state, reach = Infinity) {
  const shot = { x: launcherX(state), y: LAUNCHER.y, dx: Math.sin(state.aim), dy: -Math.cos(state.aim) }
  const points = [[shot.x, shot.y]]
  const bubbles = centres(state)
  for (let travelled = 0; travelled < reach; travelled += STEP) {
    const hit = advance(state, shot, bubbles)
    if (shot.bounced) points.push([shot.x, shot.y])
    if (hit) {
      points.push([shot.x, shot.y])
      return { points, cell: snap(state, shot.x, shot.y) }
    }
  }
  points.push([shot.x, shot.y])
  return { points, cell: null }
}

// Where a shot that's stopped at (x, y) settles: the nearest empty cell
function snap(s, x, y) {
  const row = Math.max(0, Math.round((y - topOf(s) - R) / ROW_H))
  let best = null
  for (let r = Math.max(0, row - 1); r <= row + 1; r++) {
    for (let c = 0; c < rowLength(s, r); c++) {
      if (at(s, r, c)) continue
      const [cx, cy] = centre(s, r, c)
      const d = Math.hypot(cx - x, cy - y)
      if (!best || d < best.d) best = { r, c, d }
    }
  }
  return best
}

// Every bubble joined to (r, c) that `same` says belongs with it
function group(s, r, c, same) {
  const seen = new Set([`${r},${c}`])
  const queue = [[r, c]]
  const found = []
  while (queue.length) {
    const [qr, qc] = queue.pop()
    found.push([qr, qc])
    for (const [nr, nc] of neighbours(s, qr, qc)) {
      const b = at(s, nr, nc)
      if (b && !seen.has(`${nr},${nc}`) && same(b)) {
        seen.add(`${nr},${nc}`)
        queue.push([nr, nc])
      }
    }
  }
  return found
}

// Take bubbles off the board, popping or falling, setting off any power-ups among them (which can
// set off more)
function remove(s, cells, how) {
  const queue = [...cells]
  let count = 0
  while (queue.length) {
    const [r, c] = queue.shift()
    const b = at(s, r, c)
    if (!b) continue
    const [x, y] = centre(s, r, c)
    s.grid[r][c] = null
    count++
    if (how === 'pop') s.pops.push({ x, y, colour: b.colour, age: 0 })
    else s.falls.push({ x, y, vy: 0, colour: b.colour })
    s.score += POINTS[how] * s.level
    if (!b.power) continue
    s.labels.push({ x, y, text: POWERS[b.power], age: 0 })
    s.powered = b.power
    if (b.power === 'star') s.rainbow = true
    if (b.power === 'bomb') queue.push(...every(s).filter(([br, bc]) => Math.hypot(...centre(s, br, bc).map((v, i) => v - [x, y][i])) < D * 2.2))
    if (b.power === 'bolt') queue.push(...every(s).filter(([br]) => br === r))
    how = 'pop' // what a power-up sets off pops
  }
  return count
}

// The shot has stuck at (r, c): pop its colour's group if it's three or more, then drop whatever's
// left hanging by nothing
function land(s, r, c, colour, random) {
  // A rainbow is whatever colour it landed against (the most common one touching it)
  if (colour === RAINBOW) {
    const touching = neighbours(s, r, c).map(([nr, nc]) => at(s, nr, nc)?.colour).filter((n) => n != null)
    colour = touching.length ? touching.sort((a, b) => touching.filter((t) => t === b).length - touching.filter((t) => t === a).length)[0] : 0
  }
  set(s, r, c, { colour, power: null })
  const matched = group(s, r, c, (b) => b.colour === colour)
  if (matched.length >= 3) {
    s.popped = remove(s, matched, 'pop')
    // Hanging by nothing: not joined, through others, to the top row
    const held = new Set()
    for (let tc = 0; tc < rowLength(s, 0); tc++) {
      if (at(s, 0, tc)) for (const [gr, gc] of group(s, 0, tc, () => true)) held.add(`${gr},${gc}`)
    }
    s.dropped = remove(s, every(s).filter(([gr, gc]) => !held.has(`${gr},${gc}`)), 'drop')
  } else {
    s.stuck = true
  }
  // Every few shots the ceiling comes down a row
  s.shots++
  if (s.shots % (s.easy ? DROP_EVERY.easy : DROP_EVERY.normal) === 0) {
    s.drops++
    s.lowered = true
  }
  if (!every(s).length) {
    s.level++
    s.cleared = true
    level(s, random)
    return
  }
  // The next bubble up, keeping to the colours still on the board
  const left = onBoard(s)
  s.ammo = [left.includes(s.ammo[0]) ? s.ammo[0] : nextColour(s, random), nextColour(s, random)]
  if (every(s).some(([br, bc]) => centre(s, br, bc)[1] + R >= LINE_Y)) s.over = true
}

// One frame. `input`: { left, right } (keys held, turning the aim). Flags what happened this frame,
// for the sounds: `fired`, `popped` (how many), `dropped`, `stuck` (no match), `powered`,
// `lowered` (the ceiling), `cleared` (a level done).
export function step(state, dt, input = {}, random = Math.random) {
  if (state.over) return state
  const s = structuredClone(state)
  Object.assign(s, { fired: false, popped: 0, dropped: 0, stuck: false, powered: null, lowered: false, cleared: false })
  s.pops = s.pops.map((p) => ({ ...p, age: p.age + dt })).filter((p) => p.age < 0.3)
  s.falls = s.falls.map((f) => ({ ...f, vy: f.vy + 1400 * dt, y: f.y + f.vy * dt })).filter((f) => f.y < HEIGHT + R)
  s.labels = s.labels.map((l) => ({ ...l, age: l.age + dt })).filter((l) => l.age < 1.2)
  if (input.left) s.aim = Math.max(-AIM.max, s.aim - AIM.turn * dt)
  if (input.right) s.aim = Math.min(AIM.max, s.aim + AIM.turn * dt)

  const shot = s.shot
  if (!shot) return s
  // As many whole steps as this frame's worth of travel, the rest carried over to the next
  shot.due += SHOT_SPEED * dt
  const bubbles = centres(s)
  while (shot.due >= STEP) {
    shot.due -= STEP
    if (advance(s, shot, bubbles)) {
      s.shot = null
      const cell = snap(s, shot.x, shot.y)
      if (cell) land(s, cell.r, cell.c, shot.colour, random)
      break
    }
  }
  return s
}
