// Moderate the tattoo page's guestbook (stars, comments and doodles) from the terminal.
//   npm run reviews                 list entries waiting for approval, doodles drawn as text
//   npm run reviews -- approve <id> publish one (or `approve all`)
//   npm run reviews -- delete <id>  remove a pending or published review, and its rating
//   npm run reviews -- published    list published reviews
// Needs the database's REST URL and token in .env.moderation (git-ignored):
//   UPSTASH_REDIS_REST_URL=https://...upstash.io
//   UPSTASH_REDIS_REST_TOKEN=...
// They're marked Sensitive on Vercel, so `vercel env pull` can't fetch them; copy them from the
// database's page in the Upstash console. A separate file so `vercel env pull` never overwrites it.
import { existsSync } from 'node:fs'
import { GRID } from '../api/_lib/doodle.js'

if (existsSync('.env.moderation')) process.loadEnvFile('.env.moderation')
const { KEYS, redis } = await import('../api/_lib/store.js').catch(() => ({}))
if (!redis) {
  console.error('No database credentials: add the REST URL and token to .env.moderation (see the top of this script).')
  process.exit(1)
}
// Also after the env file loads, since it imports the store too
const { approve, pending, remove } = await import('../api/_lib/moderation.js')

const [command = 'pending', id] = process.argv.slice(2)

// A rough picture of a doodle, COLS × ROWS characters, so a rude one is easy to spot
const COLS = 48
const ROWS = 24
function sketch(doodle) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(' '))
  const plot = (x, y) => (grid[Math.min(ROWS - 1, Math.floor((y / GRID) * ROWS))][Math.min(COLS - 1, Math.floor((x / GRID) * COLS))] = '#')
  for (const { points } of doodle) {
    plot(points[0], points[1])
    for (let i = 2; i < points.length; i += 2) {
      const [x0, y0, x1, y1] = [points[i - 2], points[i - 1], points[i], points[i + 1]]
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2) || 1
      for (let n = 1; n <= steps; n++) plot(x0 + ((x1 - x0) * n) / steps, y0 + ((y1 - y0) * n) / steps)
    }
  }
  const border = '+' + '-'.repeat(COLS) + '+'
  return [border, ...grid.map((row) => '|' + row.join('') + '|'), border].join('\n')
}

function show(r) {
  const stars = r.rating ? `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}` : '(no stars)'
  console.log(`${r.id}  ${stars}  ${r.name}: ${r.comment || '(no comment)'}`)
  if (r.doodle?.length) console.log(sketch(r.doodle))
}

if (command === 'pending') {
  const waiting = await pending(redis)
  if (!waiting.length) console.log('Nothing waiting for approval.')
  waiting.forEach(show)
} else if (command === 'published') {
  ;(await redis.lrange(KEYS.reviews, 0, -1)).forEach(show)
} else if (command === 'approve' && id) {
  // Oldest first, so the list stays in signing order
  const ids = id === 'all' ? (await pending(redis)).map((r) => r.id) : [id]
  for (const key of ids) {
    if (await approve(redis, key)) console.log(`Approved ${key}`)
    else console.error(`No pending entry ${key}`)
  }
} else if (command === 'delete' && id) {
  if (!(await remove(redis, id))) {
    console.error(`No entry ${id}`)
    process.exit(1)
  }
  console.log(`Deleted ${id}`)
} else {
  console.log('Usage: npm run reviews [-- pending | published | approve <id|all> | delete <id>]')
}
