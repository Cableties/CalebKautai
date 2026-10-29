// High scores for the games, kept free of storage code so it can be unit tested.
// A game asks for a signed "run" when it starts, and hands it back with the score. The server
// checks the score could really have been reached in the time since: no instant 9,999s.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { BONK_GAMES, MAX_SCORE as BONK_MAX, ROUND_MS } from '../../src/lib/bonk.js'
import { BRICKS_GAMES, POINTS_PER_SECOND as BRICK_POINTS_PER_SECOND } from '../../src/lib/bricks.js'
import { BUBBLES_GAMES, POINTS_PER_SECOND as BUBBLE_POINTS_PER_SECOND } from '../../src/lib/bubbles.js'
import { FLAPPY_GAMES, SECONDS_PER_PIPE } from '../../src/lib/flappy.js'
import { INVADERS_GAMES, POINTS_PER_SECOND as INVADER_POINTS_PER_SECOND } from '../../src/lib/invaders.js'
import { POINTS_PER_SECOND, TABLES } from '../../src/lib/pinball.js'
import { PLINK_GAMES, POINTS_PER_SECOND as PLINK_POINTS_PER_SECOND } from '../../src/lib/plink.js'
import { ROWS, SECONDS_PER_SNACK, SNAKE_GAMES, WIDE_COLS } from '../../src/lib/snake.js'

const HOUR = 60 * 60 * 1000
// The same rules for every board of a game (one per mix of its settings: lib/settings.js)
const boards = (games, rules) => Object.fromEntries(games.map((g) => [g, rules]))
export const GAMES = {
  // One point per pipe, and pipes come every SECONDS_PER_PIPE (a little slack for timing)
  ...boards(FLAPPY_GAMES, { minMs: (score) => score * SECONDS_PER_PIPE * 1000 * 0.9, max: 10_000 }),
  // A fixed-length round (with two heads up at once, Frenzy can double the most anyone could get)
  ...Object.fromEntries(
    BONK_GAMES.map((g) => [g, { minMs: (score) => (score ? ROUND_MS * 0.95 : 0), max: BONK_MAX * (g.includes('frenzy') ? 2 : 1) }]),
  ),
  // A snack a move at the most, and no more snacks than there's room for on the board (the wide one)
  ...boards(SNAKE_GAMES, { minMs: (score) => score * SECONDS_PER_SNACK * 1000 * 0.9, max: WIDE_COLS * ROWS }),
  // None faster than a top-row alien with every shot
  ...boards(INVADERS_GAMES, { minMs: (score) => (score / INVADER_POINTS_PER_SECOND) * 1000, max: 1_000_000 }),
  // None faster than a top-row tough brick with every bounce
  ...boards(BRICKS_GAMES, { minMs: (score) => (score / BRICK_POINTS_PER_SECOND) * 1000, max: 1_000_000 }),
  // None faster than a whole board dropping off every shot
  ...boards(BUBBLES_GAMES, { minMs: (score) => (score / BUBBLE_POINTS_PER_SECOND) * 1000, max: 10_000_000 }),
  // None faster than a long chain of bonus pegs non-stop
  ...boards(PLINK_GAMES, { minMs: (score) => (score / PLINK_POINTS_PER_SECOND) * 1000, max: 1_000_000_000 }),
  // A board per pinball table, none faster than a ball pinging between bumpers non-stop
  ...Object.fromEntries(
    TABLES.map((t) => [`pinball-${t.id}`, { minMs: (score) => (score / POINTS_PER_SECOND) * 1000, max: 10_000_000 }]),
  ),
}
export const TOP = 10 // shown on the board
export const KEPT = 100 // stored per game

const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url')

export const startRun = (game, now, secret) => `${now}.${sign(`${game}:${now}`, secret)}`

// When the run started, or null if the token isn't one this server signed for this game
export function runStart(game, run, secret) {
  if (typeof run !== 'string' || !secret) return null
  const [time, signature = ''] = run.split('.')
  const expected = Buffer.from(sign(`${game}:${time}`, secret))
  const given = Buffer.from(signature)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return Number(time)
}

export function cleanInitials(value) {
  const initials = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return initials.length === 3 ? initials : null
}

// Returns { entry } or { error }
export function parseScore(body, now, secret) {
  if (!body || typeof body !== 'object') return { error: 'Invalid request' }
  const rules = GAMES[body.game]
  if (!rules) return { error: 'Which game?' }
  const initials = cleanInitials(body.initials)
  if (!initials) return { error: 'Three letters or numbers, please.' }
  const score = Number(body.score)
  if (!Number.isInteger(score) || score < 1 || score > rules.max) return { error: "That score doesn't look right." }
  const started = runStart(body.game, body.run, secret)
  if (started == null || now - started > HOUR || now - started < rules.minMs(score)) {
    return { error: "That score doesn't look right." }
  }
  return { entry: { game: body.game, initials, score } }
}

// Upstash returns [member, score, member, score, …]; members are "INI#id"
export function board(flat) {
  const out = []
  for (let i = 0; i < flat.length; i += 2) out.push({ initials: String(flat[i]).split('#')[0], score: Number(flat[i + 1]) })
  return out
}
