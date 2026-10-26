// Moderate tattoo-page reviews from the terminal.
//   npm run reviews                 list reviews waiting for approval
//   npm run reviews -- approve <id> publish one (or `approve all`)
//   npm run reviews -- delete <id>  remove a pending or published review, and its rating
//   npm run reviews -- published    list published reviews
// Needs the database credentials: run `vercel env pull .env.local` once first.
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const { KEYS, redis } = await import('../api/_lib/store.js')
if (!redis) {
  console.error('No database credentials. Run `vercel env pull .env.local` first.')
  process.exit(1)
}

const [command = 'pending', id] = process.argv.slice(2)
const show = (r) => console.log(`${r.id}  ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}  ${r.name}: ${r.comment || '(no comment)'}`)

if (command === 'pending') {
  const pending = Object.values((await redis.hgetall(KEYS.pending)) ?? {})
  if (!pending.length) console.log('Nothing waiting for approval.')
  pending.forEach(show)
} else if (command === 'published') {
  ;(await redis.lrange(KEYS.reviews, 0, -1)).forEach(show)
} else if (command === 'approve' && id) {
  const pending = (await redis.hgetall(KEYS.pending)) ?? {}
  const ids = id === 'all' ? Object.keys(pending) : [id]
  for (const key of ids) {
    if (!pending[key]) {
      console.error(`No pending review ${key}`)
      continue
    }
    await redis.lpush(KEYS.reviews, pending[key])
    await redis.hdel(KEYS.pending, key)
    console.log(`Approved ${key}`)
  }
} else if (command === 'delete' && id) {
  let review = await redis.hget(KEYS.pending, id)
  if (review) {
    await redis.hdel(KEYS.pending, id)
  } else {
    review = (await redis.lrange(KEYS.reviews, 0, -1)).find((r) => r.id === id)
    if (review) await redis.lrem(KEYS.reviews, 1, review)
  }
  if (!review) {
    console.error(`No review ${id}`)
    process.exit(1)
  }
  await redis.hincrby(KEYS.stats, 'count', -1)
  await redis.hincrby(KEYS.stats, 'total', -review.rating)
  console.log(`Deleted ${id}`)
} else {
  console.log('Usage: npm run reviews [-- pending | published | approve <id|all> | delete <id>]')
}
