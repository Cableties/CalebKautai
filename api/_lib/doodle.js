// Doodles for the guestbook (reviews), shared by the API and the page.
// They're stored as strokes, not images: each stroke is an ink (an index into INKS) and a flat list
// of x, y points on a GRID × GRID square. Small, and safe to draw, since the page only ever turns
// numbers into an SVG path in one of its own colours.
export const GRID = 200
export const INKS = ['#7dffb2', '#f7b6d2', '#7fe7ff', '#ffe27a', '#ffffff']
export const DOODLE = { strokes: 80, points: 2500 }

// Returns the strokes, [] for no doodle, or null if it isn't a valid doodle
export function parseDoodle(doodle) {
  if (doodle == null) return []
  if (!Array.isArray(doodle) || doodle.length > DOODLE.strokes) return null
  let total = 0
  const strokes = []
  for (const stroke of doodle) {
    const { ink, points } = stroke ?? {}
    if (!Number.isInteger(ink) || ink < 0 || ink >= INKS.length) return null
    if (!Array.isArray(points) || points.length < 2 || points.length % 2) return null
    total += points.length / 2
    if (total > DOODLE.points) return null
    if (!points.every((n) => Number.isInteger(n) && n >= 0 && n <= GRID)) return null
    strokes.push({ ink, points })
  }
  return strokes
}

// The SVG path for one stroke. A single point gets a tiny line so its round cap shows as a dot.
export function strokePath(points) {
  let d = `M${points[0]} ${points[1]}`
  for (let i = 2; i < points.length; i += 2) d += `L${points[i]} ${points[i + 1]}`
  return points.length === 2 ? d + 'l0.01 0' : d
}
