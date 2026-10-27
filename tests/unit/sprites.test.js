import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { HEADS, POSES, TILTS } from '../../src/lib/bounce.js'

// Checks the built sprite sheets (public/images/, from `npm run pixel-sprites`)
for (const [id, { sheet, sprite }] of Object.entries(HEADS)) {
  const { data, info } = await sharp(`public${sheet}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const solid = (x, y) => data[(y * info.width + x) * 4 + 3] >= 128

  test(`${id}: the sheet has a frame for every pose and tilt`, () => {
    assert.equal(info.width, sprite.width * TILTS.length)
    assert.equal(info.height, sprite.height * POSES.length)
  })

  test(`${id}: the head is the same size in every pose, so it does not grow or shrink as it turns`, () => {
    const sizes = POSES.map((_, row) => {
      let area = 0
      for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++) if (solid(2 * sprite.width + x, row * sprite.height + y)) area++
      return Math.sqrt(area)
    })
    const smallest = Math.min(...sizes)
    assert.ok(Math.max(...sizes) / smallest < 1.05, `head sizes per pose: ${sizes.map((s) => s.toFixed(1)).join(', ')}`)
  })

  test(`${id}: no frame is cut off at the edge of its cell`, () => {
    for (const row of POSES.keys()) {
      for (const col of TILTS.keys()) {
        for (let i = 0; i < sprite.width; i++) {
          for (const y of [0, sprite.height - 1]) assert.ok(!solid(col * sprite.width + i, row * sprite.height + y), `pose ${row}, tilt ${col}`)
        }
        for (let i = 0; i < sprite.height; i++) {
          for (const x of [0, sprite.width - 1]) assert.ok(!solid(col * sprite.width + x, row * sprite.height + i), `pose ${row}, tilt ${col}`)
        }
      }
    }
  })
}
