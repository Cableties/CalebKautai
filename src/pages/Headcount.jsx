import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS } from '../lib/bounce.js'
import { cheatOn, gameHead } from '../lib/gameHead.js'
import { ARMY, BURST, HEIGHT, HUD, KINDS, MAP, PLAYER, SETTINGS, SPIT, SWORD, VIEW, WIDTH, camera, headcountGame, raise, start, step, toRaise } from '../lib/headcount.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import { useGameSettings, useSettingsPanel } from '../components/GameSettings.jsx'
import { PauseButton, Paused, usePause } from '../components/Pause.jsx'
import GameBar from '../components/GameBar.jsx'
import useWide, { WIDE_WIDTH } from '../components/useWide.js'
import { useCheats } from '../components/Cheats.jsx'
import { feedback } from '../lib/feedback.js'
import { approach, themeAt } from '../lib/themes.js'

// Headcount: ghouls close in on my head, which keeps them off with a sword; raise the graves they
// leave and they fight on my side. The rules are in lib/headcount.js; this draws it (the map round
// my head, through the camera, which follows it), and takes the
// keys, the mouse and fingers. Move with WASD or the arrow keys, by holding the mouse where to go, or
// by dragging a finger (a stick, from wherever it went down). Raise with Space, a right-click, a second
// finger, or the Raise button in the corner.
const MOVE_KEYS = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
}
const RAISE_KEYS = [' ', 'e', 'E', 'Enter']
const STICK = 36 // how far (in the screen's units) a finger drags for full speed
const BUTTON = { r: 34, inset: 50 } // the Raise button, for fingers, in the bottom right
const INK = '#1d1a2b'
const COLOURS = {
  shambler: '#8fbf5a',
  runner: '#e3b94a',
  spitter: '#d8e06a',
  bloater: '#d4927a',
  wraith: '#cdd5f2',
  brute: '#a777cf',
  lord: '#d64545',
  spit: '#c4e04a',
  burst: '#ff9f43',
  crown: '#ffd24a',
  army: '#7fe3ff',
  grave: '#a7a6b8',
  blade: '#e8ecf5',
  hilt: '#c9a227',
  heart: '#f0506e',
  raise: '#9dffb0',
}
// A scene for each wave, going round, fading from one to the next: the ground, its patches and
// tufts, and how much of each scene's bits: pumpkins, flagstones, mist
const SCENES = [
  { ground: '#3d4a3a', patch: '#34402f', tuft: '#5b6e52', fog: '#d4ddcc', mist: 0.35, pumpkins: 0, tiles: 0 },
  { ground: '#4a3a2a', patch: '#3e3022', tuft: '#66733a', fog: '#ffdcb0', mist: 0.15, pumpkins: 1, tiles: 0 },
  { ground: '#47454f', patch: '#3d3b45', tuft: '#5d5b69', fog: '#dcdaea', mist: 0.2, pumpkins: 0, tiles: 1 },
  { ground: '#2e4446', patch: '#26393b', tuft: '#43645a', fog: '#c2e6d9', mist: 0.7, pumpkins: 0, tiles: 0 },
]
const NAMES = ['The graveyard', 'The pumpkin patch', 'The crypt', 'The bog']
const TITLE_SECONDS = 2.2 // a wave's banner, as it starts
const noise = (i, n) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1
// The ground's bits are scattered a few to each CELL of the map, the same every time, so they stay put
// as the camera moves. Mist drifts in bigger ones.
const CELL = 70
const MIST = 300
const cellId = (cx, cy) => cx * 7919 + cy * 104729
// The cells (of `size`) the camera can see, a spare one round the edge for things that lean over
function cells(cam, W, size, each) {
  for (let cx = Math.floor(cam.x / size) - 1; cx <= Math.floor((cam.x + W) / size); cx++) {
    for (let cy = Math.floor(cam.y / size) - 1; cy <= Math.floor((cam.y + VIEW) / size); cy++) each(cx, cy, cellId(cx, cy))
  }
}

// The map round the camera (`cam`, a W-wide window onto it), in the map's units: the ground, its
// patches and tufts and each scene's bits, darker ground past the edge, and a fence along it
function backdrop(ctx, W, cam, theme, time) {
  ctx.fillStyle = theme.patch
  ctx.fillRect(cam.x, cam.y, W, VIEW)
  ctx.fillStyle = theme.ground
  ctx.fillRect(0, 0, MAP.width, MAP.height)
  const [left, right] = [Math.max(0, cam.x), Math.min(MAP.width, cam.x + W)]
  const [top, bottom] = [Math.max(0, cam.y), Math.min(MAP.height, cam.y + VIEW)]
  // Flagstones, faintly
  if (theme.tiles > 0) {
    ctx.globalAlpha = theme.tiles * 0.35
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let y = Math.floor(top / 40) * 40; y < bottom; y += 40) {
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
      const shift = (y / 40) % 2 ? 30 : 0
      for (let x = Math.floor((left - shift) / 60) * 60 + shift; x < right; x += 60) {
        ctx.moveTo(x, y)
        ctx.lineTo(x, Math.min(bottom, y + 40))
      }
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  const inside = (x, y) => x >= 0 && x <= MAP.width && y >= 0 && y <= MAP.height
  // Patches of darker ground, and tufts of grass
  cells(cam, W, CELL, (cx, cy, i) => {
    if (noise(i, 1) < 0.35) {
      const [x, y] = [(cx + noise(i, 2)) * CELL, (cy + noise(i, 3)) * CELL]
      if (inside(x, y)) {
        ctx.fillStyle = theme.patch
        ctx.beginPath()
        ctx.ellipse(x, y, 18 + noise(i, 4) * 26, 8 + noise(i, 5) * 10, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.strokeStyle = theme.tuft
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (const k of [6, 8]) {
      const [x, y] = [(cx + noise(i, k)) * CELL, (cy + noise(i, k + 1)) * CELL]
      if (!inside(x, y)) continue
      for (const dx of [-3, 0, 3]) {
        ctx.moveTo(x + dx * 0.4, y)
        ctx.lineTo(x + dx, y - 5 - noise(i, k) * 3)
      }
    }
    ctx.stroke()
  })
  // Pumpkins, grinning
  if (theme.pumpkins > 0) {
    ctx.globalAlpha = theme.pumpkins
    cells(cam, W, CELL, (cx, cy, i) => {
      if (noise(i, 10) > 0.08) return
      const [x, y] = [(cx + 0.2 + noise(i, 11) * 0.6) * CELL, (cy + 0.2 + noise(i, 12) * 0.6) * CELL]
      if (!inside(x, y)) return
      ctx.fillStyle = '#e8822e'
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(x, y, 10, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#4f7a2e'
      ctx.fillRect(x - 1.5, y - 12, 3, 5)
      ctx.fillStyle = '#ffd96b'
      ctx.beginPath()
      ctx.moveTo(x - 5, y - 2)
      ctx.lineTo(x - 2, y - 2)
      ctx.lineTo(x - 3.5, y - 5)
      ctx.moveTo(x + 2, y - 2)
      ctx.lineTo(x + 5, y - 2)
      ctx.lineTo(x + 3.5, y - 5)
      ctx.fill()
      ctx.fillRect(x - 4, y + 2, 8, 2)
    })
    ctx.globalAlpha = 1
  }
  // The fence round the edge: two rails, and posts
  ctx.strokeStyle = '#6e5a43'
  ctx.lineWidth = 3
  for (const inset of [-2, 2]) ctx.strokeRect(-inset, -inset, MAP.width + inset * 2, MAP.height + inset * 2)
  ctx.fillStyle = '#54432f'
  for (let t = 0; t <= MAP.width; t += 40) {
    for (const [x, y] of [[t, 0], [t, MAP.height], [0, t], [MAP.width, t]]) {
      if (x >= cam.x - 10 && x <= cam.x + W + 10 && y >= cam.y - 10 && y <= cam.y + VIEW + 10) ctx.fillRect(x - 4, y - 4, 8, 8)
    }
  }
  // Mist drifting across
  if (theme.mist > 0) {
    ctx.fillStyle = theme.fog
    cells(cam, W, MIST, (cx, cy, i) => {
      const x = (cx + noise(i, 13)) * MIST + Math.sin(time * 0.1 + i) * 60
      const y = (cy + noise(i, 14)) * MIST
      ctx.globalAlpha = theme.mist * (0.1 + 0.05 * Math.sin(time * 0.5 + i))
      ctx.beginPath()
      ctx.ellipse(x, y, 90, 26, 0, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.globalAlpha = 1
  }
}

// A grave: a little headstone, rising out of the ground. Glowing when a raise would bring it up.
function grave(ctx, g, next, time) {
  const rise = Math.min(1, g.age / 0.25)
  const h = 18 * rise
  if (next) {
    ctx.fillStyle = COLOURS.raise
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(time * 8)
    ctx.beginPath()
    ctx.ellipse(g.x, g.y + 2, 14, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = COLOURS.grave
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(g.x - 7, g.y + 2)
  ctx.lineTo(g.x - 7, g.y + 2 - h + 7)
  ctx.arc(g.x, g.y + 2 - h + 7, 7, Math.PI, 0)
  ctx.lineTo(g.x + 7, g.y + 2)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  if (rise === 1) {
    ctx.fillStyle = INK
    ctx.fillRect(g.x - 0.75, g.y - 12, 1.5, 8)
    ctx.fillRect(g.x - 3, g.y - 10, 6, 1.5)
  }
}

// A ghoul (or one of the army, pale blue and see-through), wobbling, its eyes on where it's going.
// Wraiths are faint, spitters have a mouth, bloaters spots, and a lord a crown.
function ghoul(ctx, u, colour, look, time, army) {
  const { r } = KINDS[u.kind]
  const bob = Math.sin(time * 8 + u.x * 0.1) * 1.2
  const [x, y] = [u.x, u.y + bob]
  const body = army ? 0.85 : u.kind === 'wraith' ? 0.55 + 0.15 * Math.sin(time * 5 + u.x) : 1
  ctx.globalAlpha = body
  if (army) {
    ctx.fillStyle = COLOURS.army
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    ctx.arc(x, y, r + 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = body
  }
  // A body like a sheet, with a wavy hem
  ctx.fillStyle = colour
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y - r * 0.15, r, Math.PI, 0)
  for (let k = 0; k <= 4; k++) ctx.lineTo(x + r - (k * r) / 2, y + r * 0.8 + (k % 2 ? -3 : 0) + Math.sin(time * 10 + k) * 1)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  if (u.kind === 'bloater') {
    ctx.fillStyle = INK
    ctx.globalAlpha = body * 0.25
    for (const [sx, sy, sr] of [[-0.45, 0.35, 0.18], [0.4, 0.45, 0.14], [0.1, 0.1, 0.1]]) {
      ctx.beginPath()
      ctx.arc(x + sx * r, y + sy * r, sr * r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = body
  }
  if (u.kind === 'spitter') {
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.ellipse(x, y + r * 0.28, r * 0.22, r * 0.16 + Math.max(0, Math.sin(time * 6 + u.x)) * r * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  if (u.kind === 'lord') {
    const top = y - r * 1.1
    ctx.fillStyle = COLOURS.crown
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x - r * 0.5, top + 2)
    for (const [cx, cy] of [[-0.5, -0.45], [-0.25, -0.15], [0, -0.55], [0.25, -0.15], [0.5, -0.45], [0.5, 0]]) ctx.lineTo(x + cx * r, top + 2 + cy * r)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  // Eyes, looking its way
  const [lx, ly] = [Math.cos(look) * r * 0.12, Math.sin(look) * r * 0.12]
  for (const side of [-1, 1]) {
    const ex = x + side * r * 0.36
    const ey = y - r * 0.25
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(ex, ey, r * 0.26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = army ? '#1b6f8a' : '#b3243a'
    ctx.beginPath()
    ctx.arc(ex + lx, ey + ly, r * 0.13, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // A tough one's health, once it's been hit (over a lord's crown)
  if (u.hp < u.max) {
    const top = y - r - 9 - (u.kind === 'lord' ? r * 0.6 : 0)
    ctx.fillStyle = INK
    ctx.fillRect(x - r, top, r * 2, 4)
    ctx.fillStyle = army ? COLOURS.army : COLOURS.heart
    ctx.fillRect(x - r, top, (r * 2 * Math.max(0, u.hp)) / u.max, 4)
  }
}

// My head's sword: mid-swing, sweeping across the way it's swinging with a slash behind it; or else
// held up at its side
function sword(ctx, p, swing) {
  const swinging = swing && swing.age < SWORD.swing
  const t = swinging ? swing.age / SWORD.swing : 0
  const angle = swinging ? swing.angle - SWORD.arc / 2 + SWORD.arc * t : (p.facing * Math.PI) / 180 - 1.1
  const [from, to] = [PLAYER.r - 2, PLAYER.r + SWORD.reach]
  if (swinging) {
    ctx.strokeStyle = '#ffffff'
    ctx.globalAlpha = 0.45 * (1 - t)
    ctx.lineWidth = SWORD.reach * 0.6
    ctx.beginPath()
    ctx.arc(p.x, p.y, PLAYER.r + SWORD.reach * 0.65, swing.angle - SWORD.arc / 2, angle)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
  ctx.lineCap = 'round'
  ctx.strokeStyle = INK
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(p.x + cos * from, p.y + sin * from)
  ctx.lineTo(p.x + cos * to, p.y + sin * to)
  ctx.stroke()
  ctx.strokeStyle = COLOURS.blade
  ctx.lineWidth = 3.5
  ctx.stroke()
  // The crossguard
  const g = from + 4
  ctx.strokeStyle = COLOURS.hilt
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(p.x + cos * g - sin * 6, p.y + sin * g + cos * 6)
  ctx.lineTo(p.x + cos * g + sin * 6, p.y + sin * g - cos * 6)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

function heart(ctx, x, y, size, full) {
  ctx.beginPath()
  ctx.moveTo(x, y + size * 0.35)
  ctx.bezierCurveTo(x - size, y - size * 0.3, x - size * 0.4, y - size * 0.95, x, y - size * 0.35)
  ctx.bezierCurveTo(x + size * 0.4, y - size * 0.95, x + size, y - size * 0.3, x, y + size * 0.35)
  ctx.closePath()
  ctx.fillStyle = full ? COLOURS.heart : 'rgb(255 255 255 / 0.15)'
  ctx.fill()
}

const button = (W) => ({ x: W - BUTTON.inset, y: HEIGHT - BUTTON.inset })

// `wave`: which wave's look, fading from one to the next; `since`: seconds since this wave started
function draw(ctx, game, head, looks, time, wave, since, ui) {
  const W = game.width
  const theme = themeAt(SCENES, wave).palette
  const p = game.player
  // The map, under the strip, round my head
  const cam = camera(game)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, HUD, W, VIEW)
  ctx.clip()
  ctx.translate(-cam.x, HUD - cam.y)
  backdrop(ctx, W, cam, theme, time)

  // The graves, the ones a raise would bring up glowing
  const next = new Set(toRaise(game))
  const ready = game.raiseIn <= 0 && next.size > 0
  for (const g of game.graves) grave(ctx, g, next.has(g), time)
  for (const f of game.foes) ghoul(ctx, f, COLOURS[f.kind], Math.atan2(p.y - f.y, p.x - f.x), time, false)
  for (const a of game.army) {
    let look = Math.PI / 2
    let least = Infinity
    for (const f of game.foes) {
      const d = Math.hypot(f.x - a.x, f.y - a.y)
      if (d < least) [least, look] = [d, Math.atan2(f.y - a.y, f.x - a.x)]
    }
    ghoul(ctx, a, COLOURS.army, look, time, true)
  }

  // My head, flickering for a moment after a bite, with its sword
  if (!(game.safe > 0 && Math.sin(time * 40) < 0)) {
    looks.draw(ctx, head, { x: p.x, y: p.y, size: PLAYER.r * 2.3, facing: p.facing, time })
    sword(ctx, p, game.swing)
  }

  // Spit, glowing
  for (const b of game.spits) {
    ctx.fillStyle = b.army ? COLOURS.army : COLOURS.spit
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.arc(b.x, b.y, SPIT.r + 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(b.x, b.y, SPIT.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  // Knocked down: a ring; a bloater bursting: a big orange splash, as far as it reaches
  for (const pop of game.pops) {
    const t = pop.age / 0.4
    ctx.globalAlpha = 1 - t
    if (pop.colour === 'burst') {
      ctx.fillStyle = COLOURS.burst
      ctx.globalAlpha = 0.45 * (1 - t)
      ctx.beginPath()
      ctx.arc(pop.x, pop.y, BURST.radius * Math.min(1, t * 3), 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.strokeStyle = pop.colour === 'army' ? COLOURS.army : '#ffffff'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(pop.x, pop.y, 8 + pop.age * 60, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Labels floating up
  ctx.font = '800 16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 4
  for (const l of game.labels) {
    ctx.globalAlpha = Math.min(1, 2 * (1.4 - l.age))
    const x = Math.min(Math.max(l.x, cam.x + 80), cam.x + W - 80)
    ctx.strokeStyle = INK
    ctx.strokeText(l.text, x, l.y - l.age * 40)
    ctx.fillStyle = COLOURS.raise
    ctx.fillText(l.text, x, l.y - l.age * 40)
  }
  ctx.globalAlpha = 1
  ctx.restore()
  // (Restoring undid the text's centring, which the rest is drawn with too)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Ghouls out of sight: an arrow at the edge of the screen, pointing their way
  ctx.fillStyle = COLOURS.heart
  const [sx, sy] = [p.x - cam.x, p.y - cam.y + HUD]
  for (const f of game.foes) {
    const [fx, fy] = [f.x - cam.x, f.y - cam.y + HUD]
    if (fx >= 0 && fx <= W && fy >= HUD && fy <= HEIGHT) continue
    const a = Math.atan2(fy - sy, fx - sx)
    // Where the line from my head to it leaves the screen, a little in
    const t = Math.min(...[[Math.cos(a), sx, W], [Math.sin(a), sy - HUD, VIEW]].map(([d, from, size]) => (d > 0 ? (size - from - 10) / d : d < 0 ? (from - 10) / -d : Infinity)))
    ctx.save()
    ctx.translate(sx + Math.cos(a) * t, sy + Math.sin(a) * t)
    ctx.rotate(a)
    ctx.globalAlpha = 0.75
    ctx.beginPath()
    ctx.moveTo(6, 0)
    ctx.lineTo(-5, -5)
    ctx.lineTo(-5, 5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = 1

  // The wave's banner as it starts, with where it is
  if (since < TITLE_SECONDS && game.wave && !game.over) {
    ctx.globalAlpha = Math.min(1, (TITLE_SECONDS - since) * 2, since * 4)
    ctx.strokeStyle = INK
    ctx.fillStyle = '#fff'
    ctx.lineWidth = 6
    ctx.font = '800 30px system-ui, sans-serif'
    ctx.strokeText(`Wave ${game.wave}`, W / 2, HEIGHT * 0.36)
    ctx.fillText(`Wave ${game.wave}`, W / 2, HEIGHT * 0.36)
    ctx.font = '700 16px system-ui, sans-serif'
    ctx.lineWidth = 4
    const name = NAMES[(game.wave - 1) % NAMES.length]
    ctx.strokeText(name, W / 2, HEIGHT * 0.36 + 30)
    ctx.fillText(name, W / 2, HEIGHT * 0.36 + 30)
    ctx.globalAlpha = 1
  }

  // For fingers: the stick, where one's dragging, and the Raise button
  if (ui.stick) {
    ctx.strokeStyle = '#fff'
    ctx.fillStyle = '#fff'
    ctx.globalAlpha = 0.25
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(ui.stick.from[0], ui.stick.from[1], STICK, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 0.4
    ctx.beginPath()
    ctx.arc(ui.stick.knob[0], ui.stick.knob[1], 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  if (ui.touch) {
    const { x, y } = button(W)
    const count = next.size
    ctx.globalAlpha = ready ? 0.95 : 0.45
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.arc(x, y, BUTTON.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = COLOURS.raise
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = COLOURS.raise
    ctx.font = '800 14px system-ui, sans-serif'
    ctx.fillText('Raise', x, y - (count ? 6 : 0))
    if (count) {
      ctx.font = '700 12px system-ui, sans-serif'
      ctx.fillText(`×${count}`, x, y + 10)
    }
    ctx.globalAlpha = 1
  }

  // The score strip: score, wave (and the army, on a wide board), hearts
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, HUD)
  ctx.font = '800 20px system-ui, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.fillText(String(game.score), 14, HUD / 2 + 1)
  ctx.font = '700 15px system-ui, sans-serif'
  ctx.textAlign = 'center'
  const army = `Army ${game.army.length}/${ARMY.max}`
  ctx.fillText(`Wave ${Math.max(1, game.wave)}`, W / 2 - (W > WIDTH ? 60 : 0), HUD / 2 + 1)
  if (W > WIDTH) {
    ctx.fillStyle = COLOURS.army
    ctx.fillText(army, W / 2 + 60, HUD / 2 + 1)
  }
  const size = game.maxHearts > 4 ? 8 : 10
  for (let i = 0; i < game.maxHearts; i++) heart(ctx, W - 16 - i * size * 2.2, HUD / 2 + 1, size, i < game.hearts)
  // On a narrow board the army goes under the strip
  if (W <= WIDTH) {
    ctx.textAlign = 'left'
    ctx.font = '700 13px system-ui, sans-serif'
    ctx.lineWidth = 3
    ctx.strokeStyle = INK
    ctx.strokeText(army, 12, HUD + 16)
    ctx.fillStyle = COLOURS.army
    ctx.fillText(army, 12, HUD + 16)
  }
}

// What happened this frame, for the sounds (and buzzes)
function effects(g) {
  if (g.hurt) feedback('bonk')
  else if (g.raisedNow) feedback('rise')
  else if (g.fizzled) feedback('whiff')
  else if (g.cleared) feedback('bonus')
  else if (g.waveStarted) feedback('wave')
  else if (g.killed || g.burst) feedback('boom')
  else if (g.swung) feedback('whiff')
}

export default function Headcount() {
  const canvas = useRef(null)
  const stage = useRef(null)
  const game = useRef(null)
  const keys = useRef(new Set()) // movement keys held
  const mouse = useRef(null) // where the mouse is on the screen, while its button's held: walk there
  const stick = useRef(null) // a finger dragging: { id, from, knob } (in the screen's units)
  const touch = useRef(false) // played with fingers: show the Raise button
  const head = useRef(null)
  const looks = useRef(null)
  const { player } = useCheats()
  const [phase, setPhase] = useState('ready') // ready | playing | paused | over
  // A wider view on a wide window (components/useWide.js), picked as each game is set up
  const wide = useWide()
  const wideRef = useRef(wide)
  wideRef.current = wide
  const [boardWide, setBoardWide] = useState(false)
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [scores, setScores] = useState(null)
  const [settings, toggleSetting, settingsRef] = useGameSettings('headcount', SETTINGS)
  const { cog, panel } = useSettingsPanel(SETTINGS, settings, toggleSetting)
  const shown = useRef(0) // the wave whose look is showing (lib/themes.js), fading to the next
  const started = useRef({ wave: 0, at: 0 }) // which wave's banner was shown, and when (seconds)
  const GAME = headcountGame(settings)
  const [best, record] = useBest(GAME)
  const { run, begin } = useRun(GAME)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const { pause, resume } = usePause(phaseRef, setPhase, {
    // Let go of anything held, so it isn't still held on the way back
    onPause: () => {
      keys.current.clear()
      mouse.current = null
      stick.current = null
    },
  })
  // In refs, since the game loop and key handler are set up once
  const recordRef = useRef(record)
  recordRef.current = record
  const beginRef = useRef(begin)
  beginRef.current = begin

  const fresh = () => {
    setBoardWide(wideRef.current)
    return start({ ...settingsRef.current, easy: cheatOn('easy'), width: wideRef.current ? WIDE_WIDTH : WIDTH })
  }

  // Where it's going: a finger's stick, the mouse, or the keys
  function input() {
    if (stick.current) {
      const { from, knob } = stick.current
      return { move: [(knob[0] - from[0]) / STICK, (knob[1] - from[1]) / STICK] }
    }
    if (mouse.current) {
      const cam = camera(game.current)
      return { to: [mouse.current[0] + cam.x, mouse.current[1] - HUD + cam.y] }
    }
    const move = [0, 0]
    for (const key of keys.current) {
      move[0] += MOVE_KEYS[key][0]
      move[1] += MOVE_KEYS[key][1]
    }
    return { move }
  }

  // New settings (or the saved ones, once they load), or a different shaped window: a fresh game
  useEffect(() => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') return
    game.current = fresh()
    setScores(null)
    setScore(0)
    setPhase('ready')
  }, [GAME, wide])

  useEffect(() => {
    const sheet = new Image()
    sheet.src = HEADS[player].sheet
    head.current = { sheet, sprite: HEADS[player].sprite }
  }, [player])

  useEffect(() => {
    looks.current = gameHead()
    game.current = fresh()
    touch.current = matchMedia('(pointer: coarse)').matches
    const el = canvas.current
    const ctx = el.getContext('2d')
    let last = performance.now()
    let animation

    function resize() {
      const ratio = devicePixelRatio || 1
      el.width = Math.round(el.clientWidth * ratio)
      el.height = Math.round(el.clientHeight * ratio)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)

    function tick(now) {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      if (phaseRef.current === 'playing') {
        const before = game.current
        game.current = step(before, dt, input())
        const g = game.current
        effects(g)
        if (g.score !== before.score) setScore(g.score)
        if (g.wave !== before.wave) setWave(g.wave)
        if (g.over) {
          feedback('splat')
          setPhase('over')
          setNewBest(!g.easy && recordRef.current(g.score))
        }
      }
      ctx.setTransform(el.width / game.current.width, 0, 0, el.height / HEIGHT, 0, 0)
      shown.current = approach(shown.current, Math.max(0, game.current.wave - 1), dt)
      // A new wave (or a new game): its banner, from now
      if (game.current.wave !== started.current.wave) started.current = { wave: game.current.wave, at: now / 1000 }
      const since = now / 1000 - started.current.at
      draw(ctx, game.current, head.current, looks.current, now / 1000, shown.current, since, { stick: stick.current, touch: touch.current })
      animation = requestAnimationFrame(tick)
    }
    animation = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(animation)
      observer.disconnect()
    }
  }, [])

  function play() {
    stage.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    game.current = fresh()
    mouse.current = null
    stick.current = null
    started.current = { wave: 0, at: 0 }
    setScore(0)
    setWave(0)
    setNewBest(false)
    setPhase('playing')
    beginRef.current()
  }
  function rise() {
    if (phaseRef.current !== 'playing') return
    game.current = raise(game.current)
    effects(game.current)
  }

  // Where a pointer is on the screen, in its units (Australia Mode has the page upside down, so it's
  // flipped)
  function at(e) {
    const box = stage.current.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * game.current.width
    const y = ((e.clientY - box.top) / box.height) * HEIGHT
    return document.documentElement.hasAttribute('data-cheat-australia') ? [game.current.width - x, HEIGHT - y] : [x, y]
  }
  function down(e) {
    e.preventDefault()
    if (e.pointerType === 'touch') touch.current = true
    if (phaseRef.current === 'ready') return play()
    if (phaseRef.current !== 'playing') return
    const point = at(e)
    // The mouse's right button raises; its left walks to where it's held
    if (e.pointerType === 'mouse') {
      if (e.button === 2) return rise()
      stage.current.setPointerCapture(e.pointerId)
      mouse.current = point
      return
    }
    // A finger on the Raise button, or a second finger anywhere, raises; the first is a stick
    const { x, y } = button(game.current.width)
    if ((touch.current && Math.hypot(point[0] - x, point[1] - y) <= BUTTON.r + 6) || stick.current) return rise()
    stage.current.setPointerCapture(e.pointerId)
    stick.current = { id: e.pointerId, from: point, knob: point }
  }
  function move(e) {
    if (mouse.current && e.pointerType === 'mouse') mouse.current = at(e)
    const s = stick.current
    if (s && s.id === e.pointerId) {
      const [x, y] = at(e)
      // The knob stays within the stick's reach
      const d = Math.hypot(x - s.from[0], y - s.from[1])
      const k = d > STICK ? STICK / d : 1
      stick.current = { ...s, knob: [s.from[0] + (x - s.from[0]) * k, s.from[1] + (y - s.from[1]) * k] }
    }
  }
  function up(e) {
    if (e.pointerType === 'mouse' && e.button === 0) mouse.current = null
    if (stick.current?.id === e.pointerId) stick.current = null
  }

  useEffect(() => {
    function key(e) {
      if (e.target.closest?.('input, textarea, button, a')) return
      if (RAISE_KEYS.includes(e.key)) {
        e.preventDefault()
        if (e.type !== 'keydown' || e.repeat) return
        if (phaseRef.current === 'ready') play()
        else rise()
        return
      }
      if (!MOVE_KEYS[e.key]) return
      e.preventDefault()
      // The same key in either case is one key (Shift held or not)
      const name = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (e.type === 'keyup') return void keys.current.delete(name)
      if (phaseRef.current === 'ready' && !e.repeat) play()
      keys.current.add(name)
    }
    addEventListener('keydown', key)
    addEventListener('keyup', key)
    return () => {
      removeEventListener('keydown', key)
      removeEventListener('keyup', key)
    }
  }, [])

  return (
    <article className="page game-page">
      <p className="game-back">
        <Link to="/games" viewTransition>
          ← All games
        </Link>
      </p>
      <h1 className="page-title">Headcount</h1>
      <p className="lede">
        Ghouls are closing in on my head. It swings its sword at any that get close, but it can't win alone: each one knocked down leaves a grave, and raising brings every
        grave back up on your side (the strongest first, once your army's nearly full), to come to you and fight. Watch out for spitters, bloaters that burst, wraiths that slip
        past your army, and a lord every fifth wave. Move with WASD or the arrow keys (or hold the mouse where you want to go, or drag a finger). Raise with Space, a
        right-click, or the Raise button. Clear a wave for a heart back.
      </p>

      <div className="game-layout">
        <div className="game-screen">
          <GameBar>{phase === 'playing' ? <PauseButton onPause={pause} /> : phase !== 'paused' && cog}</GameBar>
          <div
            className={`game-stage swipe-stage${boardWide ? ' wide' : ''}`}
            ref={stage}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onContextMenu={(e) => e.preventDefault()}
          >
            <canvas ref={canvas} className="game-canvas" role="img" aria-label={`Headcount. Wave ${Math.max(1, wave)}. Score: ${score}`} />
            {phase === 'ready' && (
              <div className="game-overlay game-overlay-hint">
                <p>Tap to start</p>
              </div>
            )}
            {phase === 'over' && (
              <div className="game-overlay" onPointerDown={(e) => e.stopPropagation()}>
                <h2>Overrun!</h2>
                <p className="game-final" role="status">
                  Score: <strong>{score}</strong>
                  {newBest ? ' · New best!' : best ? ` · Best: ${best}` : ''}
                </p>
                <ScoreEntry game={GAME} score={score} run={run} easy={game.current?.easy} onSaved={setScores} />
                <button type="button" className="button" onClick={play}>
                  Play again
                </button>
              </div>
            )}
            {phase === 'paused' && <Paused onResume={resume} />}
            {panel}
          </div>
        </div>
        <ScoreBoard game={GAME} scores={scores} />
      </div>
    </article>
  )
}
