// Themes that change as a game goes on (Flappy Head's places and times of day, Snake's seasons,
// a new look for each level): palettes of hex colours, mixed smoothly from one to the next.

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const isColour = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

// Partway (t, 0 to 1) from one hex colour to another
export function mix(a, b, t) {
  const [from, to] = [channels(a), channels(b)]
  return `#${from.map((v, i) => Math.round(v + (to[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

// Two palettes mixed key by key (lists of colours too), numbers as well. Anything else switches over
// halfway.
export function mixPalette(a, b, t) {
  const one = (x, y) =>
    isColour(x) && isColour(y) ? mix(x, y, t) : typeof x === 'number' && typeof y === 'number' ? x + (y - x) * t : t < 0.5 ? x : y
  return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Array.isArray(v) ? v.map((c, i) => one(c, b[k][i])) : one(v, b[k])]))
}

const smooth = (t) => t * t * (3 - 2 * t)

// Where a game is in its list of themes, going round and round. `at` counts them: 2.5 is halfway
// through the third. Each holds for most of its turn and changes into the next over the last
// `change` of it (1: changing the whole time). Returns the two themes' indexes, how far from one to
// the other (`t`), and the palette mixed.
export function themeAt(themes, at, change = 1) {
  const n = themes.length
  const whole = Math.floor(at)
  const from = ((whole % n) + n) % n
  const to = (from + 1) % n
  const t = smooth(Math.min(1, Math.max(0, (at - whole - (1 - change)) / change)))
  return { from, to, t, palette: mixPalette(themes[from], themes[to], t) }
}

// A theme number that follows the game's (its level, say) at `rate` themes a second, so each new
// one fades in rather than snapping. Straight back, though, for a new game.
export function approach(shown, target, dt, rate = 0.8) {
  if (target <= shown) return target
  return Math.min(target, shown + rate * dt)
}
