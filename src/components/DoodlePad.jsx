import { useEffect, useRef, useState } from 'react'
import { GRID, INKS, strokePath } from '../../api/_lib/doodle.js'

// Neon doodles on a little dark screen, for the guestbook. Strokes are kept as points on the
// GRID × GRID square (format in api/_lib/doodle.js) and drawn as SVG once they're saved.
const INK_NAMES = ['Green', 'Pink', 'Blue', 'Yellow', 'White']
const PAD = 400 // canvas pixels
const LINE = 5 // stroke width, in grid units
const MIN_STEP = 1.5 // grid units a pointer has to move before it adds a point

export function Doodle({ strokes, label }) {
  return (
    <svg className="doodle" viewBox={`0 0 ${GRID} ${GRID}`} role="img" aria-label={label}>
      {strokes.map((s, i) => (
        // color too, so the glow (currentColor in styles.css) matches the ink
        <path key={i} d={strokePath(s.points)} stroke={INKS[s.ink]} style={{ color: INKS[s.ink] }} />
      ))}
    </svg>
  )
}

export default function DoodlePad({ strokes, onChange, disabled }) {
  const canvas = useRef(null)
  const drawing = useRef(null) // the stroke under the pointer, while it's down
  const [ink, setInk] = useState(0)
  const [, redraw] = useState(0)

  useEffect(() => {
    const ctx = canvas.current.getContext('2d')
    ctx.clearRect(0, 0, PAD, PAD)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = (LINE * PAD) / GRID
    ctx.shadowBlur = 8
    for (const s of drawing.current ? [...strokes, drawing.current] : strokes) {
      ctx.strokeStyle = ctx.shadowColor = INKS[s.ink]
      ctx.stroke(new Path2D(strokePath(s.points.map((n) => (n * PAD) / GRID))))
    }
  })

  const at = (e) => {
    const box = canvas.current.getBoundingClientRect()
    const scale = (v, size) => Math.round(Math.min(Math.max(v / size, 0), 1) * GRID)
    return [scale(e.clientX - box.left, box.width), scale(e.clientY - box.top, box.height)]
  }
  function down(e) {
    if (disabled) return
    canvas.current.setPointerCapture(e.pointerId)
    drawing.current = { ink, points: at(e) }
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

  return (
    <div className="doodle-pad">
      <canvas
        ref={canvas}
        width={PAD}
        height={PAD}
        className="doodle-canvas"
        aria-label="Doodle pad"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <div className="doodle-tools">
        <div className="doodle-inks" role="radiogroup" aria-label="Colour">
          {INKS.map((colour, i) => (
            <button
              key={colour}
              type="button"
              role="radio"
              aria-checked={ink === i}
              aria-label={INK_NAMES[i]}
              className="doodle-ink"
              style={{ '--ink-colour': colour }}
              onClick={() => setInk(i)}
            />
          ))}
        </div>
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
