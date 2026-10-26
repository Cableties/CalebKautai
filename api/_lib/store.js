// Shared by the /api functions (files under _lib aren't deployed as routes).
import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'

// Vercel's Upstash integration sets KV_REST_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
export const redis = url && token ? new Redis({ url, token }) : null

export const KEYS = {
  scans: 'tattoo:scans',
  reviews: 'reviews:approved', // list of JSON reviews, newest first
  pending: 'reviews:pending', // hash: id → JSON review awaiting approval
  stats: 'reviews:stats', // hash: count, total (every rating, approved or not)
}

// Rate limits key on a salted hash of the visitor's IP, so raw IPs are never stored.
export function visitorId(req) {
  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
  return createHash('sha256')
    .update(ip + (process.env.VISITOR_SALT ?? token ?? ''))
    .digest('hex')
    .slice(0, 32)
}

// Returns true if this visitor hasn't done `action` within `seconds`, and records that they now have.
export async function allow(action, req, seconds) {
  return (await redis.set(`rl:${action}:${visitorId(req)}`, 1, { nx: true, ex: seconds })) === 'OK'
}

export function noStorage(res) {
  res.status(503).json({ error: 'Storage is not configured' })
}
