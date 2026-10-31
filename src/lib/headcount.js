import { allSettingsGames, settingsGame } from './settings.js'

// The rules of Headcount (pages/Headcount.jsx), kept free of the DOM so they can be unit tested.
// The map is a MAP-sized field in its own units (y grows downwards), much bigger than the screen: the
// camera follows my head (camera()), and the screen shows a WIDTH (wider on a desktop) × VIEW window
// of it under the score strip. Ghouls come in from just out of sight in waves and close in on my head,
// which swings a sword at any that get close, by itself. That only keeps them off: the army does the
// real fighting. Each one knocked down leaves a grave, which stays: raise() brings graves anywhere on
// the map back up as its army (the strongest first, when there isn't room for them all), which comes
// to my head, stays by it and fights the ghouls that come close. Clear a wave for a heart back; lose
// every heart and it's over.
export const WIDTH = 360
export const HEIGHT = 640
export const HUD = 44
export const VIEW = HEIGHT - HUD // how much of the map the screen shows, top to bottom
export const MAP = { width: 1500, height: 1500 }
export const PLAYER = { r: 13, speed: 150, hearts: 3, easy: 2, safe: 1.2 } // safe: seconds untouchable after a bite
// My head's sword: how far past my head it reaches, how wide a swing (radians), seconds between
// swings, how long one takes (for drawing it), and how far it knocks them back
export const SWORD = { reach: 26, arc: 1.7, every: 0.75, swing: 0.18, knock: 22 }
export const RAISE = { cooldown: 1 }
export const GRAVES = 150 // the most there can be, the oldest going first past that
// The army: as many as this at once, this much faster than it was, going only for ghouls this near my
// head, and never further from it than its leash
export const ARMY = { max: 30, speed: 1.25, engage: 140, leash: 170 }
// Each kind, on either side. `rank`: how strong a one it is, for raising the best first when the army's
// nearly full. Spitters keep off and spit from a distance; bloaters burst when they're knocked down,
// hurting the other side round them; wraiths go for my head, past the army; a lord comes every fifth
// wave.
export const KINDS = {
  shambler: { r: 11, speed: 40, hp: 2, points: 10, rank: 1 },
  runner: { r: 9, speed: 78, hp: 1, points: 15, rank: 1 },
  spitter: { r: 10, speed: 36, hp: 2, points: 25, rank: 2, spits: true },
  bloater: { r: 15, speed: 30, hp: 4, points: 30, rank: 2, bursts: true },
  wraith: { r: 10, speed: 92, hp: 2, points: 35, rank: 3, haunts: true },
  brute: { r: 17, speed: 27, hp: 6, points: 40, rank: 3 },
  lord: { r: 26, speed: 24, hp: 24, points: 300, rank: 4 },
}
// Spit: how near it has to be, seconds between, how fast it flies, how big, and how near a spitter
// comes before it stops to spit
export const SPIT = { range: 190, every: 2, speed: 150, r: 5, keep: 120 }
export const BURST = { radius: 60, damage: 3 }
// From which wave each kind comes, and how many of them (against the shamblers, which thin out)
const MIX = { runner: [2, 3], spitter: [3, 1.5], bloater: [4, 1.5], brute: [5, 1.5], wraith: [6, 1.2] }
const LORDS = 5 // a lord every this many waves (more of them, later on)
const BITE = 0.6 // seconds between bites, ghoul and army alike
const BREAK = 2 // seconds between waves
const SPAWN = { first: 0.8, every: 0.75, least: 0.25, out: 20 } // out: how far out of sight they come in
const RAISED_POINTS = 5 // each one raised (times the wave)
const SUB = 1 / 120 // seconds per step, at most

export const SETTINGS = [
  { id: 'swarm', name: 'Swarm', note: 'More ghouls, coming in faster.' },
  { id: 'fragile', name: 'One heart', note: 'One bite and it’s over.' },
]
export const headcountGame = (settings = {}) => settingsGame('headcount', SETTINGS, settings)
export const HEADCOUNT_GAMES = allSettingsGames('headcount', SETTINGS)

// The fastest anyone could score, for the server's sanity check: far more brutes a second, late on,
// than anyone could knock down
export const POINTS_PER_SECOND = 50_000

// `width`: the screen's width (wider on a desktop)
export function start({ easy = false, swarm = false, fragile = false, width = WIDTH } = {}) {
  const hearts = fragile ? 1 : PLAYER.hearts + (easy ? PLAYER.easy : 0)
  return {
    width,
    easy,
    swarm,
    wave: 0,
    score: 0,
    hearts,
    maxHearts: hearts,
    safe: 0,
    player: { x: MAP.width / 2, y: MAP.height / 2, facing: 0 },
    foes: [], // { x, y, kind, hp, max, speed, cool, spitIn }
    army: [], // the same
    graves: [], // { x, y, kind, max, age }
    spits: [], // { x, y, vx, vy, age, army (whose it is) }
    lords: 0, // lords still to come this wave
    swing: null, // the sword's last swing: { angle (radians, where it's centred), age }
    swingIn: 0,
    raiseIn: 0,
    toSpawn: 0, // ghouls still to come this wave
    spawnIn: 0,
    breakIn: 1, // till the next wave, between waves
    kills: 0,
    raised: 0, // all game
    biggest: 0, // the biggest army all game
    over: false,
    pops: [], // { x, y, colour: 'foe' | 'army', age }
    labels: [], // { x, y, text, age }
  }
}

// Where the screen's window onto the map is (its top left): on my head, but not past the map's edges
export function camera(s) {
  return {
    x: Math.max(0, Math.min(MAP.width - s.width, s.player.x - s.width / 2)),
    y: Math.max(0, Math.min(MAP.height - VIEW, s.player.y - VIEW / 2)),
  }
}

const onMap = (x, y, r) => [Math.max(r, Math.min(MAP.width - r, x)), Math.max(r, Math.min(MAP.height - r, y))]
const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
function nearest(list, from, within = Infinity) {
  let best = null
  let least = within
  for (const u of list) {
    const d = near(u, from)
    if (d < least) [best, least] = [u, d]
  }
  return best
}

// How many ghouls a wave brings (more on a wide screen, and with Swarm on)
export function waveSize(s, wave = s.wave) {
  return Math.round((8 + 5 * (wave - 1)) * (s.swarm ? 1.6 : 1) * Math.sqrt(s.width / WIDTH))
}
// Tougher as the waves go on: more to knock down, and quicker
const toughness = (wave) => Math.floor((wave - 1) / 2)
const quickness = (wave) => Math.min(1.6, 1 + 0.03 * (wave - 1))
// Ghouls bite the army harder as the waves go on
export const bite = (wave) => 1 + Math.floor((wave - 1) / 5)
// My head's sword hits harder as the waves go on, a little
export const swordDamage = (wave) => 1 + Math.floor((wave - 1) / 8)

export function kindFor(wave, random) {
  const mix = [['shambler', Math.max(2, 7 - 0.4 * wave)], ...Object.entries(MIX).filter(([, [from]]) => wave >= from).map(([kind, [, many]]) => [kind, many])]
  let roll = random() * mix.reduce((all, [, many]) => all + many, 0)
  for (const [kind, many] of mix) if ((roll -= many) < 0) return kind
  return 'shambler'
}

// Just out of sight past one of the screen's edges, on the map (the map's bigger than the screen, so
// at least one edge has map past it)
function spawnPoint(s, r, random) {
  const cam = camera(s)
  const out = r + SPAWN.out
  const side = Math.floor(random() * 4)
  const along = random()
  // That edge, or the next round that has map past it
  for (let i = 0; ; i++) {
    const [x, y] = [
      [cam.x + along * s.width, cam.y - out],
      [cam.x + s.width + out, cam.y + along * VIEW],
      [cam.x + along * s.width, cam.y + VIEW + out],
      [cam.x - out, cam.y + along * VIEW],
    ][(side + i) % 4]
    if ((x >= r && x <= MAP.width - r && y >= r && y <= MAP.height - r) || i >= 3) return onMap(x, y, r)
  }
}

function spawn(s, random) {
  const lord = s.lords > 0
  const kind = lord ? 'lord' : kindFor(s.wave, random)
  const { r, hp, speed } = KINDS[kind]
  const [x, y] = spawnPoint(s, r, random)
  const max = hp + toughness(s.wave) * (lord ? 4 : 1)
  s.foes.push({ x, y, kind, hp: max, max, speed: speed * quickness(s.wave), cool: 0, spitIn: SPIT.every })
  if (lord) {
    s.lords--
    s.labels.push({ x: s.player.x, y: s.player.y - 60, text: 'A ghoul lord!', age: 0 })
  }
}

function nextWave(s) {
  s.wave++
  s.toSpawn = waveSize(s)
  s.lords = s.wave % LORDS ? 0 : s.wave / LORDS
  s.spawnIn = SPAWN.first
  s.waveStarted = true
}

// The graves a raise would bring up: every one, if there's room in the army; if not, as many as there's
// room for, the strongest first
export function toRaise(s) {
  const room = Math.max(0, ARMY.max - s.army.length)
  if (s.graves.length <= room) return s.graves
  return [...s.graves].sort((a, b) => KINDS[b.kind].rank - KINDS[a.kind].rank || b.max - a.max).slice(0, room)
}

// Raise the graves, wherever they are on the map (toRaise()): each one comes back up on my side, as
// tough as it was. Flags how many (`raisedNow`), or `fizzled` if none.
export function raise(state) {
  if (state.over || state.raiseIn > 0) return state
  const s = { ...state, graves: [...state.graves], army: [...state.army], labels: [...state.labels] }
  const up = toRaise(s)
  s.raiseIn = RAISE.cooldown
  if (!up.length) return { ...s, fizzled: true }
  s.graves = s.graves.filter((g) => !up.includes(g))
  for (const g of up) {
    const { speed } = KINDS[g.kind]
    s.army.push({ x: g.x, y: g.y, kind: g.kind, hp: g.max, max: g.max, speed: speed * ARMY.speed, cool: 0, spitIn: 0 })
  }
  const points = up.length * RAISED_POINTS * Math.max(1, s.wave)
  s.score += points
  s.raised += up.length
  s.biggest = Math.max(s.biggest, s.army.length)
  s.raisedNow = up.length
  s.labels.push({ x: s.player.x, y: s.player.y - 30, text: up.length > 1 ? `Rise! ×${up.length}` : 'Rise!', age: 0 })
  return s
}

// Overlapping ones pushed apart, half each
function spread(units) {
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const [a, b] = [units[i], units[j]]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy)
      const overlap = KINDS[a.kind].r + KINDS[b.kind].r - d
      if (overlap <= 0) continue
      const [nx, ny] = d ? [dx / d, dy / d] : [1, 0]
      a.x -= (nx * overlap) / 2
      a.y -= (ny * overlap) / 2
      b.x += (nx * overlap) / 2
      b.y += (ny * overlap) / 2
    }
  }
}

function toward(u, x, y, speed, h, stop = 0) {
  const dx = x - u.x
  const dy = y - u.y
  const d = Math.hypot(dx, dy)
  if (d <= stop) return
  const by = Math.min(d - stop, speed * h)
  u.x += (dx / d) * by
  u.y += (dy / d) * by
}

// A heart off my head (then there's a moment nothing can again)
function hurt(s) {
  s.hearts--
  s.safe = PLAYER.safe
  s.hurt = true
  if (s.hearts <= 0) s.over = true
}

// A spitter spits at what it's after, once it's near enough
function spit(s, u, target, h, army) {
  u.spitIn = Math.max(0, (u.spitIn ?? 0) - h)
  const d = near(u, target)
  if (u.spitIn > 0 || !d || d > SPIT.range) return
  s.spits.push({ x: u.x, y: u.y, vx: ((target.x - u.x) / d) * SPIT.speed, vy: ((target.y - u.y) / d) * SPIT.speed, age: 0, army })
  u.spitIn = SPIT.every
}

// A bloater knocked down bursts, hurting the other side round it
function burst(s, u, others) {
  for (const o of others) if (near(o, u) < BURST.radius + KINDS[o.kind].r) o.hp -= BURST.damage
  s.pops.push({ x: u.x, y: u.y, colour: 'burst', age: 0 })
  s.burst = true
}

// One step of `h` seconds
function tick(s, h, input, random) {
  s.safe = Math.max(0, s.safe - h)
  s.raiseIn = Math.max(0, s.raiseIn - h)
  const p = s.player

  // My head: keys (or a finger) push it along (`move`, up to full speed), or it walks to a point on
  // the map (`to`)
  let [mx, my] = [input.move?.[0] ?? 0, input.move?.[1] ?? 0]
  if (input.to) {
    const dx = input.to[0] - p.x
    const dy = input.to[1] - p.y
    const d = Math.hypot(dx, dy)
    ;[mx, my] = d > 4 ? [dx / d, dy / d] : [0, 0]
  }
  const push = Math.hypot(mx, my)
  if (push > 1) [mx, my] = [mx / push, my / push]
  if (push > 0.05) p.facing = (Math.atan2(my, mx) * 180) / Math.PI
  ;[p.x, p.y] = onMap(p.x + mx * PLAYER.speed * h, p.y + my * PLAYER.speed * h, PLAYER.r)

  // A wave cleared: a heart back
  if (s.wave && !s.toSpawn && !s.foes.length && s.breakIn <= 0) {
    s.breakIn = BREAK
    s.cleared = true
    const back = s.hearts < s.maxHearts
    if (back) s.hearts++
    s.labels.push({ x: p.x, y: p.y - 60, text: back ? 'Wave cleared! +1 heart' : 'Wave cleared!', age: 0 })
  }
  // Waves: a break, then the ghouls coming in one by one
  if (!s.toSpawn && !s.foes.length) {
    if ((s.breakIn -= h) <= 0) nextWave(s)
  } else if (s.toSpawn && (s.spawnIn -= h) <= 0) {
    spawn(s, random)
    s.toSpawn--
    s.spawnIn = Math.max(SPAWN.least, SPAWN.every - 0.03 * s.wave) * (s.swarm ? 0.65 : 1)
  }

  // My head swings its sword, by itself, once a ghoul's in reach: at the nearest, hitting every one
  // in the swing, and knocking them back
  s.swingIn = Math.max(0, s.swingIn - h)
  if (s.swing) s.swing.age += h
  const inReach = (f) => near(f, p) - KINDS[f.kind].r <= PLAYER.r + SWORD.reach
  const target = s.swingIn <= 0 && nearest(s.foes.filter(inReach), p)
  if (target) {
    const angle = Math.atan2(target.y - p.y, target.x - p.x)
    for (const f of s.foes) {
      const off = Math.abs(((Math.atan2(f.y - p.y, f.x - p.x) - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
      if (f !== target && (!inReach(f) || off > SWORD.arc / 2)) continue
      f.hp -= swordDamage(s.wave)
      // (Big ones budge less)
      const knock = (SWORD.knock * Math.min(1, 17 / KINDS[f.kind].r)) / (near(f, p) || 1)
      f.x += (f.x - p.x) * knock
      f.y += (f.y - p.y) * knock
    }
    s.swing = { angle, age: 0 }
    s.swingIn = SWORD.every
    s.swung = true
  }

  // The ghouls go for whoever's nearest, my head or the army (wraiths for my head, whatever's in the
  // way). The army stays by my head: it goes for the nearest ghoul that's come close to my head, comes
  // back if it's strayed too far, and otherwise keeps round it. Spitters, either side, stop a way off
  // and spit.
  for (const f of s.foes) {
    const { haunts, spits } = KINDS[f.kind]
    const target = (!haunts && nearest(s.army, f, near(f, p))) || p
    // (A spitter comes for my head, near enough for the army to go for it, spitting at whoever's nearest)
    if (spits) toward(f, p.x, p.y, f.speed, h, SPIT.keep)
    else toward(f, target.x, target.y, f.speed, h)
    if (spits) spit(s, f, target, h, false)
  }
  const close = s.foes.filter((f) => near(f, p) <= ARMY.engage)
  for (const a of s.army) {
    const { spits } = KINDS[a.kind]
    const target = near(a, p) <= ARMY.leash && nearest(close, a)
    if (target) {
      toward(a, target.x, target.y, a.speed, h, spits ? SPIT.keep / 2 : 0)
      if (spits) spit(s, a, target, h, true)
    } else toward(a, p.x, p.y, a.speed, h, 40 + KINDS[a.kind].r)
  }
  spread([...s.foes, ...s.army])
  for (const u of [...s.foes, ...s.army]) [u.x, u.y] = onMap(u.x, u.y, KINDS[u.kind].r)

  // Spit flies straight: the ghouls' takes a heart off my head or hurts one of the army; the army's
  // hurts a ghoul
  s.spits = s.spits.filter((b) => {
    b.x += b.vx * h
    b.y += b.vy * h
    b.age += h
    if (!b.army && near(b, p) < PLAYER.r + SPIT.r) {
      if (s.safe <= 0 && !s.over) hurt(s)
      return false
    }
    const hit = (b.army ? s.foes : s.army).find((u) => near(u, b) < KINDS[u.kind].r + SPIT.r)
    if (hit) hit.hp--
    return !hit && b.age < (SPIT.range * 1.5) / SPIT.speed
  })

  // Bites: a ghoul touching my head takes a heart, and pushes off; ghouls and the army bite each other
  for (const f of s.foes) {
    f.cool = Math.max(0, f.cool - h)
    const reach = KINDS[f.kind].r + PLAYER.r
    const d = near(f, p)
    if (d < reach && s.safe <= 0 && !s.over) {
      hurt(s)
      const [nx, ny] = d ? [(f.x - p.x) / d, (f.y - p.y) / d] : [1, 0]
      f.x += nx * 30
      f.y += ny * 30
    }
  }
  for (const a of s.army) a.cool = Math.max(0, a.cool - h)
  for (const f of s.foes) {
    for (const a of s.army) {
      if (near(f, a) > KINDS[f.kind].r + KINDS[a.kind].r + 2) continue
      if (f.cool <= 0) {
        a.hp -= bite(s.wave)
        f.cool = BITE
      }
      if (a.cool <= 0) {
        f.hp--
        a.cool = BITE
      }
    }
  }

  // The knocked down: ghouls leave a grave and score (the army's included, times the wave); the
  // army just crumbles. Bloaters burst, either side.
  s.foes = s.foes.filter((f) => {
    if (f.hp > 0) return true
    if (KINDS[f.kind].bursts) burst(s, f, s.army)
    s.graves.push({ x: f.x, y: f.y, kind: f.kind, max: f.max, age: 0 })
    s.score += KINDS[f.kind].points * s.wave
    s.kills++
    s.killed = true
    s.pops.push({ x: f.x, y: f.y, colour: 'foe', age: 0 })
    return false
  })
  s.army = s.army.filter((a) => {
    if (a.hp > 0) return true
    if (KINDS[a.kind].bursts) burst(s, a, s.foes)
    s.pops.push({ x: a.x, y: a.y, colour: 'army', age: 0 })
    return false
  })
  for (const g of s.graves) g.age += h
  if (s.graves.length > GRAVES) s.graves = s.graves.slice(-GRAVES)
}

// One frame. `input`: { move: [x, y] } (each -1 to 1: keys, or a finger's stick) or { to: [x, y] }
// (walk to there on the map: the mouse). Flags what happened this frame, for the sounds: `swung`,
// `killed`, `burst`, `hurt`, `waveStarted`, `cleared` (and raise()'s `raisedNow` and `fizzled`).
export function step(state, dt, input = {}, random = Math.random) {
  if (state.over) return state
  const s = structuredClone(state)
  Object.assign(s, { swung: false, killed: false, burst: false, hurt: false, waveStarted: false, cleared: false, raisedNow: 0, fizzled: false })
  s.pops = s.pops.map((p) => ({ ...p, age: p.age + dt })).filter((p) => p.age < 0.4)
  s.labels = s.labels.map((l) => ({ ...l, age: l.age + dt })).filter((l) => l.age < 1.4)
  const steps = Math.max(1, Math.ceil(dt / SUB))
  for (let i = 0; i < steps && !s.over; i++) tick(s, dt / steps, input, random)
  return s
}
