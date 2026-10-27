import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HEADS, MIN_SLOPE, POSES, SPEED, TILTS, collide, faceCircle, frame, normalise, nudge, pose, step, touching } from '../../src/lib/bounce.js'

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

test('a throw sends it off the way it was thrown, capped at the top speed', async () => {
  const { MAX_THROW, SPEED, release } = await import('../../src/lib/bounce.js')
  const start = { x: 100, y: 100, travel: 30, facing: 30, squash: 0, speed: SPEED }
  const right = release(start, 900, 0)
  assert.ok(close(right.travel, 0) && close(right.speed, 900))
  const upLeft = release(start, -500, -500)
  assert.ok(close(upLeft.travel, -135))
  assert.equal(release(start, 99999, 0).speed, MAX_THROW)
})

test('letting go gently just carries on at cruising speed, in the same direction', async () => {
  const { SPEED, release } = await import('../../src/lib/bounce.js')
  const start = { x: 100, y: 100, travel: 30, facing: 30, squash: 0, speed: SPEED }
  const after = release(start, 10, 5)
  assert.equal(after.travel, 30)
  assert.equal(after.speed, SPEED)
})

test('a hard throw ricochets around, stays on screen, and slows back to cruising speed', async () => {
  const { MAX_THROW, SPEED, release } = await import('../../src/lib/bounce.js')
  const maxX = 390 - 72
  const maxY = 844 - 96
  let state = release({ x: 150, y: 400, travel: 0, facing: 0, squash: 0 }, MAX_THROW, -MAX_THROW / 3)
  let bounces = 0
  for (let frame = 0; frame < 60 * 8; frame++) {
    const before = state.squash
    state = step(state, 1 / 60, maxX, maxY, seeded(3))
    if (state.squash > before) bounces++
    assert.ok(state.x >= 0 && state.x <= maxX && state.y >= 0 && state.y <= maxY, `frame ${frame}`)
  }
  assert.ok(bounces > 10, `only ${bounces} bounces in the first 8 seconds`)
  assert.ok(state.speed < SPEED * 1.5, `still going ${state.speed.toFixed(0)}px/s after 8 seconds`)
})

test('two heads touch when their faces meet, not just their frames', () => {
  const { caleb, amber } = HEADS
  const px = 3
  const at = (x, y, sprite) => faceCircle({ x, y }, sprite, px)
  const him = at(100, 100, caleb.sprite)
  // Face to face
  assert.ok(touching(him, at(100 + caleb.sprite.art * px * 0.8, 100, caleb.sprite)))
  // Frames overlapping corner to corner, but the faces still apart
  const corner = at(100 + caleb.sprite.width * px * 0.9, 100 + caleb.sprite.height * px * 0.9, caleb.sprite)
  assert.ok(!touching(him, corner))
  // Hers is a different size, centred in her own frame
  const her = at(100, 100, amber.sprite)
  assert.equal(her.x, 100 + (amber.sprite.width * px) / 2)
  assert.ok(touching(him, her))
})

// Two heads' states, and their faces, as circles of radius 40 centred on (x, y)
const head = (x, travel, speed = SPEED) => ({ x, y: 100, travel, facing: travel, squash: 0, speed })
const face = (s) => ({ x: s.x, y: s.y, r: 40 })
const vx = (s) => Math.cos((s.travel * Math.PI) / 180) * s.speed

test('heads meeting head-on bounce back off each other, and are pushed apart', () => {
  const [a, b] = collide(head(100, 0), head(170, 180), face(head(100, 0)), face(head(170, 180)))
  assert.ok(vx(a) < 0 && vx(b) > 0, `now heading ${a.travel}° and ${b.travel}°`)
  assert.ok(!touching(face(a), face(b)), 'no longer overlapping')
})

test('heads already moving apart are just separated, not turned round', () => {
  const [a0, b0] = [head(100, 180), head(170, 0)]
  const [a, b] = collide(a0, b0, face(a0), face(b0))
  assert.equal(a.travel, 180)
  assert.equal(b.travel, 0)
  assert.ok(!touching(face(a), face(b)))
})

test('a dragged head shoves the other out of the way without budging itself', () => {
  const [held, free] = [head(100, 0), head(150, 180)]
  const [a, b] = collide(held, free, face(held), face(free), { aHeld: true, push: [900, 0] })
  assert.deepEqual(a, held)
  assert.ok(!touching(face(a), face(b)), 'pushed clear')
  assert.ok(vx(b) >= 900 - 1, `sent off at ${vx(b)} px/s`)
  // The same with the held one second
  const [b2, a2] = collide(free, held, face(free), face(held), { bHeld: true, push: [900, 0] })
  assert.deepEqual(a2, held)
  assert.ok(vx(b2) >= 900 - 1)
  // Two held heads (two fingers) are left where the fingers put them
  assert.deepEqual(collide(held, free, face(held), face(free), { aHeld: true, bHeld: true }), [held, free])
})

test('a head shoved against a wall, already heading back out, is not turned round again', () => {
  const s = step(head(600, 180), 1 / 60, 500, 500)
  assert.equal(s.x, 500)
  assert.ok(vx(s) < 0)
})
