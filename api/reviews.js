// Star reviews for the tattoo page.
// GET returns the average, the count and the latest approved reviews. POST adds one.
// Every rating counts towards the average straight away; written comments wait in a pending list
// until approved with scripts/reviews.mjs, unless REVIEWS_AUTO_APPROVE=1 is set.
import { randomUUID } from 'node:crypto'
import { KEYS, allow, noStorage, redis } from './_lib/store.js'
import { parseReview, summarise } from './_lib/reviews.js'

const SHOWN = 20

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
    if (!(await allow('review', req, 60 * 60 * 24))) {
      return res.status(429).json({ error: "You've already left a review today. Come back tomorrow." })
    }

    const entry = { id: randomUUID(), ...review, createdAt: new Date().toISOString() }
    // A star rating with no comment has nothing to moderate, so it's approved straight away.
    const approved = !entry.comment || process.env.REVIEWS_AUTO_APPROVE === '1'
    await Promise.all([
      redis.hincrby(KEYS.stats, 'count', 1),
      redis.hincrby(KEYS.stats, 'total', entry.rating),
      approved ? redis.lpush(KEYS.reviews, entry) : redis.hset(KEYS.pending, { [entry.id]: entry }),
    ])
    return res.status(201).json({ approved })
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed' })
}
