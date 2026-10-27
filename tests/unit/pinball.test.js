import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GAMES, parseScore, startRun } from '../../api/_lib/scores.js'
import * as pinball from '../../src/lib/pinball.js'

const { BALL, BALLS, FLIPPERS, HEIGHT, LAUNCH_SPOT, ROLLOVER_POINTS, TABLES, WORD_BONUS } = pinball
const classic = TABLES[0]
const frames = (state, n, held = {}) => {
  for (let i = 0; i < n; i++) state = pinball.step(state, 1 / 60, held)
  return state
}
// A ball in play at (x, y), moving at (vx, vy)
const at = (x, y, vx = 0, vy = 0, table = classic) => ({ ...pinball.start(table), inLane: false, ball: { x, y, vx, vy } })

test('pinball: the ball waits on the plunger until it is launched', () => {
  const s = frames(pinball.start(), 60)
  assert.equal(s.inLane, true)
  assert.deepEqual([s.ball.x, s.ball.y], [LAUNCH_SPOT.x, LAUNCH_SPOT.y])
  const launched = pinball.launch(s, () => 0.5)
  assert.equal(launched.inLane, false)
  assert.ok(launched.ball.vy < -900)
})

test('pinball: a launched ball leaves the lane and comes out onto the table', () => {
  for (const t of TABLES) {
    const s = frames(pinball.launch(pinball.start(t), () => 0.5), 60)
    assert.equal(s.inLane, false, t.name)
    assert.ok(s.ball.x < pinball.LANE.left, `${t.name}: ball at x=${s.ball.x}`)
  }
})

test('pinball: on every table, without flipping, every ball drains and the game ends', () => {
  for (const t of TABLES) {
    for (const seed of [0.1, 0.5, 0.9]) {
      let s = pinball.start(t)
      let i = 0
      for (; i < 60 * 120 && !s.over; i++) {
        if (s.inLane) s = pinball.launch(s, () => (seed + i / 1000) % 1)
        s = pinball.step(s, 1 / 60)
      }
      assert.equal(s.over, true, `${t.name} (${seed}) still going after ${i / 60}s`)
      assert.ok(s.score > 0, `${t.name} scored nothing`)
    }
  }
})

test('pinball: a ball dropped between the flippers drains, and the next one waits in the lane', () => {
  const mid = (FLIPPERS.left.x + FLIPPERS.right.x) / 2
  const s = frames(at(mid, 500), 90)
  assert.equal(s.balls, BALLS - 1)
  assert.equal(s.inLane, true)
  assert.equal(s.over, false)
})

test('pinball: a flip sends a ball on the flipper back up the table', () => {
  let s = frames(at(125, 520), 12)
  assert.ok(s.ball.y > 520 && s.ball.y < HEIGHT, 'resting on the flipper')
  s = frames(s, 3, { left: true })
  assert.ok(s.ball.vy < -700, `going up at ${s.ball.vy}`)
})

test('pinball: the walls keep the ball on the table', () => {
  // Fired hard at each side wall, it bounces back rather than leaving
  for (const [x, vx] of [[30, -1400], [300, 1400]]) {
    const s = frames(at(x, 300, vx, -100), 20)
    assert.ok(s.ball.x > BALL && s.ball.x < 360 - BALL, `ball at x=${s.ball.x}`)
  }
})

test('pinball: bumpers kick the ball away and score', () => {
  const b = classic.bumpers[2]
  const s = frames(at(b.x, b.y - b.r - BALL - 4, 0, 200), 2)
  assert.equal(s.score, b.points)
  assert.ok(s.ball.vy < -400, 'kicked back up')
  assert.ok(s.flash.bumpers[2] > 0)
})

test('pinball: slingshots kick the ball back toward the middle', () => {
  // Dropped onto the left slingshot's face
  const s = frames(at(70, 430, -100, 200), 6)
  assert.ok(s.ball.vx > 100, `heading right at ${s.ball.vx}`)
  assert.ok(s.score > 0)
})

test('pinball: a hole holds the ball, scores, then fires it out', () => {
  const mainframe = pinball.tableById('mainframe')
  const [hole] = mainframe.holes
  let s = frames(at(hole.x, hole.y - 4, 0, 50, mainframe), 1)
  assert.ok(s.held, 'grabbed')
  assert.equal(s.score, hole.points)
  s = frames(s, 20)
  assert.ok(s.held, 'still holding it')
  s = frames(s, 30)
  assert.equal(s.held, null)
  assert.ok(Math.hypot(s.ball.x - hole.x, s.ball.y - hole.y) > hole.r, 'fired back out')
})

test('pinball: lighting every letter of the word gives a bonus and a multiplier', () => {
  for (const t of TABLES) {
    let s = at(0, 0, 0, 0, t)
    for (const r of t.rollovers) s = pinball.step({ ...s, ball: { x: r.x, y: r.y, vx: 0, vy: 0 } }, 1 / 600)
    assert.equal(s.score, t.word.length * ROLLOVER_POINTS + WORD_BONUS, t.name)
    assert.equal(s.multiplier, 2)
    assert.ok(s.lit.every((l) => !l))
  }
})

test('pinball: every table spells its word in its top lanes, with room for the ball', () => {
  for (const t of TABLES) {
    assert.equal(t.rollovers.map((r) => r.letter).join(''), t.word)
    for (const r of t.rollovers) assert.ok(r.w * 2 + 8 > BALL * 2 + 6, `${t.name} lanes too narrow`)
  }
  assert.equal(new Set(TABLES.map((t) => t.id)).size, TABLES.length)
})

test('pinball: the flippers swing up when held and fall back when let go', () => {
  const rest = pinball.start().flippers.left.angle
  const up = frames(pinball.start(), 6, { left: true })
  assert.ok(up.flippers.left.angle < rest)
  assert.equal(up.flippers.right.angle, pinball.start().flippers.right.angle)
  assert.equal(frames(up, 6).flippers.left.angle, rest)
})

test('pinball scores: a board per table, no faster than bumpers could give them', () => {
  for (const t of TABLES) assert.ok(GAMES[`pinball-${t.id}`], t.id)
  const NOW = 1_800_000_000_000
  const run = startRun('pinball-space', NOW, 's')
  const submit = (score, ms) => parseScore({ game: 'pinball-space', initials: 'CAL', score, run }, NOW + ms, 's')
  assert.ok(submit(12_000, 60_000).entry)
  assert.ok(submit(200_000, 10_000).error)
})
