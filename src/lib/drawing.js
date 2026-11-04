import { INKS, INK_NAMES } from '../../api/_lib/doodle.js'

// The rules of the drawing pad (pages/DrawingPad.jsx), kept free of the DOM so they can be unit
// tested. A drawing is a list of marks in the sheet's own units (format in components/pencil.js).

// Sheet shapes, in units. The canvas has SCALE pixels per unit, so a square sheet is 1000px.
export const SCALE = 2
export const SHEETS = [
  { id: 'square', name: 'Square', width: 500, height: 500 },
  { id: 'landscape', name: 'Landscape', width: 600, height: 420 },
  { id: 'portrait', name: 'Portrait', width: 420, height: 600 },
]
export const sheetFor = (id) => SHEETS.find((s) => s.id === id) ?? SHEETS[0]

export const PAPERS = [
  { id: 'sketch', name: 'Sketch' },
  { id: 'white', name: 'White' },
  { id: 'lined', name: 'Lined' },
  { id: 'grid', name: 'Grid' },
  { id: 'kraft', name: 'Brown' },
]

export const TOOLS = [
  { id: 'pencil', name: 'Pencil', key: 'p' },
  { id: 'marker', name: 'Marker', key: 'm' },
  { id: 'line', name: 'Straight line', key: 'l' },
  { id: 'fill', name: 'Fill', key: 'f' },
  { id: 'erase', name: 'Eraser', key: 'e' },
  { id: 'pick', name: 'Colour picker', key: 'i' },
]

// Widths for each tool, in units, smallest first. The straight line draws in pencil.
export const SIZE_NAMES = ['Fine', 'Medium', 'Thick', 'Chunky']
const SIZES = { pencil: [1.5, 3, 6, 12], marker: [4, 8, 14, 24], erase: [6, 12, 24, 48] }
export const sizeFor = (tool, size) => (SIZES[tool] ?? SIZES.pencil)[size]

// The guestbook's coloured pencils, then a few more
export const COLOURS = [
  ...INKS.map((colour, i) => ({ colour, name: INK_NAMES[i] })),
  { colour: '#ef8a3a', name: 'Orange' },
  { colour: '#f4b8c8', name: 'Light pink' },
  { colour: '#8ec9e8', name: 'Sky' },
  { colour: '#9dcf7e', name: 'Lime' },
  { colour: '#f5e07a', name: 'Lemon' },
  { colour: '#e2b48d', name: 'Peach' },
  { colour: '#ffffff', name: 'White' },
  { colour: '#151418', name: 'Black' },
]

// What it does with the pointer: a pencil or marker line follows it, a straight line goes from where
// it went down to where it is, and the rest are a single tap
export function startMark(tool, { colour, size }, at) {
  if (tool === 'fill') return { tool, colour, points: at }
  if (tool === 'erase') return { tool, size: sizeFor(tool, size), points: at }
  const mark = { colour, size: sizeFor(tool, size), points: at }
  return tool === 'marker' ? { tool, ...mark } : mark
}
// `points` gets added to as the pointer moves (or, for a straight line, its end moved)
export function extendMark(tool, mark, [x, y], minStep = 1) {
  const [px, py] = mark.points.slice(-2)
  if (Math.hypot(x - px, y - py) < minStep) return false
  if (tool === 'line') mark.points = [mark.points[0], mark.points[1], x, y]
  else mark.points.push(x, y)
  return true
}

// Undo and redo: the marks now, the drawing as it was before each step (`past`, at most UNDOS of
// them), and the steps undone (`future`), till something new is drawn. Each is the list of marks
// then; they share the marks themselves, so keeping them is cheap. Clearing is a step like any other.
export const UNDOS = 200
export const history = (marks = []) => ({ past: [], marks, future: [] })
const change = (h, marks) => ({ past: [...h.past, h.marks].slice(-UNDOS), marks, future: [] })
export const add = (h, mark) => change(h, [...h.marks, mark])
export const clear = (h) => (h.marks.length ? change(h, []) : h)
export const undo = (h) => (h.past.length ? { past: h.past.slice(0, -1), marks: h.past.at(-1), future: [...h.future, h.marks] } : h)
export const redo = (h) => (h.future.length ? { past: [...h.past, h.marks], marks: h.future.at(-1), future: h.future.slice(0, -1) } : h)

// What's kept in this browser between visits. Returns a clean copy, or null if it's not a drawing.
export function parseSaved(saved) {
  if (!saved || typeof saved !== 'object' || !Array.isArray(saved.marks)) return null
  const sheet = sheetFor(saved.sheet)
  const paper = PAPERS.some((p) => p.id === saved.paper) ? saved.paper : PAPERS[0].id
  const ok = (m) =>
    m &&
    Array.isArray(m.points) &&
    m.points.length >= 2 &&
    m.points.length % 2 === 0 &&
    m.points.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    (m.tool === 'erase' || /^#[0-9a-f]{6}$/i.test(m.colour ?? '') || Number.isInteger(m.ink))
  return { sheet: sheet.id, paper, marks: saved.marks.filter(ok) }
}

// A file name for the download, with the date it was made
export const fileName = (date = new Date()) =>
  `drawing-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.png`

// For when the paper's blank and so's your mind
export const IDEAS = [
  'Me, but as a pirate',
  'My head on a pizza',
  'An alien who wants to be my friend',
  'The best sandwich you can imagine',
  'A cat running for parliament',
  "What's in my fridge (guess)",
  'Bendigo, from memory',
  'A dinosaur doing their taxes',
  'Your dream house, with a slide',
  'A very dramatic potato',
  'Me riding a giant chicken',
  'A snail in a hurry',
  'The last thing that made you laugh',
  'A robot trying to dance',
  'Your favourite animal, wearing a hat',
  'A tiny dragon guarding a biscuit',
]
export function idea(random = Math.random, not) {
  const choices = IDEAS.filter((i) => i !== not)
  return choices[Math.floor(random() * choices.length)]
}
