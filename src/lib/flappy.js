import { allSettingsGames, settingsGame } from './settings.js'

// The rules of Flappy Head (pages/FlappyHead.jsx), kept free of the DOM so they can be unit tested.
// The world is a WIDTH (wider on a desktop) × HEIGHT box in its own units; the page scales it to fit.
// The head stays at HEAD_X while the pipes scroll past; y grows downwards.
export const WIDTH = 360
export const HEIGHT = 640
export const GROUND = 56 // height of the ground strip at the bottom
export const HEAD_X = 96
export const RADIUS = 17 // the head's hitbox; Big Head Mode doubles it
export const GRAVITY = 1500 // units per second²
export const FLAP = -470 // upward speed right after a flap
export const MAX_FALL = 720
export const SPEED = 150 // how fast the pipes scroll
export const PIPE_WIDTH = 66
export const SPACING = 220 // from one pipe to the next
const GAP = { start: 176, min: 136, shrink: 2 } // the opening narrows by `shrink` per point
const EDGE = 64 // keep openings at least this far from the top and the ground
// Easy Mode (a secret cheat): openings this much wider, and a gentler fall
const EASY = { gap: 28, gravity: 0.88 }
// Moving pipes: each opening drifts up and down this far as it comes, at its own pace
const DRIFT = { reach: 46, every: 70 } // px either way, px scrolled per radian
// Moon gravity: a floatier fall, and softer flaps
const MOON = { gravity: 0.5, flap: 0.72 }

export const SETTINGS = [
  { id: 'moving', name: 'Moving pipes', note: 'The gaps drift up and down as they come.' },
  { id: 'moon', name: 'Moon gravity', note: 'Floaty falls and soft flaps. Harder than it sounds.' },
]
export const flappyGame = (settings = {}) => settingsGame('flappy-head', SETTINGS, settings)
export const FLAPPY_GAMES = allSettingsGames('flappy-head', SETTINGS)

// Seconds between pipes, so the server can tell a real score from a made-up one
export const SECONDS_PER_PIPE = SPACING / SPEED

export const gapFor = (score, easy = false) => Math.max(GAP.min, GAP.start - score * GAP.shrink) + (easy ? EASY.gap : 0)

// The opening's range of heights, for a gap that size
const range = (gap) => [EDGE + gap / 2, HEIGHT - GROUND - EDGE - gap / 2]

export function pipe(x, score, random = Math.random, easy = false, moving = false) {
  const gap = gapFor(score, easy)
  const [top, bottom] = range(gap)
  const gapY = top + random() * (bottom - top)
  // A moving one keeps where it started (`baseY`) and where it is in its drift (`phase`)
  return { x, gapY, gap, scored: false, ...(moving && { baseY: gapY, phase: random() * Math.PI * 2 }) }
}

// Where a moving pipe's opening is, at its place on the screen
function drift(p) {
  if (p.baseY == null) return p
  const [top, bottom] = range(p.gap)
  return { ...p, gapY: Math.max(top, Math.min(bottom, p.baseY + Math.sin(p.x / DRIFT.every + p.phase) * DRIFT.reach)) }
}

// `width`: the world's width (wider on a desktop: more of what's coming is in view)
export function start({ radius = RADIUS, easy = false, moving = false, moon = false, width = WIDTH } = {}, random = Math.random) {
  return {
    width,
    y: HEIGHT * 0.42,
    vy: 0,
    radius,
    easy,
    moving,
    moon,
    score: 0,
    dead: false,
    pipes: [pipe(width + 80, 0, random, easy, moving)],
  }
}

export const flap = (state) => (state.dead ? state : { ...state, vy: FLAP * (state.moon ? MOON.flap : 1) })

// Does a circle at (cx, cy) touch the rectangle from (x, y) to (x + w, y + h)?
export function hits(cx, cy, r, x, y, w, h) {
  const nx = Math.max(x, Math.min(cx, x + w))
  const ny = Math.max(y, Math.min(cy, y + h))
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r
}

// One frame. Returns the new state; `dead` once it hits a pipe or the ground.
export function step(state, dt, random = Math.random) {
  if (state.dead) return state
  const gravity = GRAVITY * (state.easy ? EASY.gravity : 1) * (state.moon ? MOON.gravity : 1)
  const vy = Math.min(MAX_FALL, state.vy + gravity * dt)
  // The sky has a lid: bumping it stops the climb rather than ending the game
  let y = state.y + vy * dt
  const ceiling = state.radius
  const climbing = y < ceiling
  if (climbing) y = ceiling
  let score = state.score
  let pipes = state.pipes
    .map((p) => drift({ ...p, x: p.x - SPEED * dt }))
    .filter((p) => p.x + PIPE_WIDTH > -10)
    .map((p) => {
      if (p.scored || p.x + PIPE_WIDTH >= HEAD_X - state.radius) return p
      score++
      return { ...p, scored: true }
    })
  const last = pipes.at(-1)
  const width = state.width ?? WIDTH
  if (!last || last.x <= width - SPACING) pipes = [...pipes, pipe((last?.x ?? width) + SPACING, score, random, state.easy, state.moving)]

  const r = state.radius
  const crashed =
    y + r >= HEIGHT - GROUND ||
    pipes.some(
      (p) =>
        hits(HEAD_X, y, r, p.x, -1000, PIPE_WIDTH, p.gapY - p.gap / 2 + 1000) ||
        hits(HEAD_X, y, r, p.x, p.gapY + p.gap / 2, PIPE_WIDTH, HEIGHT),
    )
  return { ...state, y: crashed ? Math.min(y, HEIGHT - GROUND - r) : y, vy: climbing ? 0 : vy, score, pipes, dead: crashed }
}

// Which way the face points (degrees, 0 = right, 90 = down): nose up after a flap, down in a dive
export const facing = (vy) => Math.max(-45, Math.min(70, (Math.atan2(vy, SPEED * 2) * 180) / Math.PI))
