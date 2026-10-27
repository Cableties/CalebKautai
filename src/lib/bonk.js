// The rules of Bonk (pages/Bonk.jsx): whack-a-mole with Caleb's head, kept free of the DOM so they
// can be unit tested. One head at a time pops out of one of HOLES holes, and stays up for less
// time as the round goes on.
export const HOLES = 9
export const ROUND_MS = 30_000
export const UP_MS = { start: 1100, end: 520 } // how long a head stays up, at the start and the end
export const GAP_MS = 180 // between one head going down and the next coming up
// The most anyone could score: every head bonked the moment it shows. The server checks against it.
export const MAX_SCORE = Math.ceil(ROUND_MS / (UP_MS.end / 3 + GAP_MS))

export function upTime(elapsed) {
  const t = Math.min(1, Math.max(0, elapsed / ROUND_MS))
  return Math.round(UP_MS.start + (UP_MS.end - UP_MS.start) * t)
}

// A different hole from the last one, so it never looks like it didn't move
export function nextHole(previous, random = Math.random) {
  const pick = Math.floor(random() * (HOLES - 1))
  return previous == null ? Math.floor(random() * HOLES) : pick >= previous ? pick + 1 : pick
}
