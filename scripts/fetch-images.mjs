// Downloads the original images from the old Wix site into images-src/ (kept as the master copies;
// not deployed). `npm run fetch-images` then runs optimize-images to make the WebPs the site serves.
import { mkdir, writeFile } from 'node:fs/promises'
import { images } from '../src/content.js'

const dir = new URL('../images-src/', import.meta.url)
await mkdir(dir, { recursive: true })

for (const [key, { file, remote }] of Object.entries(images)) {
  const res = await fetch(remote)
  if (!res.ok) {
    console.error(`✗ ${key}: HTTP ${res.status}`)
    continue
  }
  await writeFile(new URL(file, dir), Buffer.from(await res.arrayBuffer()))
  console.log(`✓ ${file}`)
}
