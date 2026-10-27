// Guestbook entry (review) validation, kept free of storage code so it can be unit tested.
// An entry can have stars, a comment, a doodle, or any mix of them, but not none.
import { parseDoodle } from './doodle.js'

export const LIMITS = { name: 40, comment: 280 }

// Returns { review } or { error }. `website` is a honeypot field that real visitors never see.
export function parseReview(body) {
  if (!body || typeof body !== 'object') return { error: 'Invalid request' }
  if (body.website) return { error: 'Invalid request' }

  // No stars is fine; stars that aren't 1–5 aren't
  let rating = null
  if (body.rating != null && body.rating !== '' && body.rating !== 0) {
    rating = Number(body.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Pick between 1 and 5 stars' }
  }

  const doodle = parseDoodle(body.doodle)
  if (!doodle) return { error: "That drawing didn't come through. Try again." }

  const clean = (v, max) =>
    String(v ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
  const name = clean(body.name, LIMITS.name)
  const comment = clean(body.comment, LIMITS.comment)
  if (!rating && !comment && !doodle.length) return { error: 'Leave some stars, a comment or a doodle first.' }

  return { review: { rating, name: name || 'Anonymous', comment, doodle } }
}

export function summarise(stats) {
  const count = Number(stats?.count ?? 0)
  const total = Number(stats?.total ?? 0)
  return { count, average: count ? Math.round((total / count) * 10) / 10 : null }
}
