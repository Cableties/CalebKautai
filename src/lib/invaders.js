// The rules of Invaders (pages/Invaders.jsx), kept free of the DOM so they can be unit tested.
// The screen is a fixed WIDTH × HEIGHT box in its own units (y grows downwards); the page scales it
// to fit. A fleet of aliens marches side to side, dropping a row at each edge and speeding up as it
// thins out; the player's cannon slides along the bottom, firing up at it from behind three bunkers.
// Clear the fleet and a faster one comes, a little lower. Now and then a saucer flies over the top
// for bonus points.
export const WIDTH = 360
export const HEIGHT = 640
export const PLAYER = { y: 590, half: 18, speed: 240 } // the cannon: its middle, half its width, px/s
const BULLET = { speed: 560, cooldown: 0.38, max: 2 }
const BOMB = { speed: 190, every: 1.15, fastest: 0.4 } // seconds between bombs, on average, at the start
export const ALIEN = { width: 30, height: 24 }
export const FLEET = { cols: 6, rows: 4, gapX: 46, gapY: 38, top: 120, step: 10, drop: 18 }
const MARCH = { slowest: 0.55, fastest: 0.05 } // seconds between the fleet's steps, full and nearly empty
export const POINTS = [30, 20, 20, 10] // by row, top to bottom
export const SAUCER = { y: 76, speed: 85, points: [100, 150, 200, 300], every: [14, 24] }
export const LIVES = 3
const HURT = 1.6 // seconds of flashing after losing a life, when bombs pass through
// Bunkers: blocks of BLOCK px, in this shape (an arch under each)
export const BLOCK = 4
const BUNKER = ['  #######  ', ' ######### ', '###########', '###########', '###########', '###     ###', '##       ##']
const BUNKERS = { y: 488, xs: [70, 180, 290] }
// Easy Mode (a secret cheat): a spare life, fewer bombs, and a slower march
const EASY = { lives: 1, bombs: 1.4, march: 1.15 }
// The fastest anyone could score, for the server's sanity check: a top-row alien with every shot,
// plus every saucer
export const POINTS_PER_SECOND = 160

const fleetLeft = () => (WIDTH - (FLEET.cols - 1) * FLEET.gapX) / 2
// Where an alien is (its middle)
export const alienAt = (fleet, col, row) => [fleet.x + col * FLEET.gapX, fleet.y + row * FLEET.gapY]

function bunkers() {
  const blocks = []
  for (const cx of BUNKERS.xs) {
    const left = cx - (BUNKER[0].length * BLOCK) / 2
    BUNKER.forEach((line, r) =>
      [...line].forEach((c, i) => c === '#' && blocks.push({ x: left + i * BLOCK, y: BUNKERS.y + r * BLOCK })),
    )
  }
  return blocks
}

function newFleet(wave) {
  return {
    x: fleetLeft(),
    y: FLEET.top + Math.min(60, (wave - 1) * 12),
    dir: 1,
    timer: 0,
    frame: 0,
    alive: Array(FLEET.cols * FLEET.rows).fill(true),
  }
}

export function start({ easy = false } = {}) {
  return {
    x: WIDTH / 2,
    lives: LIVES + (easy ? EASY.lives : 0),
    score: 0,
    wave: 1,
    fleet: newFleet(1),
    bullets: [],
    bombs: [],
    blocks: bunkers(),
    booms: [], // little explosions where something was hit: { x, y, age }
    saucer: null,
    saucerIn: SAUCER.every[0],
    bombIn: BOMB.every,
    cooldown: 0,
    hurt: 0,
    shot: false, // fired this frame (for the sound)
    over: false,
    easy,
  }
}

const marchEvery = (s) => {
  const left = s.fleet.alive.filter(Boolean).length / s.fleet.alive.length
  const pace = MARCH.fastest + (MARCH.slowest - MARCH.fastest) * left
  return (pace / (1 + 0.15 * (s.wave - 1))) * (s.easy ? EASY.march : 1)
}

// Knock out the bunker blocks around a hit; true if it hit any
function chip(s, x, y) {
  const hit = s.blocks.some((b) => x >= b.x && x < b.x + BLOCK && y >= b.y && y < b.y + BLOCK)
  if (hit) s.blocks = s.blocks.filter((b) => Math.hypot(b.x + BLOCK / 2 - x, b.y + BLOCK / 2 - y) > BLOCK * 1.6)
  return hit
}

// One frame. `input`: { left, right, fire } (keys held), or { target, fire } (a finger: slide
// towards x = target).
export function step(state, dt, input = {}, random = Math.random) {
  if (state.over) return state
  const s = structuredClone(state)
  s.shot = false
  s.hurt = Math.max(0, s.hurt - dt)
  s.booms = s.booms.map((b) => ({ ...b, age: b.age + dt })).filter((b) => b.age < 0.3)

  // The cannon
  const reach = PLAYER.speed * dt
  let dx = input.target != null ? Math.max(-reach * 1.6, Math.min(reach * 1.6, input.target - s.x)) : 0
  if (input.left) dx -= reach
  if (input.right) dx += reach
  s.x = Math.max(PLAYER.half + 4, Math.min(WIDTH - PLAYER.half - 4, s.x + dx))
  s.cooldown -= dt
  if (input.fire && s.cooldown <= 0 && s.bullets.length < BULLET.max) {
    s.bullets.push({ x: s.x, y: PLAYER.y - 18 })
    s.cooldown = BULLET.cooldown
    s.shot = true
  }

  // The fleet marches in steps, dropping and turning at the edges
  const f = s.fleet
  f.timer += dt
  while (f.timer >= marchEvery(s)) {
    f.timer -= marchEvery(s)
    f.frame ^= 1
    const cols = [...Array(FLEET.cols).keys()].filter((c) => [...Array(FLEET.rows).keys()].some((r) => f.alive[r * FLEET.cols + c]))
    const next = f.x + f.dir * FLEET.step
    const left = next + cols[0] * FLEET.gapX - ALIEN.width / 2
    const right = next + cols.at(-1) * FLEET.gapX + ALIEN.width / 2
    if (left < 6 || right > WIDTH - 6) {
      f.y += FLEET.drop
      f.dir = -f.dir
    } else f.x = next
  }

  // Bombs from the bottom alien of a random column
  s.bombIn -= dt
  if (s.bombIn <= 0) {
    const every = Math.max(BOMB.fastest, BOMB.every - 0.12 * (s.wave - 1)) * (s.easy ? EASY.bombs : 1)
    s.bombIn = every * (0.6 + 0.8 * random())
    const cols = [...Array(FLEET.cols).keys()].filter((c) => [...Array(FLEET.rows).keys()].some((r) => f.alive[r * FLEET.cols + c]))
    if (cols.length) {
      const c = cols[Math.floor(random() * cols.length)]
      const r = [...Array(FLEET.rows).keys()].reverse().find((r) => f.alive[r * FLEET.cols + c])
      const [ax, ay] = alienAt(f, c, r)
      s.bombs.push({ x: ax, y: ay + ALIEN.height / 2 })
    }
  }

  // The saucer
  s.saucerIn -= dt
  if (!s.saucer && s.saucerIn <= 0) {
    const dir = random() < 0.5 ? 1 : -1
    s.saucer = { x: dir > 0 ? -30 : WIDTH + 30, dir, points: SAUCER.points[Math.floor(random() * SAUCER.points.length)] }
    s.saucerIn = SAUCER.every[0] + random() * (SAUCER.every[1] - SAUCER.every[0])
  }
  if (s.saucer) {
    s.saucer.x += s.saucer.dir * SAUCER.speed * dt
    if (s.saucer.x < -40 || s.saucer.x > WIDTH + 40) s.saucer = null
  }

  // Shots going up: into an alien, the saucer, a bunker, or off the top
  s.bullets = s.bullets.filter((b) => {
    b.y -= BULLET.speed * dt
    if (b.y < 0) return false
    if (chip(s, b.x, b.y)) return false
    for (let i = 0; i < f.alive.length; i++) {
      if (!f.alive[i]) continue
      const [ax, ay] = alienAt(f, i % FLEET.cols, Math.floor(i / FLEET.cols))
      if (Math.abs(b.x - ax) < ALIEN.width / 2 && Math.abs(b.y - ay) < ALIEN.height / 2) {
        f.alive[i] = false
        s.score += POINTS[Math.floor(i / FLEET.cols)]
        s.booms.push({ x: ax, y: ay, age: 0 })
        return false
      }
    }
    if (s.saucer && Math.abs(b.x - s.saucer.x) < 22 && Math.abs(b.y - SAUCER.y) < 16) {
      s.score += s.saucer.points
      s.booms.push({ x: s.saucer.x, y: SAUCER.y, age: 0, points: s.saucer.points })
      s.saucer = null
      return false
    }
    return true
  })

  // Bombs coming down: into a bunker, the cannon, or off the bottom
  s.bombs = s.bombs.filter((b) => {
    b.y += BOMB.speed * dt
    if (b.y > HEIGHT) return false
    if (chip(s, b.x, b.y)) return false
    if (!s.hurt && Math.abs(b.x - s.x) < PLAYER.half && b.y > PLAYER.y - 10 && b.y < PLAYER.y + 12) {
      s.lives--
      s.hurt = HURT
      s.booms.push({ x: s.x, y: PLAYER.y, age: 0 })
      if (s.lives <= 0) s.over = true
      return false
    }
    return true
  })
  // A hit clears the other bombs, a breather before carrying on
  if (s.hurt === HURT) s.bombs = []

  // The fleet eats through the bunkers it reaches, and it's over if it reaches the cannon
  for (let i = 0; i < f.alive.length; i++) {
    if (!f.alive[i]) continue
    const [ax, ay] = alienAt(f, i % FLEET.cols, Math.floor(i / FLEET.cols))
    s.blocks = s.blocks.filter(
      (b) => !(Math.abs(b.x + BLOCK / 2 - ax) < ALIEN.width / 2 && Math.abs(b.y + BLOCK / 2 - ay) < ALIEN.height / 2),
    )
    if (ay + ALIEN.height / 2 >= PLAYER.y - 14) s.over = true
  }

  // Fleet cleared: the next wave
  if (f.alive.every((a) => !a)) {
    s.wave++
    s.fleet = newFleet(s.wave)
    s.bullets = []
    s.bombs = []
  }
  return s
}
