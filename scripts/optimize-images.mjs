// Converts the originals in images-src/ to WebP in public/images (max 1600px wide) and builds the
// social share image. Runs after fetch-images; prints each image's size for src/content.js.
import { mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const src = fileURLToPath(new URL('../images-src/', import.meta.url))
const dir = fileURLToPath(new URL('../public/images/', import.meta.url))
await mkdir(dir, { recursive: true })

// Per-image WebP quality where the default (80) makes a heavy file. The spinning face is 140
// frames; at the size it's shown, 50 looks the same and is 1.4 MB instead of 2.4 MB.
const QUALITY = { 'caleb-face.gif': 50 }

for (const name of await readdir(src)) {
  if (!/\.(jpe?g|png|gif)$/i.test(name)) continue
  // The bouncing head's poses become a pixel-art sprite sheet instead (scripts/pixel-sprites.mjs)
  if (name.startsWith('bounce-')) continue
  const out = name.replace(/\.\w+$/, '.webp')
  // GIFs stay animated, and are only ever shown small
  const gif = name.endsWith('.gif')
  const info = await sharp(src + name, { animated: gif })
    .resize({ width: gif ? 560 : 1600, withoutEnlargement: true })
    .webp({ quality: QUALITY[name] ?? 80, effort: name in QUALITY ? 6 : 4 })
    .toFile(dir + out)
  // For animations, info.height is every frame stacked; the file itself reports one frame
  const { height } = gif ? await sharp(dir + out).metadata() : info
  console.log(`✓ ${out}  ${info.width}×${height}  ${Math.round(info.size / 1024)} KB`)
}

// 1200×630 card shown when the site is shared on social media or in chat apps.
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#fdf9f6"/>
  <circle cx="1040" cy="120" r="220" fill="#a9d4f2"/>
  <circle cx="1120" cy="520" r="160" fill="#fdeca0"/>
  <g font-family="Arial Narrow, Arial, sans-serif" font-weight="800" font-size="190">
    <text x="86" y="356" fill="#a9d4f2">CALEB</text>
    <text x="80" y="350" fill="#c23d82">CALEB</text>
    <text x="86" y="526" fill="#a9d4f2">KAUTAI</text>
    <text x="80" y="520" fill="#c23d82">KAUTAI</text>
  </g>
  <text x="84" y="150" font-family="Arial, sans-serif" font-weight="600" font-size="40" fill="#2e2a45">Software engineer. Maker of weird stuff.</text>
</svg>`
await sharp(Buffer.from(og)).png().toFile(fileURLToPath(new URL('../public/og.png', import.meta.url)))
console.log('✓ og.png  1200×630')
