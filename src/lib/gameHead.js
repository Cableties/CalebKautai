import { frame } from './bounce.js'

// The games' head (Flappy Head's bird, Pinball's ball) dressed up by the cheats that change the
// bouncing head: Dance Mode tints it pink (and styles.css turns the whole canvas round the colour
// wheel, head and all, in time with the page), Matrix Mode turns it green, Big Head Mode
// makes it a wobbling bobblehead and Head Trail leaves little heads behind it. (Cheats that change
// the whole page, like Night Vision or Australia Mode, reach the games by themselves. Bonk's head is
// a page element, so styles.css does it there.)
export const cheatOn = (id) => document.documentElement.hasAttribute(`data-cheat-${id}`)

const TRAIL_EVERY = 0.045 // seconds between little heads, like the site's Head Trail
const TRAIL_SECONDS = 0.7
const DANCE = 'hsl(330 90% 60%)'
const MATRIX = 'hsl(140 100% 50%)'

// One sprite frame, tinted: 'color' blending keeps each pixel's lightness and takes the colour's
// hue, then the frame's own shape cuts it back out (works on every browser, unlike canvas filters)
let scratch = null
function tinted(sheet, sprite, row, col, colour) {
  scratch ??= document.createElement('canvas')
  const { width: w, height: h } = sprite
  scratch.width = w
  scratch.height = h
  const c = scratch.getContext('2d')
  c.drawImage(sheet, col * w, row * h, w, h, 0, 0, w, h)
  c.globalCompositeOperation = 'color'
  c.fillStyle = colour
  c.fillRect(0, 0, w, h)
  c.globalCompositeOperation = 'destination-in'
  c.drawImage(sheet, col * w, row * h, w, h, 0, 0, w, h)
  return scratch
}

// One game's head. draw() each frame with where it is: `size` is the face's width on the canvas
// (the hitbox, whatever hair is round it), and `scroll` is how fast the world slides left under it,
// so its trail slides with the world.
export function gameHead() {
  let trail = []
  let lastDrop = -Infinity

  function one(ctx, { sheet, sprite }, x, y, size, facing, colour, wobble) {
    const { row, col, mirrored } = frame(facing)
    const scale = size / sprite.art
    const w = sprite.width * scale
    const h = sprite.height * scale
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.translate(x, y)
    if (wobble) {
      // Bobbling from the neck, like Big Head Mode's photos
      ctx.translate(0, h * 0.4)
      ctx.rotate(wobble)
      ctx.translate(0, -h * 0.4)
    }
    if (mirrored) ctx.scale(-1, 1)
    if (colour) ctx.drawImage(tinted(sheet, sprite, row, col, colour), -w / 2, -h / 2, w, h)
    else ctx.drawImage(sheet, col * sprite.width, row * sprite.height, sprite.width, sprite.height, -w / 2, -h / 2, w, h)
    ctx.restore()
  }

  return {
    // Big Head Mode's head is drawn this much bigger, when the game doesn't grow it itself
    big: () => (cheatOn('bighead') ? 1.6 : 1),
    draw(ctx, head, { x, y, size, facing, time, alpha = 1, scroll = 0, grows = true }) {
      if (!head?.sheet.complete || !head.sheet.naturalWidth) return
      const colour = cheatOn('dance') ? DANCE : cheatOn('matrix') ? MATRIX : null
      const big = cheatOn('bighead')
      const wobble = big ? Math.sin((time * Math.PI * 2) / 1.3) * 0.12 : 0
      if (big && grows) size *= 1.6

      // Head Trail: little heads dropped behind, shrinking, sinking and fading
      if (cheatOn('trail')) {
        if (time - lastDrop >= TRAIL_EVERY) {
          lastDrop = time
          trail.push({ x, y, facing, time })
        }
      } else trail = []
      trail = trail.filter((t) => time - t.time < TRAIL_SECONDS && time >= t.time)
      for (const t of trail) {
        const age = (time - t.time) / TRAIL_SECONDS
        ctx.globalAlpha = alpha * (1 - age) * 0.8
        one(ctx, head, t.x - scroll * (time - t.time), t.y + age * 10, size * 0.35 * (1 - age * 0.7), t.facing, colour, 0)
      }

      ctx.globalAlpha = alpha
      one(ctx, head, x, y, size, facing, colour, wobble)
      ctx.globalAlpha = 1
    },
  }
}
