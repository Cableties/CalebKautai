// Review validation, kept free of storage code so it can be unit tested.
export const LIMITS = { name: 40, comment: 280 }

// Returns { review } or { error }. `website` is a honeypot field that real visitors never see.
export function parseReview(body) {
  if (!body || typeof body !== 'object') return { error: 'Invalid request' }
  if (body.website) return { error: 'Invalid request' }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Pick between 1 and 5 stars' }

  const clean = (v, max) =>
    String(v ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
  const name = clean(body.name, LIMITS.name)
  const comment = clean(body.comment, LIMITS.comment)

  return { review: { rating, name: name || 'Anonymous victim', comment } }
}

export function summarise(stats) {
  const count = Number(stats?.count ?? 0)
  const total = Number(stats?.total ?? 0)
  return { count, average: count ? Math.round((total / count) * 10) / 10 : null }
}
