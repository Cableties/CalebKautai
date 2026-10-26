import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { POSES, SPRITE, TILTS } from '../../src/lib/bounce.js'

// Checks the built sprite sheet (public/images/bounce-sprites.png, from `npm run pixel-sprites`)
const { data, info } = await sharp('public/images/bounce-sprites.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const solid = (x, y) => data[(y * info.width + x) * 4 + 3] >= 128

test('the sheet has a frame for every pose and tilt', () => {
  assert.equal(info.width, SPRITE.width * TILTS.length)
  assert.equal(info.height, SPRITE.height * POSES.length)
})

test('the head is the same size in every pose, so it does not grow or shrink as it turns', () => {
  const sizes = POSES.map((_, row) => {
    let area = 0
    for (let y = 0; y < SPRITE.height; y++) for (let x = 0; x < SPRITE.width; x++) if (solid(2 * SPRITE.width + x, row * SPRITE.height + y)) area++
    return Math.sqrt(area)
  })
  const smallest = Math.min(...sizes)
  assert.ok(Math.max(...sizes) / smallest < 1.05, `head sizes per pose: ${sizes.map((s) => s.toFixed(1)).join(', ')}`)
})

test('no frame is cut off at the edge of its cell', () => {
  for (const row of POSES.keys()) {
    for (const col of TILTS.keys()) {
      for (let i = 0; i < SPRITE.width; i++) {
        for (const y of [0, SPRITE.height - 1]) assert.ok(!solid(col * SPRITE.width + i, row * SPRITE.height + y), `pose ${row}, tilt ${col}`)
      }
      for (let i = 0; i < SPRITE.height; i++) {
        for (const x of [0, SPRITE.width - 1]) assert.ok(!solid(col * SPRITE.width + x, row * SPRITE.height + i), `pose ${row}, tilt ${col}`)
      }
    }
  }
})
