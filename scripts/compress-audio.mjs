// Converts the podcast originals in audio-src/ into small web-friendly files in public/audio:
// mono 64 kbps AAC (plenty for speech), with the index at the front so playback starts while
// the rest downloads. File names become URL-safe, e.g. "Matt D.m4a" → matt-d.m4a.
import { execFile } from 'node:child_process'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import ffmpeg from 'ffmpeg-static'

const run = promisify(execFile)
const src = fileURLToPath(new URL('../audio-src/', import.meta.url))
const dir = fileURLToPath(new URL('../public/audio/', import.meta.url))
await mkdir(dir, { recursive: true })

for (const name of await readdir(src)) {
  if (!/\.(m4a|mp3|wav|aac|ogg)$/i.test(name)) continue
  const out = name.replace(/\.\w+$/, '').toLowerCase().replace(/\s+/g, '-') + '.m4a'
  // ffmpeg reports the input's duration on stderr
  const { stderr } = await run(ffmpeg, [
    '-y', '-i', src + name,
    '-vn', '-ac', '1', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart',
    dir + out,
  ])
  const length = stderr.match(/Duration: (\d+):(\d+):(\d+)/).slice(1).map(Number)
  const mmss = `${String(length[0] * 60 + length[1]).padStart(2, '0')}:${String(length[2]).padStart(2, '0')}`
  const { size } = await stat(dir + out)
  console.log(`✓ ${out}  ${mmss}  ${(size / 1e6).toFixed(1)} MB`)
}
