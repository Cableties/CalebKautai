import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as plink from '../../src/lib/plink.js'

const first = () => 0
// Play the shot out
function playOut(s, dt = () => 1 / 60) {
  for (let i = 0; i < 60 * 60 && s.inPlay.length; i++) s = plink.step(s, dt(), {}, first)
  return s
}
// A board with just the given pegs: { x, y, kind, power }, plus a gold one out of the way so it isn't
// cleared
function board(pegs, extra = {}) {
  const s = plink.start({ nopowers: true }, first)
  s.pegs = [...pegs, { x: 20, y: 120, kind: 'gold' }].map((p) => ({ lit: false, gone: false, sway: 0, kind: 'plain', ...p }))
  return { ...s, ...extra }
}
const golds = (s) => s.pegs.filter((p) => p.kind === 'gold').length

test('plink: every level has a board of well-spaced pegs, some of them gold, and balls to clear it', () => {
  for (const width of [plink.WIDTH, 840]) {
    let s = plink.start({ width }, Math.random)
    for (let l = 1; l <= plink.PATTERNS.length; l++) {
      assert.equal(s.level, l)
      assert.ok(s.pegs.length > 35, `${width} level ${l}: ${s.pegs.length} pegs`)
      assert.ok(golds(s) >= s.pegs.length * 0.19 * Math.sqrt(plink.WIDTH / width))
      assert.equal(s.balls, width > plink.WIDTH ? 12 : 10)
      for (const p of s.pegs) {
        assert.ok(p.x >= plink.PEG_R && p.x <= width - plink.PEG_R)
        for (const q of s.pegs) assert.ok(p === q || Math.hypot(p.x - q.x, p.y - q.y) >= 33)
      }
      // Every gold lit, and a shot that hits nothing: cleared
      s.pegs = s.pegs.filter((p) => p.kind === 'gold').slice(0, 1)
      s.pegs[0].lit = true
      s = playOut(plink.fire(plink.aimAt(s, 0, plink.LAUNCHER.y)))
    }
  }
})

test('plink: a ball fired down bounces off the peg under it, which lights, scores, and goes once the ball is out', () => {
  let s = board([{ x: plink.WIDTH / 2, y: 300 }], { bucket: false })
  s = plink.fire(s)
  assert.equal(s.balls, 9)
  s = playOut(s)
  assert.equal(s.score, 10)
  assert.equal(s.pegs.length, 1)
  assert.ok(!s.over)
})

test('plink: each five pegs in a shot are worth more than the five before', () => {
  // The first level's board, all plain pegs
  const pegs = plink.start({}, first).pegs.map(({ x, y }) => ({ x, y }))
  const s = playOut(plink.fire(board(pegs, { bucket: false, aim: 0.2 })))
  const lit = pegs.length - (s.pegs.length - 1)
  assert.ok(lit > 5, `${lit} lit`)
  let expected = 0
  for (let k = 0; k < lit; k++) expected += 10 * (1 + Math.floor(k / 5))
  assert.equal(s.score, expected)
})

test('plink: landing in the bucket is a free ball', () => {
  // Timed so the bucket's right under the launcher as the ball gets there, about 0.77s after it's fired
  let s = board([], { clock: -0.77 })
  assert.ok(Math.abs(plink.bucketX(s, 0) - plink.WIDTH / 2) < 1)
  s = playOut(plink.fire(s))
  assert.equal(s.balls, 10)
  // Without it the ball's just gone
  s = playOut(plink.fire(board([], { bucket: false })))
  assert.equal(s.balls, 9)
})

test("plink: clearing the gold is the next level, with points for every ball that's left; out of balls first, it's over", () => {
  let s = board([{ x: plink.WIDTH / 2, y: 300, kind: 'gold' }], { bucket: false })
  s.pegs = s.pegs.slice(0, 1)
  s = playOut(plink.fire(s))
  assert.equal(s.level, 2)
  assert.equal(s.score, 50 + 9 * 500)
  assert.equal(s.balls, 10)

  s = board([], { bucket: false, balls: 1 })
  s = playOut(plink.fire(s))
  assert.ok(s.over)
})

test('plink: power-up pegs: an extra ball, a blast, the long aiming guide, a big bucket', () => {
  const at = { x: plink.WIDTH / 2, y: 300, kind: 'power' }
  let s = plink.step(plink.fire(board([{ ...at, power: 'multi' }], { bucket: false })), 0.5, {}, first)
  assert.equal(s.inPlay.length, 2)

  s = playOut(plink.fire(board([{ ...at, power: 'blast' }, { x: at.x + 50, y: 320 }, { x: at.x - 60, y: 280 }, { x: 300, y: 500 }], { bucket: false })))
  assert.deepEqual(s.pegs.map((p) => p.x), [300, 20])

  s = playOut(plink.fire(board([{ ...at, power: 'aim' }], { bucket: false })))
  assert.equal(s.longAim, 3)
  s = { ...plink.start({}, first), aim: 0.3 }
  assert.ok(plink.aimed(s).contact)
  assert.ok(plink.aimed({ ...s, longAim: 1 }).points.length > plink.aimed(s).points.length)

  s = playOut(plink.fire(board([{ ...at, power: 'bucket' }], { bucket: false })))
  assert.equal(plink.bucketWidth(s), plink.BUCKET.big)
})

test('plink: a ball stuck sitting on a peg knocks it out', () => {
  // Dropped dead on top of it, it'd bounce there for ever
  let s = board([{ x: 100, y: 300 }], { bucket: false })
  s = plink.fire(s)
  s.inPlay = [{ x: 100, y: 280, vx: 0, vy: 0, ax: 100, ay: 280, still: 0 }]
  s = plink.step(s, 1, {}, first)
  assert.equal(s.pegs.length, 2)
  s = playOut(s)
  assert.equal(s.pegs.length, 1)
  assert.equal(s.score, 10)
})

test("plink: the aiming guide shows exactly the shot's first peg, at any frame rate, pegs moving or not", () => {
  let checked = 0
  for (let i = 0; i < 300; i++) {
    let s = plink.start({ moving: i % 2 === 1 }, Math.random)
    s = plink.step(s, Math.random(), {}) // somewhere along in the moving things
    s = plink.aimAt(s, Math.random() * s.width, 200 + Math.random() * 400)
    const { peg } = plink.aimed(s)
    const marked = s.pegs.map((p, n) => ({ ...p, n }))
    s = plink.fire({ ...s, pegs: marked })
    while (s.inPlay.length && s.chain === 0) s = plink.step(s, 1 / 240 + Math.random() / 40, {})
    const lit = s.pegs.filter((p) => p.lit)
    // Two hit in one frame: can't tell which was first
    if (lit.length !== 1) continue
    assert.equal(lit[0].n, peg)
    checked++
  }
  assert.ok(checked > 200, `${checked} checked`)
})

test('plink: every mix of settings has its own board', () => {
  assert.equal(plink.plinkGame({}), 'plink')
  assert.equal(plink.plinkGame({ nobucket: true, moving: true }), 'plink-nobucket-moving')
  assert.equal(plink.PLINK_GAMES.length, 8)
})

test("plink: the aim turns (a finger dragging) within its limits, and reaches the top row's far ends, even on a wide board", () => {
  let s = plink.start({}, first)
  s = plink.turn(s, 0.5)
  assert.equal(s.aim, 0.5)
  s = plink.turn(s, 10)
  assert.ok(s.aim > Math.PI / 2 && s.aim < 2)
  assert.equal(plink.turn(s, -20).aim, -s.aim)
  for (const width of [plink.WIDTH, 840]) {
    const s = plink.start({ width }, () => 0.5)
    const top = Math.min(...s.pegs.map((p) => p.y))
    const row = s.pegs.filter((p) => p.y === top).sort((a, b) => a.x - b.x)
    for (const end of [row[0], row.at(-1)]) {
      let reached = false
      for (let x = 0; x <= width && !reached; x += 2) {
        for (const y of [0, plink.LAUNCHER.y, 100, 150]) reached ||= s.pegs[plink.aimed(plink.aimAt(s, x, y)).peg] === end
      }
      assert.ok(reached, `${width}: the peg at ${end.x}`)
    }
  }
})

test("plink: Super Aim's guide shows the first two pegs (the long guide's three still wins), and it's still the same high-score board", () => {
  const s = { ...plink.start({}, first), aim: 0.3 }
  // How many different pegs the path touches before it stops
  const reach = (state) => plink.aimed(state).points.length
  const plain = reach(s)
  const sup = reach({ ...s, superAim: true })
  assert.ok(sup > plain)
  assert.equal(sup, reach({ ...s, easy: true }))
  assert.equal(reach({ ...s, superAim: true, longAim: 1 }), reach({ ...s, longAim: 1 }))
  assert.ok(reach({ ...s, longAim: 1 }) > sup)
  assert.equal(plink.start({ superAim: true }).superAim, true)
})

test('plink: trick shots: a long shot, a bank shot and a gold combo each add one to the rest of the shot\'s multiplier', () => {
  // Long: straight down a long way to a gold peg, then a plain one under it
  let s = playOut(plink.fire(board([{ x: plink.WIDTH / 2, y: 420, kind: 'gold' }, { x: plink.WIDTH / 2 + 12, y: 460 }], { bucket: false })))
  assert.equal(s.score, 50 * 2 + 10 * 2)

  // Bank: off the left wall into a gold peg
  s = board([{ x: 40, y: 300, kind: 'gold' }], { bucket: false })
  let banked = false
  for (let aim = -1.85; aim < -0.9 && !banked; aim += 0.01) {
    let shot = plink.fire({ ...s, aim })
    for (let i = 0; i < 600 && shot.inPlay.length && !shot.chain; i++) {
      shot = plink.step(shot, 1 / 60, {}, first)
      if (shot.trick === 'Bank shot!') banked = shot.score === 100
    }
  }
  assert.ok(banked)

  // Gold combo: three golds in one shot (lit in a blast), the third and on worth twice as much
  s = board(
    [
      { x: plink.WIDTH / 2, y: 200, kind: 'power', power: 'blast' },
      { x: plink.WIDTH / 2 - 40, y: 200, kind: 'gold' },
      { x: plink.WIDTH / 2 + 40, y: 200, kind: 'gold' },
      { x: plink.WIDTH / 2, y: 240, kind: 'gold' },
    ],
    { bucket: false },
  )
  s = plink.step(plink.fire(s), 0.5, {}, first)
  assert.equal(s.tricks, 1)
  assert.equal(s.score, 25 + 50 + 50 + 50 * 2)
  assert.equal(plink.multiplier(s), 2)
})

test('plink: aiming through a point (the mouse), the ball drops right through it, on either board, unless it is out of reach', () => {
  for (const width of [plink.WIDTH, 840]) {
    for (const [fx, y] of [[0.1, 300], [0.9, 160], [0.3, 550], [0.55, 400], [0.02, 120], [0.98, 600]]) {
      const x = fx * width
      let s = plink.start({ width, nobucket: true }, first)
      s.pegs = [{ x: 5, y: 5, kind: 'gold', lit: false, gone: false, sway: 0 }] // out of the way
      s = plink.fire(plink.aimThrough(s, x, y))
      let closest = Infinity
      for (let i = 0; i < 2400 && s.inPlay.length; i++) {
        const [b] = s.inPlay
        closest = Math.min(closest, Math.hypot(b.x - x, b.y - y))
        s = plink.step(s, 1 / 240, {}, first)
      }
      assert.ok(closest < 4, `${width}: (${x}, ${y}) missed by ${closest.toFixed(1)}`)
    }
  }
  // Too far off to the side and up for the arc: as near as it gets, still heading that way
  const s = plink.aimThrough(plink.start({ width: 840 }, first), 830, 50)
  assert.ok(s.aim > 1.5)
})
