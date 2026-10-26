// Builds the bouncing head's pixel-art sprite sheet from the five poses in images-src/.
//
// Rows are the poses (up → down, matching POSES in src/lib/bounce.js); columns are tilts (TILTS
// there). Each frame is rotated at full size first and only then shrunk, so the pixels stay square.
// Edges are cut to fully on/off and colours reduced to a small palette, for a proper pixel look.
// The poses are photos of different sizes (the head fills more of the up/down ones), so each is
// scaled to cover the same area as the profile pose, keeping the head one size as it turns.
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { POSES, SPRITE, TILTS } from '../src/lib/bounce.js'

const src = fileURLToPath(new URL('../images-src/', import.meta.url))
const out = fileURLToPath(new URL('../public/images/bounce-sprites.png', import.meta.url))
const SOURCE_WIDTH = 200 // the pose PNGs are all 200px wide; the profile pose's head sets the size

// The head's visible size in a pose: the square root of how many pixels it covers
async function headSize(file) {
  const { data } = await sharp(src + file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let area = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] >= 128) area++
  return Math.sqrt(area)
}
const reference = await headSize(POSES.find((p) => p.angle === 0).file)

const frames = []
for (const [row, pose] of POSES.entries()) {
  const shrink = (SPRITE.art / SOURCE_WIDTH) * (reference / (await headSize(pose.file)))
  for (const [col, tilt] of TILTS.entries()) {
    const rotated = await sharp(src + pose.file)
      .rotate(tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer({ resolveWithObject: true })
    const width = Math.round(rotated.info.width * shrink)
    const height = Math.round(rotated.info.height * shrink)
    const small = await sharp(rotated.data).resize(width, height, { kernel: 'lanczos3' }).raw().toBuffer()
    // Hard edges: every pixel is either fully there or not at all
    for (let i = 3; i < small.length; i += 4) small[i] = small[i] >= 128 ? 255 : 0
    const frame = await sharp(small, { raw: { width, height, channels: 4 } }).png().toBuffer()
    frames.push({
      input: frame,
      left: col * SPRITE.width + Math.floor((SPRITE.width - width) / 2),
      top: row * SPRITE.height + Math.floor((SPRITE.height - height) / 2),
    })
  }
}

await sharp({
  create: {
    width: SPRITE.width * TILTS.length,
    height: SPRITE.height * POSES.length,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(frames)
  .modulate({ saturation: 1.15 })
  .png({ palette: true, colours: 16, dither: 0 })
  .toFile(out)
console.log(`✓ bounce-sprites.png  ${POSES.length} poses × ${TILTS.length} tilts`)
