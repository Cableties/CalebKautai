import { INKS } from '../../api/_lib/doodle.js'

// Coloured pencils on a canvas: the drawing code shared by the guestbook's doodle pad
// (DoodlePad.jsx) and the drawing pad page (pages/DrawingPad.jsx). A drawing is a list of marks,
// replayed in order. Points are in the drawing's own units; `scale` is canvas pixels per unit.
// - a pencil line: { ink, points } (or `colour`, any hex, in place of `ink`; `size`, in units)
// - a marker line: { tool: 'marker', colour, size, points }: flat, bold colour, no grain
// - the eraser: { tool: 'erase', points, size }
// - the fill bucket: { tool: 'fill', ink or colour, points: [x, y] }
export const LINE = 3 // pencil width, in units, unless a mark says
export const ERASER = 12
// How close a pixel's colour has to be to the one tapped for the bucket to spread into it (out of
// 255 per channel): loose enough to fill right up to a line's soft edge
const FILL_TOLERANCE = 60
// How far a fill reaches in under the lines around it, so no paper shows between them (px)
const FILL_BLEED = 2

export const colourOf = (m) => m.colour ?? INKS[m.ink]

// The same speckle every time, so a drawing looks the same wherever it's shown
export function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Pencil grain: the colour with speckled see-through bits, like graphite catching on paper.
// Fills are a little softer, like shading in. (The pencils keep the speckle they've always had.)
const grains = new Map()
function grain(ctx, colour, soft) {
  const key = `${colour}${soft ? 's' : ''}`
  if (!grains.has(key)) {
    const tile = document.createElement('canvas')
    tile.width = tile.height = 64
    const g = tile.getContext('2d')
    g.fillStyle = colour
    g.fillRect(0, 0, 64, 64)
    const image = g.getImageData(0, 0, 64, 64)
    const ink = INKS.indexOf(colour)
    const random = seeded(ink >= 0 ? ink + 1 : parseInt(colour.slice(1), 16))
    const [low, high] = soft ? [0.5, 0.85] : [0.45, 1]
    for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255 * (low + (high - low) * random() ** 0.7)
    g.putImageData(image, 0, 0)
    grains.set(key, tile)
  }
  return ctx.createPattern(grains.get(key), 'repeat')
}

export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
export const hex = (r, g, b) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')

export function canvas2d(width, height) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c.getContext('2d', { willReadFrequently: true })
}

// A smooth path through the points: curves between the midpoints, so a quick scribble isn't all
// corners. A single point gets a tiny line so its round cap shows as a dot.
export function smoothPath(points, scale) {
  const p = points.map((n) => n * scale)
  if (p.length === 2) return new Path2D(`M${p[0]} ${p[1]}l0.01 0`)
  let d = `M${p[0]} ${p[1]}`
  for (let i = 2; i < p.length - 2; i += 2) d += `Q${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`
  return new Path2D(`${d}L${p.at(-2)} ${p.at(-1)}`)
}

// The drawing's layers: `ctx` is what's seen (transparent where it's bare paper, which shows
// through from behind), and `solid` is a flat-colour copy on white that the fill bucket reads, so it
// spreads by colour and stops at lines, rather than leaking through the pencil grain.
function fresh(ctx) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  const solid = canvas2d(width, height)
  solid.fillStyle = '#fff'
  solid.fillRect(0, 0, width, height)
  return solid
}

export function line(ctx, solid, m, scale) {
  const path = smoothPath(m.points, scale)
  const erase = m.tool === 'erase'
  const width = (m.size ?? (erase ? ERASER : LINE)) * scale
  const colour = erase ? '#fff' : colourOf(m)
  for (const c of [ctx, solid]) {
    if (!c) continue
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.lineWidth = width
  }
  if (solid) {
    solid.strokeStyle = colour
    solid.stroke(path)
  }
  if (erase) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = '#000'
    ctx.stroke(path)
    ctx.globalCompositeOperation = 'source-over'
    return
  }
  if (m.tool === 'marker') {
    ctx.strokeStyle = colour
    ctx.globalAlpha = 0.92
    ctx.stroke(path)
    ctx.globalAlpha = 1
    return
  }
  ctx.strokeStyle = grain(ctx, colour)
  ctx.stroke(path)
  // A firmer core down the middle, like pressing a little harder
  ctx.globalAlpha = 0.35
  ctx.lineWidth = width * 0.45
  ctx.strokeStyle = colour
  ctx.stroke(path)
  ctx.globalAlpha = 1
}

// The fill bucket: everything joined to the tapped point in about the same colour
function fill(ctx, solid, m, scale) {
  const { width: W, height: H } = ctx.canvas
  const x = Math.min(W - 1, Math.round(m.points[0] * scale))
  const y = Math.min(H - 1, Math.round(m.points[1] * scale))
  const image = solid.getImageData(0, 0, W, H)
  const data = image.data
  const start = (y * W + x) * 4
  const [r, g, b] = [data[start], data[start + 1], data[start + 2]]
  const near = (p) =>
    Math.max(Math.abs(data[p * 4] - r), Math.abs(data[p * 4 + 1] - g), Math.abs(data[p * 4 + 2] - b)) <= FILL_TOLERANCE
  const region = new Uint8Array(W * H)
  const stack = [y * W + x]
  while (stack.length) {
    const p = stack.pop()
    if (region[p] || !near(p)) continue
    region[p] = 1
    const px = p % W
    if (px > 0) stack.push(p - 1)
    if (px < W - 1) stack.push(p + 1)
    if (p >= W) stack.push(p - W)
    if (p < W * (H - 1)) stack.push(p + W)
  }

  // The flat copy takes the new colour exactly where it spread
  const colour = colourOf(m)
  const [nr, ng, nb] = rgb(colour)
  for (let p = 0; p < region.length; p++) {
    if (!region[p]) continue
    data[p * 4] = nr
    data[p * 4 + 1] = ng
    data[p * 4 + 2] = nb
  }
  solid.putImageData(image, 0, 0)

  // On the page: take out whatever was there (an earlier fill), then shade in underneath the lines,
  // reaching a little way under them so it meets them without a gap
  const mask = canvas2d(W, H)
  const shape = mask.createImageData(W, H)
  for (let p = 0; p < region.length; p++) if (region[p]) shape.data[p * 4 + 3] = 255
  mask.putImageData(shape, 0, 0)
  ctx.globalCompositeOperation = 'destination-out'
  ctx.drawImage(mask.canvas, 0, 0)
  // Spread the region by FILL_BLEED: across each row, then down each column
  const across = new Uint8Array(W * H)
  for (let p = 0; p < region.length; p++) {
    if (!region[p]) continue
    const px = p % W
    for (let d = -FILL_BLEED; d <= FILL_BLEED; d++) if (px + d >= 0 && px + d < W) across[p + d] = 1
  }
  for (let p = 0; p < across.length; p++) {
    if (!across[p]) continue
    for (let d = -FILL_BLEED; d <= FILL_BLEED; d++) {
      const q = p + d * W
      if (q >= 0 && q < across.length) shape.data[q * 4 + 3] = 255
    }
  }
  mask.putImageData(shape, 0, 0)
  mask.globalCompositeOperation = 'source-in'
  mask.fillStyle = grain(mask, colour, true)
  mask.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'destination-over'
  ctx.drawImage(mask.canvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

export function mark(ctx, solid, m, scale) {
  if (m.tool === 'fill') fill(ctx, solid, m, scale)
  else line(ctx, solid, m, scale)
}

// Draw a whole drawing; returns its flat copy, for adding more to it
export function paint(ctx, marks, scale) {
  const solid = fresh(ctx)
  for (const m of marks) mark(ctx, solid, m, scale)
  return solid
}

// The paper under a drawing, at `scale` canvas pixels per unit: drawn on its own canvas behind it,
// and under it again when it's saved as a picture
const PAPER = {
  sketch: { sheet: '#f7f0de', grain: 0.28 },
  white: { sheet: '#ffffff', grain: 0.1 },
  lined: { sheet: '#fcfaf2', grain: 0.12, lines: 18, margin: 40 },
  grid: { sheet: '#fbfbf7', grain: 0.1, grid: 14 },
  kraft: { sheet: '#c9a47c', grain: 0.4 },
}
let speckle
export function paintPaper(ctx, paper, scale) {
  const { width: W, height: H } = ctx.canvas
  const look = PAPER[paper] ?? PAPER.sketch
  ctx.fillStyle = look.sheet
  ctx.fillRect(0, 0, W, H)
  // Fibres in the paper: a speckle of warm specks, light and dark
  if (!speckle) {
    const tile = canvas2d(128, 128)
    const image = tile.createImageData(128, 128)
    const random = seeded(7)
    for (let i = 0; i < image.data.length; i += 4) {
      const dark = random() < 0.5
      image.data.set(dark ? [92, 76, 52] : [255, 252, 240], i)
      image.data[i + 3] = 255 * random() ** 2.6
    }
    tile.putImageData(image, 0, 0)
    speckle = tile.canvas
  }
  ctx.globalAlpha = look.grain
  ctx.fillStyle = ctx.createPattern(speckle, 'repeat')
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1
  ctx.lineWidth = Math.max(1, scale * 0.6)
  if (look.lines) {
    ctx.strokeStyle = 'rgb(84 140 200 / 0.38)'
    ctx.beginPath()
    for (let y = look.lines * 2; y < H / scale; y += look.lines) {
      ctx.moveTo(0, y * scale)
      ctx.lineTo(W, y * scale)
    }
    ctx.stroke()
    ctx.strokeStyle = 'rgb(214 80 90 / 0.45)'
    ctx.beginPath()
    ctx.moveTo(look.margin * scale, 0)
    ctx.lineTo(look.margin * scale, H)
    ctx.stroke()
  }
  if (look.grid) {
    ctx.strokeStyle = 'rgb(84 140 200 / 0.22)'
    ctx.beginPath()
    for (let x = look.grid; x < W / scale; x += look.grid) {
      ctx.moveTo(x * scale, 0)
      ctx.lineTo(x * scale, H)
    }
    for (let y = look.grid; y < H / scale; y += look.grid) {
      ctx.moveTo(0, y * scale)
      ctx.lineTo(W, y * scale)
    }
    ctx.stroke()
  }
}
