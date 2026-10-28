import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as invaders from '../../src/lib/invaders.js'
import * as snake from '../../src/lib/snake.js'

const first = () => 0
// Run Snake for `seconds` in 60fps steps
function slither(state, seconds) {
  for (let t = 0; t < seconds && !state.dead; t += 1 / 60) state = snake.step(state, 1 / 60, first)
  return state
}

test('snake: moves a cell per tick, and runs into the wall', () => {
  const s = snake.start({}, first)
  const moved = snake.step(s, snake.tickFor(0) + 0.001, first)
  assert.deepEqual(moved.snake[0], [s.snake[0][0] + 1, s.snake[0][1]])
  assert.equal(moved.snake.length, s.snake.length)
  assert.equal(slither(s, 5).dead, true)
})

test("snake: can't turn straight back on itself, and queues two turns at most", () => {
  const s = snake.start({}, first)
  assert.equal(snake.turn(s, 'left'), s)
  const turned = snake.turn(snake.turn(snake.turn(s, 'up'), 'left'), 'down')
  assert.deepEqual(turned.queue, ['up', 'left'])
})

test('snake: eating grows it, scores, puts the next snack somewhere free, and speeds it up', () => {
  const s = snake.start({}, first)
  const [x, y] = s.snake[0]
  const ate = snake.step({ ...s, food: [x + 1, y] }, snake.tickFor(0) + 0.001, first)
  assert.equal(ate.score, 1)
  assert.equal(ate.snake.length, s.snake.length + 1)
  assert.ok(!ate.snake.some(([bx, by]) => bx === ate.food[0] && by === ate.food[1]))
  assert.ok(snake.tickFor(10) < snake.tickFor(0))
})

test('snake: biting its own tail ends it', () => {
  // A loop of five, heading up into its own side
  const s = { ...snake.start({}, first), snake: [[5, 5], [5, 6], [6, 6], [6, 5], [6, 4], [5, 4], [4, 4]], dir: 'right', food: [0, 0] }
  const bit = snake.step(snake.turn(s, 'up'), snake.tickFor(0) + 0.001, first)
  assert.equal(bit.dead, true)
})

test('snake, Easy Mode: slower', () => {
  assert.ok(snake.tickFor(0, true) > snake.tickFor(0))
})

test('snake, wrap-around walls: out one side, in the other', () => {
  const s = { ...snake.start({ wrap: true }, first), snake: [[snake.COLS - 1, 3], [snake.COLS - 2, 3]], food: [0, 0] }
  const wrapped = snake.step(s, snake.tickFor(0) + 0.001, first)
  assert.equal(wrapped.dead, false)
  assert.deepEqual(wrapped.snake[0], [0, 3])
})

test('snake, obstacles: rocks out of the way of the start, hitting one ends it, and more come', () => {
  const s = snake.start({ obstacles: true }, Math.random)
  assert.ok(s.rocks.length > 0)
  assert.ok(s.rocks.every(([, y]) => Math.abs(y - s.snake[0][1]) > 1))
  const [x, y] = s.snake[0]
  assert.equal(snake.step({ ...s, rocks: [[x + 1, y]] }, snake.tickFor(0) + 0.001, first).dead, true)
  // Every fourth snack brings another rock
  const fed = snake.step({ ...s, score: 3, food: [x + 1, y], rocks: [] }, snake.tickFor(3) + 0.001, first)
  assert.equal(fed.rocks.length, 1)
})

test('snake, portals: in one, out of its partner going the same way', () => {
  const s = { ...snake.start({ portals: true }, first), portals: [[[4, 10], [8, 2]]], food: [0, 0] }
  const through = snake.step(s, snake.tickFor(0) + 0.001, first)
  assert.deepEqual(through.snake[0], [8, 2])
  assert.deepEqual(snake.step(through, snake.tickFor(0) + 0.001, first).snake[0], [9, 2])
})

test('snake: each mix of settings has its own board', () => {
  assert.equal(snake.snakeGame({}), 'snake')
  assert.equal(snake.snakeGame({ portals: true, wrap: true }), 'snake-wrap-portals')
  assert.equal(new Set(snake.SNAKE_GAMES).size, 8)
})

test('invaders: a shot takes out the alien it hits and scores its row', () => {
  let s = invaders.start()
  // Line the cannon up under the bottom-left alien and fire once
  const [ax] = invaders.alienAt(s.fleet, 0, invaders.FLEET.rows - 1)
  s = { ...s, x: ax, blocks: [] }
  s = invaders.step(s, 1 / 60, { fire: true }, first)
  assert.equal(s.bullets.length, 1)
  for (let i = 0; i < 120 && s.score === 0; i++) s = invaders.step(s, 1 / 60, {}, () => 0.99)
  assert.equal(s.score, invaders.POINTS.at(-1))
  assert.equal(s.fleet.alive.filter(Boolean).length, s.fleet.alive.length - 1)
})

test('invaders: a bomb on the cannon costs a life, and the last one ends it', () => {
  const s = { ...invaders.start(), bombs: [{ x: invaders.WIDTH / 2, y: invaders.PLAYER.y - 12 }], bombIn: 99 }
  const hit = invaders.step(s, 1 / 60, {}, first)
  assert.equal(hit.lives, invaders.LIVES - 1)
  assert.ok(hit.hurt > 0)
  const last = invaders.step({ ...s, lives: 1 }, 1 / 60, {}, first)
  assert.equal(last.over, true)
})

test('invaders: the fleet steps sideways, then drops and turns at the edge', () => {
  let s = { ...invaders.start(), bombIn: 99, saucerIn: 99 }
  const y = s.fleet.y
  for (let i = 0; i < 60 * 20 && s.fleet.y === y; i++) s = invaders.step(s, 1 / 60, {}, first)
  assert.equal(s.fleet.y, y + invaders.FLEET.drop)
  assert.equal(s.fleet.dir, -1)
})

test('invaders: clearing the fleet brings the next wave', () => {
  const s = invaders.start()
  s.fleet.alive = s.fleet.alive.map((_, i) => i === 0)
  const [ax, ay] = invaders.alienAt(s.fleet, 0, 0)
  const next = invaders.step({ ...s, bullets: [{ x: ax, y: ay + 5 }], blocks: [] }, 1 / 60, {}, first)
  assert.equal(next.wave, 2)
  assert.ok(next.fleet.alive.every(Boolean))
})

test('invaders, Easy Mode: a spare life', () => {
  assert.equal(invaders.start({ easy: true }).lives, invaders.LIVES + 1)
})
