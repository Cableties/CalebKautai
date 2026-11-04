import { useEffect, useRef, useState } from 'react'
import { ICONS } from '../components/DoodlePad.jsx'
import { canvas2d, hex, line, mark, paint, paintPaper } from '../components/pencil.js'
import {
  COLOURS,
  PAPERS,
  SCALE,
  SHEETS,
  SIZE_NAMES,
  TOOLS,
  add,
  clear,
  extendMark,
  fileName,
  history,
  idea,
  parseSaved,
  redo,
  sheetFor,
  sizeFor,
  startMark,
  undo,
} from '../lib/drawing.js'

// The drawing pad: the guestbook's coloured pencils on a big sheet of paper, with a marker, straight
// lines, a fill bucket, an eraser and a colour picker, any colour, four sizes, a few papers and sheet
// shapes, undo and redo, and saving it as a picture. The drawing's kept in this browser as you go.
// Rules and the format in lib/drawing.js; the pencils themselves in components/pencil.js.
const STORAGE_KEY = 'drawing-pad'
const CLEAR_MS = 3000 // how long "Really clear?" waits for the second tap

const MORE_ICONS = {
  marker: (
    <>
      <path d="M5 19l1.5-5L15 5.5l3.5 3.5L10 17.5z" />
      <path d="M13 7.5l3.5 3.5M4 21h8" />
    </>
  ),
  line: (
    <>
      <path d="M6 18L18 6" />
      <circle cx="5" cy="19" r="1.6" />
      <circle cx="19" cy="5" r="1.6" />
    </>
  ),
  pick: (
    <>
      <path d="M14.5 4.5a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L17 12l-5-5z" />
      <path d="M12.5 7.5L5 15v4h4l7.5-7.5" />
    </>
  ),
}
const iconFor = (id) => MORE_ICONS[id] ?? ICONS[id]

export default function DrawingPad() {
  const [sheetId, setSheetId] = useState(SHEETS[0].id)
  const [paper, setPaper] = useState('sketch')
  const [h, setH] = useState(history)
  const [tool, setTool] = useState('pencil')
  const [colour, setColour] = useState(COLOURS[4].colour)
  const [size, setSize] = useState(1)
  const [bare, setBare] = useState(false) // save it without the paper (see-through)
  const [prompt, setPrompt] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [status, setStatus] = useState('')
  const [can, setCan] = useState({ copy: false, share: false })
  const [, redraw] = useState(0)

  const sheet = sheetFor(sheetId)
  const [W, H] = [sheet.width * SCALE, sheet.height * SCALE]
  const paperCanvas = useRef(null)
  const canvas = useRef(null)
  const base = useRef(null) // the marks drawn so far, kept to add to: { picture, solid, marks, sheet }
  const drawing = useRef(null) // the line under the pointer, while it's down
  const hover = useRef(null) // where a mouse is over the paper, for the size ring
  const loaded = useRef(false)
  const lastTool = useRef('pencil') // the picker goes back to this once it's picked

  // The drawing from last time, and what this browser can do with a picture
  useEffect(() => {
    try {
      const saved = parseSaved(JSON.parse(localStorage.getItem(STORAGE_KEY)))
      if (saved) {
        setSheetId(saved.sheet)
        setPaper(saved.paper)
        setH(history(saved.marks))
      }
    } catch {
      // Nothing saved, or storage blocked: a fresh sheet
    }
    loaded.current = true
    const test = new File([''], 'test.png', { type: 'image/png' })
    setCan({
      copy: typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write,
      share: !!navigator.canShare?.({ files: [test] }),
    })
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheet: sheetId, paper, marks: h.marks }))
    } catch {
      // Full or blocked: it just won't be here next time
    }
  }, [sheetId, paper, h.marks])

  useEffect(() => {
    paintPaper(paperCanvas.current.getContext('2d'), paper, SCALE)
  }, [paper, sheetId])

  // The marks so far: a new one goes on top of what's there; anything else (undo, a new sheet) draws
  // it all again
  useEffect(() => {
    const b = base.current
    const { marks } = h
    if (b && b.sheet === sheetId && marks.length === b.marks.length + 1 && marks.at(-2) === b.marks.at(-1)) {
      mark(b.picture, b.solid, marks.at(-1), SCALE)
    } else {
      const picture = canvas2d(W, H)
      base.current = { picture, solid: paint(picture, marks, SCALE), sheet: sheetId }
    }
    base.current.marks = marks
    redraw((n) => n + 1)
  }, [h, sheetId, W, H])

  // Each frame: the marks, then a line in progress on top, and a ring showing the size under a mouse
  useEffect(() => {
    if (!base.current) return
    const ctx = canvas.current.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(base.current.picture.canvas, 0, 0)
    if (drawing.current) line(ctx, null, drawing.current, SCALE)
    if (hover.current && !['fill', 'pick'].includes(tool)) {
      const [x, y] = hover.current
      ctx.beginPath()
      ctx.arc(x * SCALE, y * SCALE, Math.max(2, (sizeFor(tool, size) * SCALE) / 2), 0, Math.PI * 2)
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgb(46 42 69 / 0.55)'
      ctx.stroke()
    }
  })

  // The clear button waits a moment for "Really clear?", then gives up
  useEffect(() => {
    if (!clearing) return
    const t = setTimeout(() => setClearing(false), CLEAR_MS)
    return () => clearTimeout(t)
  }, [clearing])

  function chooseTool(id) {
    if (id === 'pick' && tool !== 'pick') lastTool.current = tool
    setTool(id)
  }
  function chooseColour(c) {
    setColour(c)
    // Picking a colour means drawing with it, so it puts the eraser (or the picker) down
    if (tool === 'erase' || tool === 'pick') setTool(lastTool.current === 'erase' ? 'pencil' : lastTool.current)
  }

  // Where the pointer is, in units, on the paper
  const at = (e) => {
    const box = canvas.current.getBoundingClientRect()
    const unit = (v, length, units) => Math.round(Math.min(Math.max(v / length, 0), 1) * units * 2) / 2
    return [unit(e.clientX - box.left, box.width, sheet.width), unit(e.clientY - box.top, box.height, sheet.height)]
  }
  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault() // no text selection (and the page scrolling along with it) while drawing
    const point = at(e)
    if (tool === 'pick') {
      const [x, y] = [Math.min(Math.round(point[0] * SCALE), W - 1), Math.min(Math.round(point[1] * SCALE), H - 1)]
      const [r, g, b] = base.current.solid.getImageData(x, y, 1, 1).data
      chooseColour(hex(r, g, b))
      return
    }
    if (tool === 'fill') {
      setH((h) => add(h, startMark('fill', { colour, size }, point)))
      return
    }
    canvas.current.setPointerCapture(e.pointerId)
    drawing.current = startMark(tool, { colour, size }, point)
    redraw((n) => n + 1)
  }
  function move(e) {
    const point = at(e)
    hover.current = e.pointerType === 'mouse' ? point : null
    if (drawing.current) extendMark(tool, drawing.current, point)
    redraw((n) => n + 1)
  }
  function up() {
    const m = drawing.current
    if (!m) return
    drawing.current = null
    setH((h) => add(h, m))
  }
  function leave() {
    hover.current = null
    redraw((n) => n + 1)
  }

  function wipe() {
    if (!clearing) return setClearing(true)
    setClearing(false)
    setH(clear)
  }

  // Keys: Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) to undo and redo, a letter for each tool, [ and ] for size
  useEffect(() => {
    function key(e) {
      if (e.target.closest?.('input, textarea, select')) return
      const k = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z') setH(e.shiftKey ? redo : undo)
        else if (k === 'y') setH(redo)
        else return
      } else if (e.altKey) {
        return
      } else if (k === '[' || k === ']') {
        setSize((s) => Math.min(SIZE_NAMES.length - 1, Math.max(0, s + (k === ']' ? 1 : -1))))
      } else {
        const t = TOOLS.find((t) => t.key === k)
        if (!t) return
        setTool((now) => {
          if (t.id === 'pick' && now !== 'pick') lastTool.current = now
          return t.id
        })
      }
      e.preventDefault()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [])

  // The drawing as a picture: on its paper, or on nothing
  function picture() {
    const ctx = canvas2d(W, H)
    if (!bare) paintPaper(ctx, paper, SCALE)
    ctx.drawImage(base.current.picture.canvas, 0, 0)
    return new Promise((resolve) => ctx.canvas.toBlob(resolve, 'image/png'))
  }
  async function download() {
    const blob = await picture()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName()
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setStatus('Saved to your downloads.')
  }
  async function copy() {
    try {
      // Safari wants the picture as a promise, made inside the tap
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': picture() })])
      setStatus('Copied. Paste it anywhere.')
    } catch {
      setStatus("That didn't copy. Try saving it instead.")
    }
  }
  async function share() {
    try {
      const blob = await picture()
      await navigator.share({ files: [new File([blob], fileName(), { type: 'image/png' })], title: 'My drawing' })
      setStatus('')
    } catch (err) {
      if (err?.name !== 'AbortError') setStatus("That didn't share. Try saving it instead.")
    }
  }

  const empty = !h.marks.length
  return (
    <article className="page drawpad-page">
      <h1 className="page-title">Drawing pad</h1>
      <p className="lede">
        Coloured pencils, a marker and a big sheet of paper. Draw whatever you like, then save it as a picture. It's kept
        in this browser as you go, so you can come back to it.
      </p>

      <div className="drawpad-studio">
        <div className="drawpad-desk">
          <div className="drawpad-sheet" style={{ aspectRatio: `${sheet.width} / ${sheet.height}`, '--ratio': sheet.width / sheet.height }}>
            <canvas ref={paperCanvas} width={W} height={H} className="drawpad-paper" aria-hidden="true" />
            <canvas
              ref={canvas}
              width={W}
              height={H}
              className="drawpad-canvas"
              data-tool={tool}
              role="img"
              aria-label={`Drawing pad${empty ? ', blank' : `, ${h.marks.length} marks`}`}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onPointerLeave={leave}
            />
          </div>
          <p className="drawpad-idea">
            <button type="button" className="button button-ghost" onClick={() => setPrompt((p) => idea(Math.random, p))}>
              {prompt ? 'Another idea' : 'Need an idea?'}
            </button>
            <span aria-live="polite">{prompt}</span>
          </p>
        </div>

        <div className="drawpad-panel">
          <div className="drawpad-group">
            <h2 id="drawpad-tools">Tools</h2>
            <div className="drawpad-tools" role="radiogroup" aria-labelledby="drawpad-tools">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={tool === t.id}
                  className="doodle-tool"
                  title={`${t.name} (${t.key.toUpperCase()})`}
                  onClick={() => chooseTool(t.id)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {iconFor(t.id)}
                  </svg>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="drawpad-group">
            <h2 id="drawpad-size">Size</h2>
            <div className="drawpad-sizes" role="radiogroup" aria-labelledby="drawpad-size">
              {SIZE_NAMES.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={size === i}
                  aria-label={name}
                  title={`${name} ([ and ] to change)`}
                  className="drawpad-size"
                  onClick={() => setSize(i)}
                >
                  <span style={{ width: 4 + i * 5, height: 4 + i * 5 }} />
                </button>
              ))}
            </div>
          </div>

          <div className="drawpad-group">
            <h2 id="drawpad-colours">Colour</h2>
            <div className="drawpad-colours" role="radiogroup" aria-labelledby="drawpad-colours">
              {COLOURS.map((c) => (
                <button
                  key={c.colour}
                  type="button"
                  role="radio"
                  aria-checked={colour === c.colour}
                  aria-label={c.name}
                  title={c.name}
                  className="drawpad-swatch"
                  style={{ '--swatch': c.colour }}
                  onClick={() => chooseColour(c.colour)}
                />
              ))}
              {/* Any other colour: the last swatch is the browser's colour picker */}
              <label
                className="drawpad-swatch drawpad-custom"
                title="Any colour"
                style={{ '--swatch': colour }}
                data-checked={!COLOURS.some((c) => c.colour === colour)}
              >
                <input type="color" value={colour} onChange={(e) => chooseColour(e.target.value)} aria-label="Any colour" />
              </label>
            </div>
          </div>

          <div className="drawpad-group drawpad-history">
            <button type="button" onClick={() => setH(undo)} disabled={!h.past.length} title="Undo (Ctrl+Z)">
              Undo
            </button>
            <button type="button" onClick={() => setH(redo)} disabled={!h.future.length} title="Redo (Ctrl+Shift+Z)">
              Redo
            </button>
            <button type="button" onClick={wipe} disabled={empty} className={clearing ? 'drawpad-really' : undefined}>
              {clearing ? 'Really clear?' : 'Clear'}
            </button>
          </div>

          <div className="drawpad-group drawpad-choices">
            <label>
              <span>Paper</span>
              <select aria-label="Paper" value={paper} onChange={(e) => setPaper(e.target.value)}>
                {PAPERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Shape</span>
              <select aria-label="Shape" value={sheetId} onChange={(e) => setSheetId(e.target.value)}>
                {SHEETS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="drawpad-group">
            <h2>Save it</h2>
            <div className="drawpad-export">
              <button type="button" className="button" onClick={download} disabled={empty}>
                Download PNG
              </button>
              {can.copy && (
                <button type="button" className="button button-ghost" onClick={copy} disabled={empty}>
                  Copy
                </button>
              )}
              {can.share && (
                <button type="button" className="button button-ghost" onClick={share} disabled={empty}>
                  Share
                </button>
              )}
            </div>
            <label className="drawpad-check">
              <input type="checkbox" checked={bare} onChange={(e) => setBare(e.target.checked)} />
              Leave the paper out (see-through background)
            </label>
            <p className="drawpad-status" role="status">
              {status}
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}
