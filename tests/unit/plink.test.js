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
        // Both ends of a bar on the board, and room for the ball between any two
        for (const end of [-1, 1]) {
          const x = p.x + end * (p.dx ?? 0)
          assert.ok(x >= plink.PEG_R && x <= width - plink.PEG_R)
        }
        for (const q of s.pegs) assert.ok(p === q || plink.gap(p, q) >= 19)
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

test('plink: a big shot (1,500 points a level, in one shot) is a free ball, once a shot', () => {
  // The first level's board, every peg pink (300 each): plenty for one shot
  const pegs = plink.start({}, first).pegs.map(({ x, y }) => ({ x, y, kind: 'bonus' }))
  let s = plink.fire(board(pegs, { bucket: false, aim: 0.2 }))
  assert.equal(s.balls, 9)
  s = playOut(s)
  assert.ok(s.score >= 3000, `${s.score}`)
  assert.equal(s.balls, 10)
})

test('plink: the extra ball drops in from the top, always onto a peg not lit yet, moving pegs and all', () => {
  for (let i = 0; i < 40; i++) {
    let s = plink.start({ moving: i % 2 === 1, nobucket: true }, Math.random)
    s = plink.step(s, Math.random() * 5, {})
    // The power-up straight under the launcher
    s.pegs.push({ x: plink.WIDTH / 2, y: 110, kind: 'power', power: 'multi', lit: false, gone: false, sway: 0 })
    s = plink.fire({ ...s, aim: 0 })
    let extra = null
    for (let n = 0; n < 2000 && s.inPlay.length; n++) {
      const was = s.pegs.map((p) => p.lit) // lit before this step (pegs stay put, by index, till the shot's over)
      s = plink.step(s, 1 / 240, {})
      if (!extra && s.inPlay.length === 2) {
        extra = s.inPlay[1]
        assert.ok(extra.y < plink.HUD + 20, `starts at the top: ${extra.y}`)
      }
      // Once it's there, wait for it to light a peg
      if (extra && s.inPlay.length === 2) {
        const now = s.pegs.filter((p, k) => p.lit && !was[k])
        if (now.some((p) => plink.away(s, p, s.inPlay[1].x, s.inPlay[1].y) < plink.BALL_R + plink.PEG_R + 4)) {
          extra = 'hit'
          break
        }
      }
    }
    assert.equal(extra, 'hit')
  }
})

test('plink: some levels have bars, and a ball dropped gently on one rolls along it and off the low end', () => {
  const s0 = plink.start({ width: plink.WIDTH }, Math.random)
  let bars = 0
  for (let l = 0; l < plink.PATTERNS.length; l++) {
    bars += plink.PATTERNS[l](plink.WIDTH).filter((item) => item.length === 4).length
  }
  assert.ok(bars >= 10)
  // A bar sloping down to the right, and a ball dropped just onto its high end
  const bar = { x: 180, y: 300, dx: 60 * Math.cos(0.3), dy: 60 * Math.sin(0.3), r: plink.BAR_R, kind: 'plain', lit: false, gone: false, sway: 0 }
  let s = { ...s0, pegs: [bar, { x: 20, y: 120, kind: 'gold', lit: false, gone: false, sway: 0 }], bucket: false }
  s.inPlay = [{ x: bar.x - bar.dx + 4, y: bar.y - bar.dy - plink.BAR_R - plink.BALL_R - 4, vx: 0, vy: 0, ax: 0, ay: 0, still: 0, flown: 0, banked: false }]
  let touching = 0
  let lowest = 0
  for (let i = 0; i < 480 && s.inPlay.length; i++) {
    s = plink.step(s, 1 / 240, {})
    const ball = s.inPlay[0]
    if (!ball || ball.x > bar.x + bar.dx) break
    if (plink.away(s, bar, ball.x, ball.y) <= plink.BAR_R + plink.BALL_R + 0.5) touching++
    lowest = Math.max(lowest, ball.x)
  }
  // On it most of the way along (not bouncing off), and it lit
  assert.ok(touching > 60, `touching for ${touching} steps`)
  assert.ok(lowest > bar.x + bar.dx - 10, `got to ${lowest}`)
  assert.ok(s.pegs[0].lit)
})
