import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as bricks from '../../src/lib/bricks.js'

const { BALL, BRICK, HEIGHT, PADDLE, WIDTH } = bricks
const run = (s, seconds, input = {}) => {
  for (let t = 0; t < seconds && !s.over; t += 1 / 60) s = bricks.step(s, 1 / 60, input)
  return s
}
// A game in play with just the given bricks, and one ball heading up into the first from below
function aimedAt(list, extra = {}) {
  const s = bricks.start({ nopowers: true })
  const b = list[0]
  return { ...s, stuck: false, bricks: list, balls: [{ x: b.x + BRICK.width / 2, y: b.y + BRICK.height + BALL + 2, vx: 0, vy: -300 }], ...extra }
}

test('bricks: the ball sits on the paddle, follows it, and launches upwards', () => {
  let s = bricks.start()
  assert.equal(s.stuck, true)
  s = bricks.step(s, 0.2, { right: true })
  assert.equal(s.balls[0].x, s.x)
  s = bricks.launch(s, () => 0.5)
  assert.ok(s.balls[0].vy < 0)
  assert.equal(s.stuck, false)
})

test('bricks: a hit knocks a brick out, scores its row, and turns the ball back', () => {
  const b = bricks.start({ nopowers: true }).bricks.at(-1)
  const after = bricks.step(aimedAt([b, { ...b, x: 0, y: 0 }]), 1 / 30)
  assert.equal(after.bricks.length, 1)
  assert.equal(after.score, bricks.POINTS[b.row])
  assert.ok(after.balls[0].vy > 0)
})

test('bricks: a tough brick takes two hits', () => {
  const b = { ...bricks.start().bricks[0], hits: 2, tough: true }
  const once = bricks.step(aimedAt([b]), 1 / 30)
  assert.equal(once.bricks[0].hits, 1)
  assert.equal(once.score, 0)
})

test('bricks: the paddle sends the ball off at an angle depending on where it hits', () => {
  const s = bricks.start()
  const falling = (dx) => ({ ...s, stuck: false, balls: [{ x: s.x + dx, y: PADDLE.y - BALL - 2, vx: 0, vy: 300 }] })
  assert.ok(bricks.step(falling(-30), 1 / 30).balls[0].vx < 0)
  assert.ok(bricks.step(falling(30), 1 / 30).balls[0].vx > 0)
  assert.ok(bricks.step(falling(30), 1 / 30).balls[0].vy < 0)
})

test('bricks: missing it costs a ball, and the last one ends it', () => {
  const s = bricks.start()
  const missed = { ...s, stuck: false, x: 40, balls: [{ x: WIDTH - 40, y: HEIGHT - 20, vx: 0, vy: 400 }] }
  const after = run(missed, 0.5)
  assert.equal(after.lives, bricks.LIVES - 1)
  assert.equal(after.stuck, true)
  assert.equal(run({ ...missed, lives: 1 }, 0.5).over, true)
})

test('bricks: clearing the last brick brings the next level', () => {
  const b = bricks.start().bricks[0]
  const next = bricks.step(aimedAt([b]), 1 / 30)
  assert.equal(next.level, 2)
  assert.ok(next.bricks.length > 0)
  assert.equal(next.stuck, true)
})

test('bricks: a few bricks a level are power-ups, unless they are switched off', () => {
  assert.ok(bricks.start().bricks.filter((b) => b.power).length > 0)
  assert.equal(bricks.start({ nopowers: true }).bricks.filter((b) => b.power).length, 0)
})

test('bricks power-ups: multi-ball adds two balls, and a life only goes with the last one', () => {
  const b = { ...bricks.start().bricks.at(-1), power: 'multi' }
  const multi = bricks.step(aimedAt([b, { ...b, power: null, x: 0, y: 0 }]), 1 / 30)
  assert.equal(multi.balls.length, 3)
  // Two balls gone down the bottom, one still up: no life lost
  const two = { ...multi, x: 40, balls: [multi.balls[0], { x: WIDTH - 40, y: HEIGHT + 5, vx: 0, vy: 400 }] }
  const after = bricks.step(two, 1 / 30)
  assert.equal(after.lives, bricks.LIVES)
  assert.equal(after.balls.length, 1)
})

test('bricks power-ups: the safety bar bounces a ball back up, until it wears off', () => {
  const s = bricks.start()
  const falling = { ...s, stuck: false, x: 40, balls: [{ x: WIDTH - 40, y: HEIGHT - 40, vx: 0, vy: 400 }] }
  const saved = bricks.step({ ...falling, timers: { ...s.timers, safety: 5 } }, 1 / 15)
  assert.ok(saved.balls[0].vy < 0)
  assert.equal(run({ ...falling, timers: { ...s.timers, safety: 0.01 } }, 0.5).lives, bricks.LIVES - 1)
})

test('bricks power-ups: a plough ball breaks a tough brick in one and keeps going', () => {
  const b = { ...bricks.start().bricks[0], hits: 2, tough: true }
  const s = aimedAt([b, { ...b, x: 0, y: 500 }])
  const ploughed = bricks.step({ ...s, timers: { ...s.timers, plough: 5 } }, 1 / 30)
  assert.equal(ploughed.bricks.length, 1)
  assert.ok(ploughed.balls[0].vy < 0)
})

test('bricks power-ups: wide paddle, and an extra ball', () => {
  const s = bricks.start()
  assert.ok(bricks.paddleWidth({ ...s, timers: { ...s.timers, wide: 5 } }) > bricks.paddleWidth(s))
  const b = { ...s.bricks.at(-1), power: 'life' }
  assert.equal(bricks.step(aimedAt([b, { ...b, power: null, x: 0, y: 0 }]), 1 / 30).lives, bricks.LIVES + 1)
})

test('bricks settings: a small paddle, each mix with its own board', () => {
  assert.ok(bricks.paddleWidth(bricks.start({ small: true })) < bricks.paddleWidth(bricks.start()))
  assert.equal(bricks.bricksGame({ small: true }), 'bricks-small')
  assert.equal(bricks.BRICKS_GAMES.length, 4)
})

test('bricks, Easy Mode: a spare ball, and a slower one', () => {
  const easy = bricks.start({ easy: true })
  assert.equal(easy.lives, bricks.LIVES + 1)
  assert.ok(easy.speed < bricks.start().speed)
})
