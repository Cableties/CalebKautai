// The tattoo page's guestbook: star ratings, comments and doodles.
// GET returns the average, the count and the latest approved entries. POST adds one.
// Every rating counts towards the average straight away. Anything else (a comment or a doodle)
// waits in a pending list until approved, unless REVIEWS_AUTO_APPROVE=1: an email (if set up) links
// to the approval page, or use scripts/reviews.mjs.
import { randomUUID } from 'node:crypto'
import { KEYS, allow, noStorage, redis } from './_lib/store.js'
import { notify, siteBase } from './_lib/moderation.js'
import { parseReview, summarise } from './_lib/reviews.js'

const SHOWN = 30
const MAX_PENDING = 300 // stop taking comments and doodles if nobody's moderating

export default async function handler(req, res) {
  if (!redis) return noStorage(res)
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    const [stats, reviews] = await Promise.all([redis.hgetall(KEYS.stats), redis.lrange(KEYS.reviews, 0, SHOWN - 1)])
    return res.json({ ...summarise(stats), reviews })
  }

  if (req.method === 'POST') {
    const { review, error } = parseReview(req.body)
    if (error) return res.status(400).json({ error })
    // Stars alone have nothing to moderate, so they're approved straight away
    const approved = (!review.comment && !review.doodle.length) || process.env.REVIEWS_AUTO_APPROVE === '1'
    if (!approved && (await redis.hlen(KEYS.pending)) >= MAX_PENDING) {
      return res.status(503).json({ error: "The guestbook's full right now. Try again in a few days." })
    }
    if (!(await allow('review', req, 60 * 60 * 24))) {
      return res.status(429).json({ error: "You've already signed today. Come back tomorrow." })
    }

    const entry = { id: randomUUID(), ...review, createdAt: new Date().toISOString() }
    await Promise.all([
      ...(entry.rating ? [redis.hincrby(KEYS.stats, 'count', 1), redis.hincrby(KEYS.stats, 'total', entry.rating)] : []),
      approved ? redis.lpush(KEYS.reviews, entry) : redis.hset(KEYS.pending, { [entry.id]: entry }),
    ])
    // Awaited, since Vercel can stop the function once it responds. It gives up after a few seconds.
    if (!approved) await notify(entry, siteBase(req))
    return res.status(201).json({ approved })
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed' })
}
