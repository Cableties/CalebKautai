import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as bubbles from '../../src/lib/bubbles.js'

const first = () => 0
// Fly the shot until it lands
function flyOut(s) {
  for (let i = 0; i < 240 && s.shot; i++) s = bubbles.step(s, 1 / 60, {}, first)
  return s
}
// A board with just the given bubbles: { r, c, colour, power }
function board(cells, extra = {}) {
  const s = bubbles.start({ nopowers: true }, first)
  s.grid = []
  for (const { r, c, colour, power = null } of cells) {
    while (s.grid.length <= r) s.grid.push(Array(s.grid.length % 2 ? s.cols - 1 : s.cols).fill(null))
    s.grid[r][c] = { colour, power }
  }
  return { ...s, ...extra }
}
const count = (s) => s.grid.flat().filter(Boolean).length

test('bubbles: a level starts with rows of bubbles and two loaded, in colours on the board', () => {
  const s = bubbles.start({}, Math.random)
  assert.ok(count(s) > 30)
  const colours = new Set(s.grid.flat().filter(Boolean).map((b) => b.colour))
  assert.ok(colours.has(s.ammo[0]) && colours.has(s.ammo[1]))
})

test('bubbles: aim stays within limits, and a shot flies off the way it points', () => {
  let s = bubbles.start({}, first)
  s = bubbles.aimAt(s, 0, bubbles.LAUNCHER.y)
  assert.ok(s.aim < -1 && s.aim >= -1.36)
  s = bubbles.fire(bubbles.aimAt(s, s.width / 2, 0))
  assert.ok(s.shot && Math.abs(s.shot.dx) < 0.01 && s.shot.dy < 0)
})

test('bubbles: three of a colour together pop, and what was hanging off them falls', () => {
  // Two blues along the top, a pink hanging under them; fire a blue up beside them
  const s = board([
    { r: 0, c: 6, colour: 1 },
    { r: 0, c: 7, colour: 1 },
    { r: 1, c: 6, colour: 0 },
    { r: 0, c: 0, colour: 2 },
  ])
  const aimed = bubbles.aimAt({ ...s, ammo: [1, 2] }, bubbles.centre(s, 0, 5)[0], 0)
  const landed = flyOut(bubbles.fire(aimed))
  assert.equal(landed.grid[0][5], null)
  assert.equal(landed.grid[0][6], null)
  assert.equal(landed.grid[0][7], null)
  assert.equal(landed.grid[1][6], null) // the pink fell
  assert.equal(landed.grid[0][0].colour, 2)
  assert.ok(landed.score > 0)
  assert.ok(landed.falls.length >= 1)
})

test("bubbles: a shot that doesn't make three just sticks", () => {
  const s = board([{ r: 0, c: 4, colour: 1 }, { r: 0, c: 0, colour: 2 }])
  const aimed = bubbles.aimAt({ ...s, ammo: [3, 2] }, bubbles.centre(s, 0, 4)[0], 0)
  const landed = flyOut(bubbles.fire(aimed))
  assert.equal(count(landed), 3)
})

test('bubbles: every few shots the ceiling comes down, and past the line it ends', () => {
  let s = board([{ r: 0, c: 0, colour: 2 }, { r: 0, c: 9, colour: 3 }], { shots: 6, ammo: [1, 1] })
  s = flyOut(bubbles.fire(s))
  assert.equal(s.drops, 1)
  const low = board([{ r: 0, c: 0, colour: 2 }, { r: 17, c: 3, colour: 3 }], { ammo: [1, 1] })
  assert.equal(flyOut(bubbles.fire(low)).over, true)
})

test('bubbles power-ups: a bomb pops everything round it, a star loads a rainbow shot', () => {
  const s = board([
    { r: 0, c: 4, colour: 1 },
    { r: 0, c: 5, colour: 1, power: 'bomb' },
    { r: 0, c: 6, colour: 2 },
    { r: 0, c: 7, colour: 3 },
    { r: 0, c: 0, colour: 0, power: 'star' },
    { r: 0, c: 1, colour: 0 },
  ])
  const aimed = bubbles.aimAt({ ...s, ammo: [1, 0] }, bubbles.centre(s, 0, 4)[0], 0)
  const landed = flyOut(bubbles.fire(aimed))
  // The bomb took the ones beside it, of any colour
  assert.equal(landed.grid[0][6], null)
  assert.equal(landed.grid[0][7], null)
  assert.equal(landed.grid[0][0].power, 'star')
  // Pop the star: the next shot's a rainbow
  const star = board([{ r: 0, c: 0, colour: 0, power: 'star' }, { r: 0, c: 1, colour: 0 }, { r: 0, c: 8, colour: 2 }])
  const starred = flyOut(bubbles.fire(bubbles.aimAt({ ...star, ammo: [0, 2] }, bubbles.centre(star, 0, 1)[0] + 6, 0)))
  assert.equal(starred.rainbow, true)
  assert.equal(bubbles.fire(starred).shot.colour, bubbles.RAINBOW)
})

test('bubbles: clearing the board brings the next level', () => {
  const s = board([{ r: 0, c: 4, colour: 1 }, { r: 0, c: 5, colour: 1 }], { ammo: [1, 1] })
  const landed = flyOut(bubbles.fire(bubbles.aimAt(s, bubbles.centre(s, 0, 5)[0] + 4, 0)))
  assert.equal(landed.level, 2)
  assert.ok(count(landed) > 0)
})

test('bubbles: the aim shows exactly where a shot will land, bounces and all', () => {
  // Aimed hard at the left wall: it bounces off it, then lands where the ghost said
  for (const x of [0, 40, 120, 300]) {
    const s = bubbles.aimAt(bubbles.start({}, Math.random), x, bubbles.LAUNCHER.y - 60)
    const { points, cell } = bubbles.aimed(s)
    if (x === 0) assert.ok(points.length > 2) // the launcher, a bounce, where it stops
    const landed = flyOut(bubbles.fire({ ...s, ammo: [9, 9] }))
    // Colour 9 isn't on the board, so it can't have made a match and popped: it's where it landed
    assert.equal(landed.grid[cell.r][cell.c]?.colour, 9, `aimed at ${x}`)
  }
})

test('bubbles settings: six colours, no aiming guide, a wider board on a desktop', () => {
  assert.equal(bubbles.start({ six: true }, first).colours, 6)
  assert.equal(bubbles.start({}, first).colours, 4)
  assert.equal(bubbles.start({ noguide: true }, first).guide, false)
  assert.equal(bubbles.aimed(bubbles.start({}, first), 140).cell, null)
  assert.ok(bubbles.start({ width: 840 }, first).cols > bubbles.start({}, first).cols)
  assert.equal(bubbles.bubblesGame({ six: true, noguide: true }), 'bubbles-six-noguide')
})
