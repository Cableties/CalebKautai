// Tattoo scan counter. GET returns the count; POST records a scan and returns the new count.
// The page only POSTs once per browser session, and each visitor counts at most once per 10 minutes.
import { KEYS, allow, noStorage, redis } from './_lib/store.js'

export default async function handler(req, res) {
  if (!redis) return noStorage(res)
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    return res.json({ count: Number((await redis.get(KEYS.scans)) ?? 0) })
  }
  if (req.method === 'POST') {
    const count = (await allow('scan', req, 600))
      ? await redis.incr(KEYS.scans)
      : Number((await redis.get(KEYS.scans)) ?? 0)
    return res.json({ count })
  }
  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed' })
}
