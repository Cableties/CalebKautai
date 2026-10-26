import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MIN_SLOPE, POSES, TILTS, frame, normalise, nudge, pose, step } from '../../src/lib/bounce.js'

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps

// A repeatable stand-in for Math.random
function seeded(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

test('facing exactly the direction of a pose shows that pose, untilted', () => {
  POSES.forEach((p, i) => {
    assert.deepEqual(pose(p.angle), { index: i, mirrored: false, tilt: 0 })
  })
})

test('in between, it shows the nearest pose tilted the rest of the way, never more than halfway', () => {
  for (let a = -90; a <= 90; a += 0.5) {
    const { index, tilt } = pose(a)
    assert.ok(Math.abs(tilt) <= 22.5 + 1e-9, `${a}°: tilt ${tilt}`)
    assert.ok(close(POSES[index].angle + tilt, a), `${a}°: pose + tilt points the right way`)
  }
})

test('the turn has no jumps: where the pose changes, the tilt hands over from one side to the other', () => {
  for (let a = -90; a < 90; a += 0.1) {
    const here = pose(a)
    const next = pose(a + 0.1)
    if (here.index !== next.index) {
      assert.equal(next.index, here.index + 1)
      assert.ok(close(Math.abs(here.tilt), 22.5, 0.2) && close(Math.abs(next.tilt), 22.5, 0.2), `${a}°`)
    }
  }
})

test('facing left mirrors the matching right-facing pose', () => {
  for (const [left, right] of [[180, 0], [135, 45], [-135, -45], [-150, -30]]) {
    const l = pose(left)
    const r = pose(right)
    assert.equal(l.mirrored, true)
    assert.equal(l.index, r.index, `${left}° vs ${right}°`)
    assert.ok(close(l.tilt, r.tilt), `${left}° vs ${right}°`)
  }
})

test('the mirror flip happens only at straight up or down, on the symmetric up/down pose', () => {
  for (const edge of [90, -90]) {
    const before = pose(edge - 0.01 * Math.sign(edge))
    const after = pose(edge + 0.01 * Math.sign(edge))
    assert.notEqual(before.mirrored, after.mirrored)
    const vertical = edge > 0 ? POSES.length - 1 : 0
    assert.equal(before.index, vertical)
    assert.equal(after.index, vertical)
  }
})

test('the sprite frame is the pose row and the nearest pre-drawn tilt', () => {
  for (let a = -180; a < 180; a += 0.5) {
    const { index, mirrored, tilt } = pose(a)
    const f = frame(a)
    assert.equal(f.row, index)
    assert.equal(f.mirrored, mirrored)
    const nearest = Math.min(...TILTS.map((t) => Math.abs(tilt - t)))
    assert.ok(close(Math.abs(tilt - TILTS[f.col]), nearest), `${a}°`)
  }
})

test('a bounce always heads away from the wall and keeps off the axes', () => {
  const random = seeded(7)
  for (let a = -180; a < 180; a += 7) {
    const out = nudge(a, random)
    const slope = Math.abs(normalise(out)) % 90
    assert.ok(slope >= MIN_SLOPE - 1e-9 && slope <= 90 - MIN_SLOPE + 1e-9, `${a}° → ${out}°`)
    // Same horizontal and vertical direction as before the nudge
    if (!close(Math.cos((a * Math.PI) / 180), 0)) assert.equal(Math.sign(Math.cos((out * Math.PI) / 180)), Math.sign(Math.cos((a * Math.PI) / 180)))
    if (!close(Math.sin((a * Math.PI) / 180), 0)) assert.equal(Math.sign(Math.sin((out * Math.PI) / 180)), Math.sign(Math.sin((a * Math.PI) / 180)))
  }
})

test('over ten minutes on a phone screen it stays on screen, keeps bouncing, and uses every pose', () => {
  const random = seeded(42)
  const maxX = 390 - 72
  const maxY = 844 - 96
  let state = { x: 100, y: 100, travel: 30, facing: 30, squash: 0 }
  let bounces = 0
  const used = new Set()
  for (let frame = 0; frame < 60 * 600; frame++) {
    const before = state.squash
    state = step(state, 1 / 60, maxX, maxY, random)
    if (state.squash > before) bounces++
    assert.ok(state.x >= 0 && state.x <= maxX && state.y >= 0 && state.y <= maxY, `frame ${frame}`)
    used.add(pose(state.facing).index)
  }
  assert.ok(bounces > 100, `only ${bounces} bounces`)
  assert.equal(used.size, POSES.length, `poses used: ${[...used]}`)
})
