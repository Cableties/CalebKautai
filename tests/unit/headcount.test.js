import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as hc from '../../src/lib/headcount.js'

const middle = () => 0.5
const run = (s, seconds, input = {}, random = middle) => {
  for (let i = 0; i < seconds * 60 && !s.over; i++) s = hc.step(s, 1 / 60, input, random)
  return s
}
// The arena with just these ghouls, between waves (and no more coming)
function arena(foes, extra = {}) {
  const s = hc.start()
  const ghouls = foes.map((f) => ({ hp: hc.KINDS[f.kind ?? 'shambler'].hp, max: hc.KINDS[f.kind ?? 'shambler'].hp, kind: 'shambler', speed: 40, cool: 0, ...f }))
  return { ...s, wave: 1, breakIn: 0, foes: ghouls, ...extra }
}

test('headcount: the first wave comes in from the edges after a moment, and gets bigger each wave', () => {
  let s = run(hc.start(), 3)
  assert.equal(s.wave, 1)
  assert.ok(s.foes.length > 0)
  assert.ok(hc.waveSize(s, 5) > hc.waveSize(s, 1))
  assert.ok(hc.waveSize({ ...s, swarm: true }, 3) > hc.waveSize(s, 3))
  assert.ok(hc.waveSize({ ...s, width: 840 }, 3) > hc.waveSize(s, 3))
})

test('headcount: my head starts in the middle of the map, moves with the keys and walks to the mouse, staying on the map', () => {
  const middle = [hc.MAP.width / 2, hc.MAP.height / 2]
  assert.deepEqual([hc.start().player.x, hc.start().player.y], middle)
  let s = run(hc.start(), 1, { move: [1, 0] })
  assert.ok(Math.abs(s.player.x - (middle[0] + hc.PLAYER.speed)) < 2)
  s = run(s, 6, { move: [1, 0] })
  assert.equal(s.player.x, hc.MAP.width - hc.PLAYER.r)
  s = run(s, 3, { to: [s.player.x - 200, s.player.y - 100] })
  assert.ok(Math.hypot(s.player.x - (hc.MAP.width - hc.PLAYER.r - 200), s.player.y - (middle[1] - 100)) <= 4)
  // Diagonally, no faster than straight
  const t = run(hc.start(), 0.5, { move: [1, 1] })
  const moved = Math.hypot(t.player.x - middle[0], t.player.y - middle[1])
  assert.ok(moved <= hc.PLAYER.speed * 0.5 + 1)
})

test('headcount: the camera follows my head, but not past the edges of the map; the ghouls come in from just out of sight', () => {
  for (const width of [hc.WIDTH, 840]) {
    let s = hc.start({ width })
    assert.deepEqual(hc.camera(s), { x: (hc.MAP.width - width) / 2, y: (hc.MAP.height - hc.VIEW) / 2 })
    s = { ...s, player: { ...s.player, x: 20, y: hc.MAP.height - 20 } }
    assert.deepEqual(hc.camera(s), { x: 0, y: hc.MAP.height - hc.VIEW })
    // In a corner, they still come, on the map and out of sight
    for (let i = 0; i < 30; i++) {
      s = run({ ...s, foes: [], wave: 3, toSpawn: 1, spawnIn: 0 }, 1 / 60, {}, Math.random)
      const f = s.foes[0]
      const cam = hc.camera(s)
      assert.ok(f.x >= 0 && f.x <= hc.MAP.width && f.y >= 0 && f.y <= hc.MAP.height)
      assert.ok(f.x < cam.x || f.x > cam.x + width || f.y < cam.y || f.y > cam.y + hc.VIEW, `${f.x}, ${f.y} in sight`)
    }
  }
})

test('headcount: my head swings its sword by itself at ghouls in reach, every one in the swing, knocking them back; not at ones further off', () => {
  const p = hc.start().player
  const reach = hc.PLAYER.r + hc.SWORD.reach
  // One in reach to the left, one beside it in the same swing, one in reach behind, one out of reach
  const foes = [
    { x: p.x - reach, y: p.y, speed: 0 },
    { x: p.x - reach * 0.9, y: p.y - reach * 0.45, speed: 0 },
    { x: p.x + reach, y: p.y, speed: 0 },
    { x: p.x - 150, y: p.y + 40, speed: 0 },
  ]
  let s = hc.step(arena(foes), 1 / 60, {}, middle)
  assert.ok(s.swung)
  assert.ok(Math.abs(Math.abs(s.swing.angle) - Math.PI) < 0.01, 'at the nearest, to the left')
  assert.deepEqual(s.foes.map((f) => f.hp), [1, 1, 2, 2])
  assert.ok(s.foes[0].x < p.x - reach - hc.SWORD.knock + 1, 'knocked back')
  // Not again straight away
  assert.equal(hc.step(s, 1 / 60, {}, middle).swung, false)
  // Nothing in reach: no swing
  assert.equal(hc.step(arena([foes[3]]), 1 / 60, {}, middle).swung, false)
})

test('headcount: a ghoul knocked down by the sword scores and leaves a grave, and graves stay', () => {
  const p = hc.start().player
  let s = arena([{ x: p.x - 30, y: p.y, speed: 0, hp: 1, max: 1 }])
  s = hc.step(s, 1 / 60, {}, middle)
  assert.equal(s.foes.length, 0)
  assert.equal(s.graves.length, 1)
  assert.equal(s.kills, 1)
  assert.equal(s.score, hc.KINDS.shambler.points)
  // Graves stay, however long (only so many, though: the oldest go)
  s = run({ ...s, foes: [], toSpawn: 0, breakIn: 100 }, 30)
  assert.equal(s.graves.length, 1)
  const many = Array.from({ length: hc.GRAVES + 5 }, (_, i) => ({ x: 10, y: 10, kind: 'runner', max: 1, age: 0, n: i }))
  s = hc.step({ ...s, graves: many }, 1 / 60, {}, middle)
  assert.equal(s.graves.length, hc.GRAVES)
  assert.equal(s.graves[0].n, 5)
})

test('headcount: a ghoul that reaches my head takes a heart, then there is a moment it cannot; out of hearts, it is over', () => {
  const p = hc.start().player
  let s = arena([{ x: p.x + 5, y: p.y, hp: 99, max: 99 }], { swingIn: 99 })
  s = hc.step(s, 1 / 60, {}, middle)
  assert.equal(s.hearts, hc.PLAYER.hearts - 1)
  assert.ok(s.hurt)
  s = hc.step({ ...s, swingIn: 99 }, 1 / 60, {}, middle)
  assert.equal(s.hearts, hc.PLAYER.hearts - 1, 'not again straight away')
  assert.equal(hc.start({ easy: true }).hearts, hc.PLAYER.hearts + hc.PLAYER.easy)
  const one = hc.start({ fragile: true })
  assert.equal(one.hearts, 1)
  s = arena([{ x: p.x + 5, y: p.y, hp: 99, max: 99 }], { hearts: 1, maxHearts: 1, swingIn: 99 })
  s = hc.step(s, 1 / 60, {}, middle)
  assert.ok(s.over)
})

test('headcount: raising brings every grave on the map back on my side, as tough as it was, and they come to my head', () => {
  const p = hc.start().player
  let s = arena([], {
    breakIn: 100,
    graves: [
      { x: p.x + 40, y: p.y, kind: 'brute', max: 8, age: 0 },
      { x: p.x, y: p.y + 60, kind: 'runner', max: 1, age: 0 },
      { x: 30, y: 30, kind: 'shambler', max: 2, age: 0 },
    ],
  })
  s = hc.raise(s)
  assert.equal(s.raisedNow, 3)
  assert.equal(s.graves.length, 0)
  assert.deepEqual(s.army.map((a) => [a.kind, a.hp]), [['brute', 8], ['runner', 1], ['shambler', 2]])
  assert.ok(s.score > 0)
  // Not again straight away, and nothing left: a fizzle
  assert.equal(hc.raise(s), s)
  assert.ok(hc.raise({ ...s, raiseIn: 0 }).fizzled)
  // The far one comes back to my head
  s = run(s, 25)
  assert.ok(Math.hypot(s.army[2].x - p.x, s.army[2].y - p.y) < 100)
})

test('headcount: with the army nearly full, raising brings up the strongest graves first; full, none', () => {
  const p = hc.start().player
  const ally = { x: p.x, y: p.y + 40, kind: 'runner', hp: 1, max: 1, speed: 1, cool: 0 }
  const graves = [
    { x: p.x, y: p.y, kind: 'runner', max: 1, age: 0 },
    { x: 30, y: 30, kind: 'brute', max: 7, age: 0 },
    { x: p.x, y: p.y, kind: 'shambler', max: 2, age: 0 },
    { x: 60, y: 30, kind: 'wraith', max: 3, age: 0 },
    { x: 30, y: 60, kind: 'brute', max: 9, age: 0 },
  ]
  const s = arena([], { army: Array.from({ length: hc.ARMY.max - 2 }, () => ({ ...ally })), graves })
  assert.deepEqual(hc.toRaise(s).map((g) => [g.kind, g.max]), [['brute', 9], ['brute', 7]])
  const raised = hc.raise(s)
  assert.equal(raised.army.length, hc.ARMY.max)
  assert.deepEqual(raised.graves.map((g) => g.kind), ['runner', 'shambler', 'wraith'])
  // With room for them all, all of them
  assert.equal(hc.toRaise({ ...s, army: [] }).length, graves.length)
  // Full: none
  assert.equal(hc.raise({ ...raised, raiseIn: 0 }).army.length, hc.ARMY.max)
  assert.ok(hc.raise({ ...raised, raiseIn: 0 }).fizzled)
})

test('headcount: more kinds of ghoul come as the waves go on, and a lord every fifth wave', () => {
  const kinds = (wave) => new Set(Array.from({ length: 200 }, (_, i) => hc.kindFor(wave, () => (i + 0.5) / 200)))
  assert.deepEqual([...kinds(1)], ['shambler'])
  assert.deepEqual([...kinds(2)].sort(), ['runner', 'shambler'])
  assert.deepEqual([...kinds(6)].sort(), ['bloater', 'brute', 'runner', 'shambler', 'spitter', 'wraith'])
  for (const wave of [4, 5, 10]) {
    let s = arena([], { wave: wave - 1, toSpawn: 0, breakIn: 0 })
    s = run(s, 3.5)
    assert.equal(s.foes.some((f) => f.kind === 'lord'), wave % 5 === 0, `wave ${wave}`)
  }
})

test('headcount: a spitter stops a way off and spits, which takes a heart if it hits; it can be dodged', () => {
  const p = hc.start().player
  const spitter = { x: p.x - 300, y: p.y, kind: 'spitter', speed: 60, spitIn: 0 }
  let s = run(arena([spitter], { swingIn: 99, breakIn: 99 }), 8)
  const d = Math.hypot(s.foes[0].x - p.x, s.foes[0].y - p.y)
  assert.ok(Math.abs(d - hc.SPIT.keep) < 2, `stopped ${d} away`)
  assert.ok(s.hearts < hc.PLAYER.hearts)
  // Walking up and down, it misses
  let t = arena([{ ...spitter, x: p.x - hc.SPIT.keep, spitIn: 0 }], { breakIn: 99, hearts: 9, maxHearts: 9 })
  for (let i = 0; i < 60 * 8; i++) t = hc.step(t, 1 / 60, { move: [0, Math.sin(i / 30) > 0 ? 1 : -1] }, middle)
  assert.ok(t.hearts >= 8, `${t.hearts} hearts left`)
})

test('headcount: a bloater bursts when it is knocked down, hurting the army round it; a raised one bursts on the ghouls', () => {
  const p = hc.start().player
  const ally = { x: p.x + 50, y: p.y, kind: 'brute', hp: 6, max: 6, speed: 0, cool: 9 }
  let s = arena([{ x: p.x + 30, y: p.y, kind: 'bloater', hp: 1, max: 1, speed: 0, cool: 9 }], { army: [ally], breakIn: 99 })
  s = hc.step(s, 1 / 60, {}, middle)
  assert.ok(s.burst)
  assert.equal(s.army[0].hp, 6 - hc.BURST.damage)
  assert.equal(s.graves[0].kind, 'bloater')
  s = arena([{ x: p.x + 200, y: p.y, hp: 9, max: 9, speed: 0, cool: 9 }], { army: [{ ...ally, kind: 'bloater', x: p.x + 220, hp: 0 }], breakIn: 99, swingIn: 99 })
  s = hc.step(s, 1 / 60, {}, middle)
  assert.equal(s.foes[0].hp, 9 - hc.BURST.damage)
})

test('headcount: a wraith goes for my head, past the army', () => {
  const p = hc.start().player
  const army = [{ x: p.x - 150, y: p.y + 60, kind: 'brute', hp: 6, max: 6, speed: 0, cool: 0 }]
  const wraith = { x: p.x - 200, y: p.y + 60, kind: 'wraith', speed: 60, hp: 9, max: 9 }
  const s = hc.step(arena([wraith, { ...wraith, kind: 'shambler', x: p.x - 250 }], { army, breakIn: 99 }), 0.2, {}, middle)
  assert.ok(s.foes[0].y < wraith.y, 'the wraith heads up, to my head')
  assert.ok(Math.abs(s.foes[1].y - wraith.y) < 0.5, 'the shambler heads across, to the army')
})

test('headcount: the army stays by my head, knocking down ghouls that come close (which scores), leaving far ones be, and stays', () => {
  const p = hc.start().player
  const far = { x: p.x, y: p.y + hc.ARMY.engage + 150, speed: 0, hp: 99, max: 99 }
  let s = arena([{ x: p.x, y: p.y - 100, speed: 0 }, far], {
    swingIn: 999,
    breakIn: 999,
    army: [{ x: p.x, y: p.y, kind: 'brute', hp: 6, max: 6, speed: 40, cool: 0 }],
  })
  let furthest = 0
  for (let i = 0; i < 60 * 60; i++) {
    s = hc.step({ ...s, swingIn: 999 }, 1 / 60, {}, middle)
    furthest = Math.max(furthest, Math.hypot(s.army[0].x - p.x, s.army[0].y - p.y))
  }
  assert.equal(s.kills, 1)
  assert.ok(s.score > 0)
  assert.equal(s.foes.length, 1, 'the far one left be')
  assert.ok(furthest <= hc.ARMY.leash + 5, `went ${furthest} away`)
  // A minute on, still there, by my head
  assert.equal(s.army.length, 1)
  assert.ok(Math.hypot(s.army[0].x - p.x, s.army[0].y - p.y) < 80)
  // Left behind (my head's moved off), it comes back rather than fighting
  s = { ...s, foes: [{ ...s.foes[0], x: p.x + 300, y: p.y }], army: [{ ...s.army[0], x: p.x + 280, y: p.y }], player: { ...p, x: p.x - 100 } }
  s = run(s, 8)
  assert.ok(Math.hypot(s.army[0].x - s.player.x, s.army[0].y - s.player.y) < 120)
})

test('headcount: clearing a wave gives a heart back, then the next wave comes, tougher', () => {
  let s = arena([], { hearts: 1, toSpawn: 0, breakIn: 0 })
  s = hc.step(s, 1 / 60, {}, middle)
  assert.ok(s.cleared)
  assert.equal(s.hearts, 2)
  s = run(s, 3)
  assert.equal(s.wave, 2)
  s = run({ ...s, wave: 10, toSpawn: 1, spawnIn: 0 }, 1 / 60)
  const late = s.foes.at(-1)
  assert.ok(late.max > hc.KINDS[late.kind].hp && late.speed > hc.KINDS[late.kind].speed)
  assert.ok(hc.swordDamage(10) > hc.swordDamage(1))
})

test('headcount: a bot that raises an army lasts a while and scores, and every setting has its own board', () => {
  let s = hc.start()
  // It backs off from ghouls right by it, drifts to the middle, and raises whenever it can
  for (let i = 0; i < 60 * 120 && !s.over; i++) {
    const p = s.player
    let move = [(hc.MAP.width / 2 - p.x) / 800, (hc.MAP.height / 2 - p.y) / 800]
    for (const f of s.foes) {
      const d = Math.hypot(f.x - p.x, f.y - p.y)
      if (d < 34 + hc.KINDS[f.kind].r) move = [move[0] - (f.x - p.x) / d, move[1] - (f.y - p.y) / d]
    }
    s = hc.raise(hc.step(s, 1 / 60, { move }))
  }
  assert.ok(s.wave >= 3, `got to wave ${s.wave}`)
  assert.ok(s.raised > 0)
  assert.deepEqual(hc.HEADCOUNT_GAMES.sort(), ['headcount', 'headcount-fragile', 'headcount-swarm', 'headcount-swarm-fragile'])
})
