import assert from 'node:assert/strict'
import { test } from 'node:test'
import { landing, pick, sliceAt, slices } from '../../src/lib/wheel.js'

function seeded(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

const options = [
  { label: 'Pizza', weight: 1 },
  { label: 'Sushi', weight: 3 },
  { label: 'Tacos', weight: 6 },
]

test('slices are sized by weight and fill the whole wheel', () => {
  const wheel = slices(options)
  assert.deepEqual(
    wheel.map((s) => Math.round(s.end - s.start)),
    [36, 108, 216],
  )
  assert.equal(wheel[0].start, 0)
  assert.equal(wheel.at(-1).end, 360)
  assert.ok(Math.abs(wheel.reduce((sum, s) => sum + s.chance, 0) - 1) < 1e-9)
})

test('the winner is picked in proportion to weight', () => {
  const random = seeded(11)
  const wins = [0, 0, 0]
  for (let i = 0; i < 20000; i++) wins[pick(options, random)]++
  // Expect roughly 10%, 30%, 60%
  for (const [i, share] of [0.1, 0.3, 0.6].entries()) {
    assert.ok(Math.abs(wins[i] / 20000 - share) < 0.015, `option ${i}: ${wins[i] / 200}%`)
  }
})

test('the wheel always stops with the winner under the pointer, after plenty of turns', () => {
  const random = seeded(5)
  const wheel = slices(options)
  let rotation = 0
  for (let spin = 0; spin < 500; spin++) {
    const winner = pick(options, random)
    const next = landing(wheel, winner, rotation, random)
    assert.ok(next - rotation >= 6 * 360, 'spins at least six full turns')
    assert.equal(sliceAt(wheel, next), winner, `spin ${spin}`)
    rotation = next
  }
})

test('tiny slices still land inside themselves', () => {
  const lopsided = slices([
    { label: 'Long shot', weight: 1 },
    ...Array.from({ length: 19 }, (_, i) => ({ label: `Option ${i}`, weight: 10 })),
  ])
  const random = seeded(9)
  for (let i = 0; i < 200; i++) assert.equal(sliceAt(lopsided, landing(lopsided, 0, i * 37, random)), 0)
})
