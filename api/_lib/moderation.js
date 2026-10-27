// Guestbook moderation, shared by the approval page's API (api/moderate.js) and scripts/reviews.mjs.
// Links in the notification email are signed with MODERATION_SECRET, so only someone holding one can
// see or act on a pending entry: a per-entry signature for "Review it", and a key for the full list.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { KEYS } from './store.js'

export const PAGE = '/guestbook-admin'

export const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url')
// The list key is a signature of a fixed word, so it can't be mistaken for an entry's
export const listKey = (secret) => sign('list:pending', secret)

export function verify(value, signature, secret) {
  if (!secret || typeof signature !== 'string') return false
  const expected = Buffer.from(sign(value, secret))
  const given = Buffer.from(signature)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export const entryLink = (base, id, secret) => `${base}${PAGE}?id=${encodeURIComponent(id)}&sig=${sign(id, secret)}`
export const listLink = (base, secret) => `${base}${PAGE}?key=${listKey(secret)}`

export async function pending(redis) {
  return Object.values((await redis.hgetall(KEYS.pending)) ?? {}).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// Returns the entry and where it is ('pending' or 'published'), or null
export async function find(redis, id) {
  const waiting = await redis.hget(KEYS.pending, id)
  if (waiting) return { entry: waiting, state: 'pending' }
  const published = (await redis.lrange(KEYS.reviews, 0, -1)).find((r) => r.id === id)
  return published ? { entry: published, state: 'published' } : null
}

// Puts a pending entry up. Returns false if it isn't pending (already approved, or deleted).
export async function approve(redis, id) {
  const entry = await redis.hget(KEYS.pending, id)
  if (!entry) return false
  await redis.lpush(KEYS.reviews, entry)
  await redis.hdel(KEYS.pending, id)
  return true
}

// Removes a pending or published entry, and its stars from the average. Returns false if not found.
export async function remove(redis, id) {
  const found = await find(redis, id)
  if (!found) return false
  if (found.state === 'pending') await redis.hdel(KEYS.pending, id)
  else await redis.lrem(KEYS.reviews, 1, found.entry)
  if (found.entry.rating) {
    await redis.hincrby(KEYS.stats, 'count', -1)
    await redis.hincrby(KEYS.stats, 'total', -found.entry.rating)
  }
  return true
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// The "someone signed the guestbook" email. Email apps don't show SVG, so a doodle is mentioned
// rather than drawn; the page shows it.
export function notificationEmail(entry, { review, list }) {
  const stars = entry.rating ? '★'.repeat(entry.rating) + '☆'.repeat(5 - entry.rating) : null
  const parts = [stars, entry.comment && `“${entry.comment}”`, entry.doodle?.length && 'a doodle'].filter(Boolean)
  const subject = `Guestbook: ${entry.name} left ${entry.comment ? 'a comment' : 'a doodle'}`
  const text = [
    `${entry.name} signed the guestbook.`,
    '',
    ...parts,
    '',
    `Review it: ${review}`,
    `Everything waiting: ${list}`,
  ].join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#2e2a45;max-width:480px">
<p><strong>${escape(entry.name)}</strong> signed the guestbook.</p>
${stars ? `<p style="color:#e9a800;font-size:20px;margin:0">${stars}</p>` : ''}
${entry.comment ? `<p style="padding:12px 16px;background:#f6f1f4;border-radius:8px">${escape(entry.comment)}</p>` : ''}
${entry.doodle?.length ? '<p>They drew you a doodle. Open it to see it.</p>' : ''}
<p><a href="${escape(review)}" style="display:inline-block;padding:12px 22px;background:#2e2a45;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">Review it</a></p>
<p style="font-size:14px"><a href="${escape(list)}" style="color:#c2407e">See everything waiting</a></p>
</div>`
  return { subject, text, html }
}

// Sends the email through Resend. Never throws: a failed email mustn't lose the entry, which is
// already saved and still shows up in the list and `npm run reviews`.
export async function notify(entry, base, env = process.env) {
  const { RESEND_API_KEY: key, MODERATION_EMAIL: to, MODERATION_SECRET: secret } = env
  if (!key || !to || !secret) return false
  const email = notificationEmail(entry, { review: entryLink(base, entry.id, secret), list: listLink(base, secret) })
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MODERATION_FROM || 'Guestbook <onboarding@resend.dev>', to, ...email }),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) console.error('Guestbook email failed', res.status, await res.text().catch(() => ''))
    return res.ok
  } catch (err) {
    console.error('Guestbook email failed', err)
    return false
  }
}

// The site's own address, for links in the email. SITE_URL if set, else the production domain Vercel
// provides, so the link never depends on a header the visitor sent.
export function siteBase(req, env = process.env) {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/$/, '')
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
  return `https://${req.headers.host}`
}
