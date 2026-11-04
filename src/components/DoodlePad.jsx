import { useEffect, useRef, useState } from 'react'
import { GRID, INKS, INK_NAMES } from '../../api/_lib/doodle.js'
import { canvas2d, line, paint } from './pencil.js'

// Coloured-pencil doodles on a sheet of paper, for the guestbook: a pencil, a fill bucket and an
// eraser. A doodle is kept as its marks on the GRID × GRID square (format in api/_lib/doodle.js),
// and drawn by replaying them in order on a canvas (pencil.js), both on the pad and in the list.
// The drawing pad page (pages/DrawingPad.jsx) is the big version.
const SIZE = 400 // canvas pixels
const SCALE = SIZE / GRID
const MIN_STEP = 1.5 // grid units a pointer has to move before it adds a point
const TOOLS = [
  { id: 'pencil', name: 'Pencil' },
  { id: 'fill', name: 'Fill' },
  { id: 'erase', name: 'Eraser' },
]

export function Doodle({ strokes, label }) {
  const canvas = useRef(null)
  useEffect(() => {
    paint(canvas.current.getContext('2d'), strokes, SCALE)
  }, [strokes])
  return <canvas ref={canvas} className="doodle" width={SIZE} height={SIZE} role="img" aria-label={label} />
}

export const ICONS = {
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
    const picture = canvas2d(SIZE, SIZE)
    base.current = { picture, solid: paint(picture, strokes, SCALE) }
  }, [strokes])

  // Then each frame of a line in progress goes on top, without replaying everything
  useEffect(() => {
    const ctx = canvas.current.getContext('2d')
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.drawImage(base.current.picture.canvas, 0, 0)
    if (drawing.current) line(ctx, null, drawing.current, SCALE)
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
