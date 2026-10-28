import { useEffect, useRef, useState } from 'react'
import { GRID, INKS, INK_NAMES, strokePath } from '../../api/_lib/doodle.js'

// Coloured-pencil doodles on a sheet of paper, for the guestbook: a pencil, a fill bucket and an
// eraser. A doodle is kept as its marks on the GRID × GRID square (format in api/_lib/doodle.js),
// and drawn by replaying them in order on a canvas, both on the pad and in the list.
const SIZE = 400 // canvas pixels
const SCALE = SIZE / GRID
const LINE = 3 // pencil width, in grid units
const ERASER = 12
const MIN_STEP = 1.5 // grid units a pointer has to move before it adds a point
// How close a pixel's colour has to be to the one tapped for the bucket to spread into it (out of
// 255 per channel): loose enough to fill right up to a line's soft edge
const FILL_TOLERANCE = 60
// How far a fill reaches in under the lines around it, so no paper shows between them (px)
const FILL_BLEED = 2
const TOOLS = [
  { id: 'pencil', name: 'Pencil' },
  { id: 'fill', name: 'Fill' },
  { id: 'erase', name: 'Eraser' },
]

// The same speckle every time, so a doodle looks the same wherever it's shown
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Pencil grain: the ink's colour with speckled see-through bits, like graphite catching on paper.
// Fills are a little softer, like shading in.
const grains = new Map()
function grain(ctx, ink, soft) {
  const key = `${ink}${soft ? 's' : ''}`
  if (!grains.has(key)) {
    const tile = document.createElement('canvas')
    tile.width = tile.height = 64
    const g = tile.getContext('2d')
    g.fillStyle = INKS[ink]
    g.fillRect(0, 0, 64, 64)
    const image = g.getImageData(0, 0, 64, 64)
    const random = seeded(ink + 1)
    const [low, high] = soft ? [0.5, 0.85] : [0.45, 1]
    for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255 * (low + (high - low) * random() ** 0.7)
    g.putImageData(image, 0, 0)
    grains.set(key, tile)
  }
  return ctx.createPattern(grains.get(key), 'repeat')
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

function canvas2d(width = SIZE, height = SIZE) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c.getContext('2d', { willReadFrequently: true })
}

// The doodle's layers: `ctx` is what's seen (transparent where it's bare paper, which is the page
// behind it), and `solid` is a flat-colour copy on white that the fill bucket reads, so it spreads
// by colour and stops at lines, rather than leaking through the pencil grain.
function fresh(ctx) {
  ctx.clearRect(0, 0, SIZE, SIZE)
  const solid = canvas2d()
  solid.fillStyle = '#fff'
  solid.fillRect(0, 0, SIZE, SIZE)
  return solid
}

function line(ctx, solid, { tool, ink, points }) {
  const path = new Path2D(strokePath(points.map((n) => n * SCALE)))
  const erase = tool === 'erase'
  for (const c of [ctx, solid]) {
    if (!c) continue
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.lineWidth = (erase ? ERASER : LINE) * SCALE
  }
  if (solid) {
    solid.strokeStyle = erase ? '#fff' : INKS[ink]
    solid.stroke(path)
  }
  if (erase) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = '#000'
    ctx.stroke(path)
    ctx.globalCompositeOperation = 'source-over'
    return
  }
  ctx.strokeStyle = grain(ctx, ink)
  ctx.stroke(path)
  // A firmer core down the middle, like pressing a little harder
  ctx.globalAlpha = 0.35
  ctx.lineWidth = LINE * SCALE * 0.45
  ctx.strokeStyle = INKS[ink]
  ctx.stroke(path)
  ctx.globalAlpha = 1
}

// The fill bucket: everything joined to the tapped point in about the same colour
function fill(ctx, solid, { ink, points }) {
  const [x, y] = points.map((n) => Math.min(SIZE - 1, Math.round(n * SCALE)))
  const image = solid.getImageData(0, 0, SIZE, SIZE)
  const data = image.data
  const start = (y * SIZE + x) * 4
  const [r, g, b] = [data[start], data[start + 1], data[start + 2]]
  const near = (p) =>
    Math.max(Math.abs(data[p * 4] - r), Math.abs(data[p * 4 + 1] - g), Math.abs(data[p * 4 + 2] - b)) <= FILL_TOLERANCE
  const region = new Uint8Array(SIZE * SIZE)
  const stack = [y * SIZE + x]
  while (stack.length) {
    const p = stack.pop()
    if (region[p] || !near(p)) continue
    region[p] = 1
    const px = p % SIZE
    if (px > 0) stack.push(p - 1)
    if (px < SIZE - 1) stack.push(p + 1)
    if (p >= SIZE) stack.push(p - SIZE)
    if (p < SIZE * (SIZE - 1)) stack.push(p + SIZE)
  }

  // The flat copy takes the new colour exactly where it spread
  const [nr, ng, nb] = rgb(INKS[ink])
  for (let p = 0; p < region.length; p++) {
    if (!region[p]) continue
    data[p * 4] = nr
    data[p * 4 + 1] = ng
    data[p * 4 + 2] = nb
  }
  solid.putImageData(image, 0, 0)

  // On the page: take out whatever was there (an earlier fill), then shade in underneath the lines,
  // reaching a little way under them so it meets them without a gap
  const mask = canvas2d()
  const shape = mask.createImageData(SIZE, SIZE)
  for (let p = 0; p < region.length; p++) if (region[p]) shape.data[p * 4 + 3] = 255
  mask.putImageData(shape, 0, 0)
  ctx.globalCompositeOperation = 'destination-out'
  ctx.drawImage(mask.canvas, 0, 0)
  for (let p = 0; p < region.length; p++) {
    if (!region[p]) continue
    const px = p % SIZE
    const py = (p - px) / SIZE
    for (let dy = -FILL_BLEED; dy <= FILL_BLEED; dy++) {
      for (let dx = -FILL_BLEED; dx <= FILL_BLEED; dx++) {
        const qx = px + dx
        const qy = py + dy
        if (qx >= 0 && qx < SIZE && qy >= 0 && qy < SIZE) shape.data[(qy * SIZE + qx) * 4 + 3] = 255
      }
    }
  }
  mask.putImageData(shape, 0, 0)
  mask.globalCompositeOperation = 'source-in'
  mask.fillStyle = grain(mask, ink, true)
  mask.fillRect(0, 0, SIZE, SIZE)
  ctx.globalCompositeOperation = 'destination-over'
  ctx.drawImage(mask.canvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

function mark(ctx, solid, m) {
  if (m.tool === 'fill') fill(ctx, solid, m)
  else line(ctx, solid, m)
}

// Draw a whole doodle; returns its flat copy, for adding more to it
function paint(ctx, marks) {
  const solid = fresh(ctx)
  for (const m of marks) mark(ctx, solid, m)
  return solid
}

export function Doodle({ strokes, label }) {
  const canvas = useRef(null)
  useEffect(() => {
    paint(canvas.current.getContext('2d'), strokes)
  }, [strokes])
  return <canvas ref={canvas} className="doodle" width={SIZE} height={SIZE} role="img" aria-label={label} />
}

const ICONS = {
  pencil: <path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4" />,
  fill: (
    <>
      <path d="M5 11l7-7 7 7-7 7z" />
      <path d="M19 11c1.5 2.5 2 4 1 5s-2.5-.5-1-5" />
    </>
  ),
  erase: (
    <>
      <path d="M8 20l-5-5L14 4l7 7-9 9z" />
      <path d="M9 9l6 6M8 20h12" />
    </>
  ),
}

export default function DoodlePad({ strokes, onChange, disabled }) {
  const canvas = useRef(null)
  const base = useRef(null) // the saved marks, drawn once: { picture, solid }
  const drawing = useRef(null) // the line under the pointer, while it's down
  const [ink, setInk] = useState(4)
  const [tool, setTool] = useState('pencil')
  const [, redraw] = useState(0)

  // Redraw the saved marks whenever they change (a line, a fill, undo, clear)
  useEffect(() => {
    const picture = canvas2d()
    base.current = { picture, solid: paint(picture, strokes) }
  }, [strokes])

  // Then each frame of a line in progress goes on top, without replaying everything
  useEffect(() => {
    const ctx = canvas.current.getContext('2d')
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.drawImage(base.current.picture.canvas, 0, 0)
    if (drawing.current) line(ctx, null, drawing.current)
  })

  const at = (e) => {
    const box = canvas.current.getBoundingClientRect()
    const scale = (v, size) => Math.round(Math.min(Math.max(v / size, 0), 1) * GRID)
    return [scale(e.clientX - box.left, box.width), scale(e.clientY - box.top, box.height)]
  }
  function down(e) {
    if (disabled) return
    e.preventDefault() // no text selection (and the page scrolling along with it) while drawing
    if (tool === 'fill') {
      onChange([...strokes, { tool: 'fill', ink, points: at(e) }])
      return
    }
    canvas.current.setPointerCapture(e.pointerId)
    drawing.current = tool === 'erase' ? { tool: 'erase', points: at(e) } : { ink, points: at(e) }
    redraw((n) => n + 1)
  }
  function move(e) {
    const s = drawing.current
    if (!s) return
    const [x, y] = at(e)
    const [px, py] = s.points.slice(-2)
    if (Math.hypot(x - px, y - py) < MIN_STEP) return
    s.points.push(x, y)
    redraw((n) => n + 1)
  }
  function up() {
    if (!drawing.current) return
    onChange([...strokes, drawing.current])
    drawing.current = null
  }
  function pickInk(i) {
    setInk(i)
    // Picking a colour means drawing with it, so it puts the eraser down
    if (tool === 'erase') setTool('pencil')
  }

  return (
    <div className="doodle-pad">
      <div className="doodle-paper">
        <canvas
          ref={canvas}
          width={SIZE}
          height={SIZE}
          className="doodle-canvas"
          data-tool={tool}
          aria-label="Doodle pad"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
      <div className="doodle-tools" role="radiogroup" aria-label="Tool">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={tool === t.id}
            className="doodle-tool"
            onClick={() => setTool(t.id)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {ICONS[t.id]}
            </svg>
            {t.name}
          </button>
        ))}
      </div>
      {/* The pencil tin: the chosen pencil sticks up out of it */}
      <div className="doodle-pencils" role="radiogroup" aria-label="Colour">
        {INKS.map((colour, i) => (
          <button
            key={colour}
            type="button"
            role="radio"
            aria-checked={ink === i}
            aria-label={INK_NAMES[i]}
            className="doodle-pencil"
            onClick={() => pickInk(i)}
          >
            <svg viewBox="0 0 20 64" aria-hidden="true">
              <polygon points="10,0 3,20 17,20" fill="#efcf9f" />
              <polygon points="10,0 7.2,8 12.8,8" fill={colour} />
              <rect x="3" y="20" width="14" height="44" fill={colour} />
              <rect x="8" y="20" width="4" height="44" fill="#fff" opacity="0.2" />
              <rect x="3" y="20" width="2" height="44" fill="#000" opacity="0.12" />
            </svg>
          </button>
        ))}
      </div>
      <div className="doodle-actions">
        <button type="button" onClick={() => onChange(strokes.slice(0, -1))} disabled={!strokes.length || disabled}>
          Undo
        </button>
        <button type="button" onClick={() => onChange([])} disabled={!strokes.length || disabled}>
          Clear
        </button>
      </div>
    </div>
  )
}
