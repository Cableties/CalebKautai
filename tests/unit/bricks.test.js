import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as bricks from '../../src/lib/bricks.js'

const { BALL, BRICK, HEIGHT, PADDLE, WIDTH } = bricks
const run = (s, seconds, input = {}) => {
  for (let t = 0; t < seconds && !s.over; t += 1 / 60) s = bricks.step(s, 1 / 60, input)
  return s
}

test('bricks: the ball sits on the paddle, follows it, and launches upwards', () => {
  let s = bricks.start()
  assert.equal(s.stuck, true)
  s = bricks.step(s, 0.2, { right: true })
  assert.equal(s.ball.x, s.x)
  s = bricks.launch(s, () => 0.5)
  assert.ok(s.ball.vy < 0)
  assert.equal(s.stuck, false)
})

test('bricks: a hit knocks a brick out, scores its row, and turns the ball back', () => {
  const s = bricks.start()
  const b = s.bricks.at(-1)
  const aimed = { ...s, stuck: false, ball: { x: b.x + BRICK.width / 2, y: b.y + BRICK.height + BALL + 2, vx: 0, vy: -300 } }
  const after = bricks.step(aimed, 1 / 30)
  assert.equal(after.bricks.length, s.bricks.length - 1)
  assert.equal(after.score, bricks.POINTS[b.row])
  assert.ok(after.ball.vy > 0)
})

test('bricks: a tough brick takes two hits', () => {
  const s = bricks.start()
  const tough = { ...s.bricks[0], hits: 2, tough: true }
  const at = { ...s, stuck: false, bricks: [tough], ball: { x: tough.x + BRICK.width / 2, y: tough.y + BRICK.height + BALL + 2, vx: 0, vy: -300 } }
  const once = bricks.step(at, 1 / 30)
  assert.equal(once.bricks[0].hits, 1)
  assert.equal(once.score, 0)
})

test('bricks: the paddle sends the ball off at an angle depending on where it hits', () => {
  const s = bricks.start()
  const falling = (dx) => ({ ...s, stuck: false, ball: { x: s.x + dx, y: PADDLE.y - BALL - 2, vx: 0, vy: 300 } })
  assert.ok(bricks.step(falling(-30), 1 / 30).ball.vx < 0)
  assert.ok(bricks.step(falling(30), 1 / 30).ball.vx > 0)
  assert.ok(bricks.step(falling(30), 1 / 30).ball.vy < 0)
})

test('bricks: missing it costs a ball, and the last one ends it', () => {
  const s = bricks.start()
  const missed = { ...s, stuck: false, x: 40, ball: { x: WIDTH - 40, y: HEIGHT - 20, vx: 0, vy: 400 } }
  const after = run(missed, 0.5)
  assert.equal(after.lives, bricks.LIVES - 1)
  assert.equal(after.stuck, true)
  assert.equal(run({ ...missed, lives: 1 }, 0.5).over, true)
})

test('bricks: clearing the last brick brings the next level', () => {
  const s = bricks.start()
  const b = s.bricks[0]
  const last = { ...s, stuck: false, bricks: [b], ball: { x: b.x + BRICK.width / 2, y: b.y + BRICK.height + BALL + 2, vx: 0, vy: -300 } }
  const next = bricks.step(last, 1 / 30)
  assert.equal(next.level, 2)
  assert.ok(next.bricks.length > 0)
  assert.equal(next.stuck, true)
})

test('bricks, Easy Mode: a spare ball, and a slower one', () => {
  const easy = bricks.start({ easy: true })
  assert.equal(easy.lives, bricks.LIVES + 1)
  assert.ok(easy.speed < bricks.start().speed)
})
