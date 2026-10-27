// The maths behind the decision wheel (pages/DecisionWheel.jsx), kept free of the DOM so it can be
// unit tested. Angles are in degrees, clockwise from the top, where the pointer is.

export const MAX_WEIGHT = 10
export const MAX_OPTIONS = 20

// Each option's slice: as big as its share of the total weight
export function slices(options) {
  const total = options.reduce((sum, o) => sum + o.weight, 0)
  let start = 0
  return options.map((o) => {
    const size = (o.weight / total) * 360
    const slice = { ...o, start, end: start + size, chance: o.weight / total }
    start += size
    return slice
  })
}

// Pick the winner by weight: an option with weight 4 wins twice as often as one with weight 2
export function pick(options, random = Math.random) {
  const total = options.reduce((sum, o) => sum + o.weight, 0)
  let roll = random() * total
  for (const [i, o] of options.entries()) {
    roll -= o.weight
    if (roll < 0) return i
  }
  return options.length - 1
}

const mod = (a, n) => ((a % n) + n) % n

// Which slice is under the pointer when the wheel has turned `rotation` degrees clockwise
export function sliceAt(wheel, rotation) {
  const a = mod(-rotation, 360)
  const i = wheel.findIndex((s) => a >= s.start && a < s.end)
  return i === -1 ? wheel.length - 1 : i
}

// Where to stop: from `current`, at least `turns` full turns more, landing somewhere inside the
// winning slice (not right on its edge, so the result's never ambiguous)
export function landing(wheel, index, current, random = Math.random, turns = 6) {
  const { start, end } = wheel[index]
  const margin = (end - start) * 0.12
  const target = start + margin + random() * (end - start - 2 * margin)
  // Turning the wheel by R brings the point at `target` to the top when target + R ≡ 0 (mod 360)
  return current + turns * 360 + mod(-target - current, 360)
}
