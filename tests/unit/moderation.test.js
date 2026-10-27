import assert from 'node:assert/strict'
import { test } from 'node:test'
import { approve, entryLink, find, listKey, listLink, notificationEmail, notify, pending, remove, sign, siteBase, verify } from '../../api/_lib/moderation.js'
import { KEYS } from '../../api/_lib/store.js'

const SECRET = 'test-secret'

// Just enough of the Upstash client for the moderation helpers, in memory
function fakeRedis() {
  const hashes = { [KEYS.pending]: {}, [KEYS.stats]: { count: 0, total: 0 } }
  const lists = { [KEYS.reviews]: [] }
  const copy = (v) => structuredClone(v)
  return {
    hashes,
    lists,
    hget: async (k, f) => copy(hashes[k][f] ?? null),
    hgetall: async (k) => copy(hashes[k]),
    hset: async (k, v) => Object.assign(hashes[k], copy(v)),
    hdel: async (k, f) => (f in hashes[k] ? (delete hashes[k][f], 1) : 0),
    hincrby: async (k, f, by) => (hashes[k][f] += by),
    lpush: async (k, v) => lists[k].unshift(copy(v)),
    lrange: async (k) => copy(lists[k]),
    lrem: async (k, n, v) => {
      const i = lists[k].findIndex((x) => JSON.stringify(x) === JSON.stringify(v))
      if (i < 0) return 0
      lists[k].splice(i, 1)
      return 1
    },
  }
}

const entry = (id, extra) => ({ id, name: 'Kev', rating: 4, comment: 'nice', doodle: [], createdAt: `2026-10-0${id.length}T00:00:00Z`, ...extra })

test('signatures check out only for the same value and secret', () => {
  const sig = sign('abc', SECRET)
  assert.ok(verify('abc', sig, SECRET))
  assert.equal(verify('abd', sig, SECRET), false)
  assert.equal(verify('abc', sig, 'other-secret'), false)
  assert.equal(verify('abc', sig.slice(1), SECRET), false)
  assert.equal(verify('abc', undefined, SECRET), false)
  assert.equal(verify('abc', sig, undefined), false)
})

test("the list key isn't any entry's signature", () => {
  assert.ok(verify('list:pending', listKey(SECRET), SECRET))
  assert.notEqual(listKey(SECRET), sign('anything', SECRET))
})

test('links go to the approval page, signed', () => {
  const review = new URL(entryLink('https://example.com', 'id 1', SECRET))
  assert.equal(review.pathname, '/guestbook-admin')
  assert.equal(review.searchParams.get('id'), 'id 1')
  assert.ok(verify('id 1', review.searchParams.get('sig'), SECRET))
  assert.ok(verify('list:pending', new URL(listLink('https://example.com', SECRET)).searchParams.get('key'), SECRET))
})

test('approving moves an entry from pending to the guestbook, once', async () => {
  const redis = fakeRedis()
  redis.hashes[KEYS.pending].a = entry('a')
  assert.equal(await approve(redis, 'a'), true)
  assert.deepEqual(redis.lists[KEYS.reviews], [entry('a')])
  assert.deepEqual(redis.hashes[KEYS.pending], {})
  assert.equal(await approve(redis, 'a'), false)
})

test('deleting takes the entry and its stars out, wherever it is', async () => {
  const redis = fakeRedis()
  redis.hashes[KEYS.stats] = { count: 3, total: 12 }
  redis.hashes[KEYS.pending].a = entry('a')
  redis.lists[KEYS.reviews].push(entry('bb', { rating: null }))
  assert.equal(await remove(redis, 'a'), true)
  assert.deepEqual(redis.hashes[KEYS.stats], { count: 2, total: 8 })
  // No stars, so the average doesn't change
  assert.equal(await remove(redis, 'bb'), true)
  assert.deepEqual(redis.hashes[KEYS.stats], { count: 2, total: 8 })
  assert.deepEqual(redis.lists[KEYS.reviews], [])
  assert.equal(await remove(redis, 'a'), false)
  assert.equal(await find(redis, 'a'), null)
})

test('the waiting list is oldest first', async () => {
  const redis = fakeRedis()
  redis.hashes[KEYS.pending] = { ccc: entry('ccc'), a: entry('a'), bb: entry('bb') }
  assert.deepEqual((await pending(redis)).map((e) => e.id), ['a', 'bb', 'ccc'])
})

test('the email shows the entry, escaped, with both links', () => {
  const email = notificationEmail(entry('a', { name: '<b>Kev</b>', comment: 'hi & "bye"', doodle: [{ ink: 0, points: [1, 1] }] }), {
    review: 'https://example.com/guestbook-admin?id=a&sig=x',
    list: 'https://example.com/guestbook-admin?key=y',
  })
  assert.equal(email.subject, 'Guestbook: <b>Kev</b> left a comment')
  assert.ok(email.html.includes('&#60;b&#62;Kev&#60;/b&#62;'))
  assert.ok(!email.html.includes('<b>Kev'))
  assert.ok(email.html.includes('hi &#38; &#34;bye&#34;'))
  assert.ok(email.html.includes('★★★★☆'))
  assert.ok(email.html.includes('doodle'))
  assert.ok(email.html.includes('?id=a&#38;sig=x'))
  assert.ok(email.text.includes('Review it: https://example.com/guestbook-admin?id=a&sig=x'))
  assert.ok(email.text.includes('Everything waiting: https://example.com/guestbook-admin?key=y'))
})

test('a doodle-only entry says so in the subject', () => {
  assert.equal(notificationEmail(entry('a', { comment: '', rating: null }), { review: '', list: '' }).subject, 'Guestbook: Kev left a doodle')
})

test('links use the site address from settings, not the request', () => {
  const req = { headers: { host: 'evil.example' } }
  assert.equal(siteBase(req, { SITE_URL: 'https://calebkautai.com/' }), 'https://calebkautai.com')
  assert.equal(siteBase(req, { VERCEL_PROJECT_PRODUCTION_URL: 'caleb-kautai.vercel.app' }), 'https://caleb-kautai.vercel.app')
})

test('notify sends through Resend when set up, and never throws', async (t) => {
  const env = { RESEND_API_KEY: 're_test', MODERATION_EMAIL: 'me@example.com', MODERATION_SECRET: SECRET }
  assert.equal(await notify(entry('a'), 'https://example.com', { ...env, RESEND_API_KEY: '' }), false)

  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    calls.push([url, opts])
    return new Response('{}', { status: 200 })
  })
  assert.equal(await notify(entry('a'), 'https://example.com', env), true)
  const [url, opts] = calls[0]
  assert.equal(url, 'https://api.resend.com/emails')
  assert.equal(opts.headers.Authorization, 'Bearer re_test')
  const body = JSON.parse(opts.body)
  assert.equal(body.to, 'me@example.com')
  assert.equal(body.from, 'Guestbook <onboarding@resend.dev>')
  assert.ok(body.text.includes(entryLink('https://example.com', 'a', SECRET)))

  t.mock.method(console, 'error', () => {})
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('offline')
  })
  assert.equal(await notify(entry('a'), 'https://example.com', env), false)
})
