// The maths behind the bouncing head (components/BouncingHead.jsx), kept free of the DOM so it
// can be unit tested.
//
// Angles are in degrees on screen: 0 = right, 90 = down. The poses face right, from straight up to
// straight down; facing left uses the same poses mirrored. The face eases toward the direction of
// travel. It always shows exactly one pose (cross-fading two different photos ghosts a second face
// over the first), tilted toward where it's really pointing, so the turn still looks continuous.
// The mirror flip happens only as the face passes straight up or down, where the poses are
// symmetric, so it never shows.
// `name` ends each head's source file in images-src/ (bounce-up.png, amber-up.png, …), and
// scripts/pixel-sprites.mjs turns each head's five into one sprite sheet
export const POSES = [
  { angle: -90, name: 'up' },
  { angle: -45, name: 'up-right' },
  { angle: 0, name: 'right' },
  { angle: 45, name: 'down-right' },
  { angle: 90, name: 'down' },
]
// Each pose is pre-drawn at these tilts, so the pixel art never has to be rotated in the browser
export const TILTS = [-22.5, -11.25, 0, 11.25, 22.5]
// The heads that can bounce. `sprite` is a sheet frame's size in art pixels: the side-on pose is
// `art` pixels wide, plus room to tilt. Amber's is taller, for her hair.
export const HEADS = {
  caleb: { files: 'bounce', sheet: '/images/bounce-sprites.png', sprite: { art: 32, width: 48, height: 56 } },
  amber: { files: 'amber', sheet: '/images/amber-sprites.png', sprite: { art: 40, width: 66, height: 72 }, colours: 24 },
}
export const SPRITE = HEADS.caleb.sprite
export const SPEED = 140 // px per second: its normal cruising speed
export const MAX_THROW = 2400 // px per second: the fastest it can be thrown
const SETTLE = 0.9 // how quickly a thrown head slows back to cruising speed (per second)
const MIN_THROW = 60 // px per second: let go slower than this and it just carries on bouncing
export const TURN = 9 // how quickly the face turns toward its direction of travel
const NUDGE = 20 // random change (degrees) on each bounce, so the angle drifts and every pose gets used
export const MIN_SLOPE = 15 // keep the path this many degrees off horizontal/vertical, so it never gets stuck

export const normalise = (a) => ((((a + 180) % 360) + 360) % 360) - 180
export const toRad = (a) => (a * Math.PI) / 180

// After a bounce: nudge the angle, but keep it heading away from the wall it hit and off the axes
export function nudge(angle, random = Math.random) {
  const sx = Math.sign(Math.cos(toRad(angle))) || 1
  const sy = Math.sign(Math.sin(toRad(angle))) || 1
  const a = normalise(angle + (random() * 2 - 1) * NUDGE)
  const slope = Math.min(90 - MIN_SLOPE, Math.max(MIN_SLOPE, Math.abs(Math.atan(Math.tan(toRad(a))) * (180 / Math.PI))))
  return (Math.atan2(sy * Math.sin(toRad(slope)), sx * Math.cos(toRad(slope))) * 180) / Math.PI
}

// Which pose to show for a face pointing at `facing`, mirrored or not, and how far to tilt it
// (degrees, clockwise) from that pose's own direction toward `facing`
export function pose(facing) {
  const mirrored = Math.abs(facing) > 90
  const a = mirrored ? normalise(180 - facing) : facing // now between -90 (up) and 90 (down)
  let index = 0
  POSES.forEach((p, i) => {
    if (Math.abs(a - p.angle) < Math.abs(a - POSES[index].angle)) index = i
  })
  return { index, mirrored, tilt: a - POSES[index].angle }
}

// Which frame of the sprite sheet to show: the pose's row, the nearest pre-drawn tilt's column
export function frame(facing) {
  const { index, mirrored, tilt } = pose(facing)
  let col = 0
  TILTS.forEach((t, i) => {
    if (Math.abs(tilt - t) < Math.abs(tilt - TILTS[col])) col = i
  })
  return { row: index, col, mirrored }
}

// Where a head's face is on screen: a circle around the middle of its frame, `px` screen pixels per
// art pixel. (The frames have empty corners, so their boxes would touch too early.)
export const faceCircle = (state, sprite, px) => ({
  x: state.x + (sprite.width * px) / 2,
  y: state.y + (sprite.height * px) / 2,
  r: (sprite.art * px) / 2,
})
export const touching = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r
// Clearly apart again, not just a hair's breadth after a bounce, so a new meeting can count
export const parted = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) > (a.r + b.r) * 1.2

const velocity = ({ travel, speed = SPEED }) => [Math.cos(toRad(travel)) * speed, Math.sin(toRad(travel)) * speed]
function moving(state, [vx, vy]) {
  const speed = Math.min(MAX_THROW, Math.max(SPEED, Math.hypot(vx, vy)))
  return { ...state, travel: (Math.atan2(vy, vx) * 180) / Math.PI, speed }
}

// Two heads whose faces (`fa`, `fb`, from faceCircle) overlap: push them apart and bounce them off
// each other. Free heads trade the parts of their speed that point at each other, like two equal
// balls. A held head (`aHeld`, moving at `push` px per second) doesn't budge: it shoves the other
// out of the way, sending it off at least as fast as it's being pushed. Returns [a, b].
export function collide(a, b, fa, fb, { aHeld = false, bHeld = false, push = [0, 0] } = {}) {
  if (aHeld && bHeld) return [a, b]
  if (bHeld) {
    const [b2, a2] = collide(b, a, fb, fa, { aHeld: true, push })
    return [a2, b2]
  }
  const dist = Math.hypot(fb.x - fa.x, fb.y - fa.y)
  const overlap = fa.r + fb.r - dist
  if (overlap <= 0) return [a, b]
  // n: the direction from a's face to b's (straight sideways if they're exactly on top of each other)
  const [nx, ny] = dist > 0 ? [(fb.x - fa.x) / dist, (fb.y - fa.y) / dist] : [1, 0]
  const vb = velocity(b)
  const bn = vb[0] * nx + vb[1] * ny // b's speed away from a

  if (aHeld) {
    const pushed = push[0] * nx + push[1] * ny
    const away = bn >= Math.max(pushed, 0) ? bn : Math.max(-bn, pushed)
    const b2 = moving({ ...b, x: b.x + nx * overlap, y: b.y + ny * overlap }, [vb[0] + (away - bn) * nx, vb[1] + (away - bn) * ny])
    return [a, b2]
  }

  const va = velocity(a)
  const closing = va[0] * nx + va[1] * ny - bn
  const half = overlap / 2
  let a2 = { ...a, x: a.x - nx * half, y: a.y - ny * half }
  let b2 = { ...b, x: b.x + nx * half, y: b.y + ny * half }
  if (closing > 0) {
    a2 = moving(a2, [va[0] - closing * nx, va[1] - closing * ny])
    b2 = moving(b2, [vb[0] + closing * nx, vb[1] + closing * ny])
  }
  return [a2, b2]
}

// Let go of the head while it's moving at (vx, vy) px per second: it flies off that way, as fast as
// it was thrown (within MAX_THROW), then slows back to cruising speed. A gentle let-go doesn't
// count as a throw; it just carries on as it was.
export function release(state, vx, vy) {
  const speed = Math.hypot(vx, vy)
  if (speed < MIN_THROW) return { ...state, speed: SPEED }
  const travel = (Math.atan2(vy, vx) * 180) / Math.PI
  return { ...state, travel, speed: Math.min(MAX_THROW, Math.max(SPEED, speed)) }
}

// One frame of movement inside a box of maxX × maxY. Returns the new state.
export function step(state, dt, maxX, maxY, random = Math.random) {
  let { x, y, travel, facing, squash, speed = SPEED } = state
  x += Math.cos(toRad(travel)) * speed * dt
  y += Math.sin(toRad(travel)) * speed * dt
  let bounced = false
  // Only turned round if it's heading into the wall: another head can shove it there while it's
  // already heading back out
  const [dx, dy] = [Math.cos(toRad(travel)), Math.sin(toRad(travel))]
  if ((x <= 0 && dx < 0) || (x >= maxX && dx > 0)) {
    travel = normalise(180 - travel)
    bounced = true
  }
  if ((y <= 0 && dy < 0) || (y >= maxY && dy > 0)) {
    travel = normalise(-travel)
    bounced = true
  }
  x = Math.min(Math.max(x, 0), maxX)
  y = Math.min(Math.max(y, 0), maxY)
  if (bounced) {
    travel = nudge(travel, random)
    squash = 1
  }
  facing = normalise(facing + normalise(travel - facing) * (1 - Math.exp(-TURN * dt)))
  squash *= Math.exp(-10 * dt)
  // A thrown head eases back down to cruising speed
  speed = SPEED + (speed - SPEED) * Math.exp(-SETTLE * dt)
  return { x, y, travel, facing, squash, speed }
}
