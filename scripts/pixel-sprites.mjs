// Builds each bouncing head's pixel-art sprite sheet from its five poses in images-src/.
//
// Rows are the poses (up → down, matching POSES in src/lib/bounce.js); columns are tilts (TILTS
// there). Each frame is rotated at full size first and only then shrunk, so the pixels stay square.
// Edges are cut to fully on/off and colours reduced to a small palette, for a proper pixel look.
// The poses are photos of different sizes (the head fills more of the up/down ones), so each is
// scaled to cover the same area as the profile pose, keeping the head one size as it turns.
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { HEADS, POSES, TILTS } from '../src/lib/bounce.js'

const src = fileURLToPath(new URL('../images-src/', import.meta.url))
const pub = fileURLToPath(new URL('../public', import.meta.url))

// The head's visible size in a pose: the square root of how many pixels it covers
async function headSize(file) {
  const { data } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let area = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] >= 128) area++
  return Math.sqrt(area)
}

for (const [id, head] of Object.entries(HEADS)) {
  const { sprite } = head
  const file = (pose) => `${src}${head.files}-${pose.name}.png`
  // The profile pose sets the size: it comes out `art` pixels wide
  const profile = file(POSES.find((p) => p.angle === 0))
  const reference = await headSize(profile)
  const profileWidth = (await sharp(profile).metadata()).width

  const frames = []
  let needed = [0, 0]
  for (const [row, pose] of POSES.entries()) {
    const shrink = (sprite.art / profileWidth) * (reference / (await headSize(file(pose))))
    for (const [col, tilt] of TILTS.entries()) {
      const rotated = await sharp(file(pose))
        .rotate(tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer({ resolveWithObject: true })
      const width = Math.round(rotated.info.width * shrink)
      const height = Math.round(rotated.info.height * shrink)
      needed = [Math.max(needed[0], width), Math.max(needed[1], height)]
      const small = await sharp(rotated.data).resize(width, height, { kernel: 'lanczos3' }).raw().toBuffer()
      // Hard edges: every pixel is either fully there or not at all
      for (let i = 3; i < small.length; i += 4) small[i] = small[i] >= 128 ? 255 : 0
      const frame = await sharp(small, { raw: { width, height, channels: 4 } }).png().toBuffer()
      frames.push({
        input: frame,
        left: col * sprite.width + Math.floor((sprite.width - width) / 2),
        top: row * sprite.height + Math.floor((sprite.height - height) / 2),
      })
    }
  }
  if (needed[0] > sprite.width || needed[1] > sprite.height) {
    throw new Error(`${id}: frames need ${needed.join('×')} art pixels, but HEADS.${id}.sprite is ${sprite.width}×${sprite.height}`)
  }

  await sharp({
    create: {
      width: sprite.width * TILTS.length,
      height: sprite.height * POSES.length,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(frames)
    .modulate({ saturation: 1.15 })
    .png({ palette: true, colours: head.colours ?? 16, dither: 0 })
    .toFile(pub + head.sheet)
  console.log(`✓ ${head.sheet.split('/').pop()}  ${POSES.length} poses × ${TILTS.length} tilts (frames need ${needed.join('×')})`)
}
