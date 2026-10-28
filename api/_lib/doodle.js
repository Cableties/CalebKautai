// Doodles for the guestbook (reviews), shared by the API and the page.
// They're stored as a list of marks, not images, each on a GRID × GRID square:
// - a pencil line: { ink, points }, ink an index into INKS and points a flat list of x, y
// - the eraser: { tool: 'erase', points }
// - the fill bucket: { tool: 'fill', ink, points: [x, y] }, filling the area around that point
// Small, and safe to draw, since the page only ever turns numbers into marks in its own colours.
// The page replays them in order (components/DoodlePad.jsx).
export const GRID = 200
// Coloured pencils. The first five keep their places from the old neon inks (green, pink, blue,
// yellow, white), so old doodles still draw: white was ink on a dark screen, and is graphite now.
export const INKS = ['#3f9a5c', '#d9568f', '#3b78c4', '#e3a72f', '#3b3a40', '#d8453a', '#8a5a35', '#7d55c7']
export const INK_NAMES = ['Green', 'Pink', 'Blue', 'Yellow', 'Graphite', 'Red', 'Brown', 'Purple']
export const DOODLE = { strokes: 80, points: 2500 }
const TOOLS = ['erase', 'fill']

// Returns the marks, [] for no doodle, or null if it isn't a valid doodle
export function parseDoodle(doodle) {
  if (doodle == null) return []
  if (!Array.isArray(doodle) || doodle.length > DOODLE.strokes) return null
  let total = 0
  const strokes = []
  for (const stroke of doodle) {
    const { tool, ink, points } = stroke ?? {}
    if (tool !== undefined && !TOOLS.includes(tool)) return null
    if (tool !== 'erase' && (!Number.isInteger(ink) || ink < 0 || ink >= INKS.length)) return null
    if (!Array.isArray(points) || points.length < 2 || points.length % 2) return null
    if (tool === 'fill' && points.length !== 2) return null
    total += points.length / 2
    if (total > DOODLE.points) return null
    if (!points.every((n) => Number.isInteger(n) && n >= 0 && n <= GRID)) return null
    strokes.push(tool === 'erase' ? { tool, points } : tool ? { tool, ink, points } : { ink, points })
  }
  return strokes
}

// The SVG path for one stroke. A single point gets a tiny line so its round cap shows as a dot.
export function strokePath(points) {
  let d = `M${points[0]} ${points[1]}`
  for (let i = 2; i < points.length; i += 2) d += `L${points[i]} ${points[i + 1]}`
  return points.length === 2 ? d + 'l0.01 0' : d
}
