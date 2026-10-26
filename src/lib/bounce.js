// The maths behind the bouncing head (components/BouncingHead.jsx), kept free of the DOM so it
// can be unit tested.
//
// Angles are in degrees on screen: 0 = right, 90 = down. The poses face right, from straight up to
// straight down; facing left uses the same poses mirrored. The face eases toward the direction of
// travel. It always shows exactly one pose (cross-fading two different photos ghosts a second face
// over the first), tilted toward where it's really pointing, so the turn still looks continuous.
// The mirror flip happens only as the face passes straight up or down, where the poses are
// symmetric, so it never shows.
// `file` is the source in images-src/; scripts/pixel-sprites.mjs turns them into one sprite sheet
export const POSES = [
  { angle: -90, file: 'bounce-up.png' },
  { angle: -45, file: 'bounce-up-right.png' },
  { angle: 0, file: 'bounce-right.png' },
  { angle: 45, file: 'bounce-down-right.png' },
  { angle: 90, file: 'bounce-down.png' },
]
// Each pose is pre-drawn at these tilts, so the pixel art never has to be rotated in the browser
export const TILTS = [-22.5, -11.25, 0, 11.25, 22.5]
// Sprite sheet frame size in art pixels (the head itself is `art` pixels wide, plus room to tilt)
export const SPRITE = { art: 32, width: 48, height: 56 }
export const SPEED = 140 // px per second
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

// One frame of movement inside a box of maxX × maxY. Returns the new state.
export function step(state, dt, maxX, maxY, random = Math.random) {
  let { x, y, travel, facing, squash } = state
  x += Math.cos(toRad(travel)) * SPEED * dt
  y += Math.sin(toRad(travel)) * SPEED * dt
  let bounced = false
  if (x <= 0 || x >= maxX) {
    travel = normalise(180 - travel)
    x = Math.min(Math.max(x, 0), maxX)
    bounced = true
  }
  if (y <= 0 || y >= maxY) {
    travel = normalise(-travel)
    y = Math.min(Math.max(y, 0), maxY)
    bounced = true
  }
  if (bounced) {
    travel = nudge(travel, random)
    squash = 1
  }
  facing = normalise(facing + normalise(travel - facing) * (1 - Math.exp(-TURN * dt)))
  squash *= Math.exp(-10 * dt)
  return { x, y, travel, facing, squash }
}
