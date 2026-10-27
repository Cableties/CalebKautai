// The guestbook approval page's API (the page is src/pages/GuestbookAdmin.jsx).
// GET ?id=…&sig=…  one entry, from a "Review it" link
// GET ?key=…       everything waiting for approval
// POST { action: 'approve' | 'delete', id, sig or key }
// Every request needs a signature or key made with MODERATION_SECRET (see api/_lib/moderation.js).
import { noStorage, redis } from './_lib/store.js'
import { approve, find, pending, remove, verify } from './_lib/moderation.js'

export default async function handler(req, res) {
  if (!redis) return noStorage(res)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex')
  const secret = process.env.MODERATION_SECRET
  if (!secret) return res.status(503).json({ error: 'Moderation is not configured' })

  const params = req.method === 'POST' ? (req.body ?? {}) : req.query
  const { id, sig, key } = params
  const hasKey = verify('list:pending', key, secret)
  const allowed = hasKey || (typeof id === 'string' && verify(id, sig, secret))
  if (!allowed) return res.status(403).json({ error: 'That link has expired or is wrong.' })

  if (req.method === 'GET') {
    if (!id) return res.json({ entries: await pending(redis) })
    const found = await find(redis, id)
    return found ? res.json(found) : res.status(404).json({ error: 'That entry has already been deleted.' })
  }

  if (req.method === 'POST') {
    if (typeof id !== 'string') return res.status(400).json({ error: 'Which entry?' })
    if (params.action === 'approve') {
      const done = await approve(redis, id)
      return done ? res.json({ state: 'published' }) : res.status(409).json({ error: "It's not waiting any more (already approved, or deleted)." })
    }
    if (params.action === 'delete') {
      const done = await remove(redis, id)
      return done ? res.json({ state: 'deleted' }) : res.status(404).json({ error: 'That entry has already been deleted.' })
    }
    return res.status(400).json({ error: 'Approve or delete?' })
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed' })
}
