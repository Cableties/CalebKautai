import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LIMITS, parseReview, summarise } from '../../api/_lib/reviews.js'

test('accepts a rating on its own and names it anonymously', () => {
  assert.deepEqual(parseReview({ rating: 5 }), { review: { rating: 5, name: 'Anonymous victim', comment: '' } })
})

test('rejects ratings outside 1–5 or not whole numbers', () => {
  for (const rating of [0, 6, 2.5, 'lots', undefined]) {
    assert.ok(parseReview({ rating }).error, `rating ${rating}`)
  }
})

test('rejects anything that fills the honeypot', () => {
  assert.ok(parseReview({ rating: 4, website: 'http://spam.example' }).error)
})

test('rejects a missing body', () => {
  assert.ok(parseReview(null).error)
  assert.ok(parseReview('5 stars').error)
})

test('tidies whitespace, strips control characters and trims to length', () => {
  const { review } = parseReview({
    rating: '3',
    name: '  Kev\u0000in  ' + 'x'.repeat(100),
    comment: 'so\n\ncool   ' + 'y'.repeat(500),
  })
  assert.equal(review.rating, 3)
  assert.ok(review.name.startsWith('Kev in'))
  assert.equal(review.name.length, LIMITS.name)
  assert.ok(review.comment.startsWith('so cool'))
  assert.equal(review.comment.length, LIMITS.comment)
})

test('summarises ratings to one decimal place', () => {
  assert.deepEqual(summarise({ count: '3', total: '13' }), { count: 3, average: 4.3 })
  assert.deepEqual(summarise(null), { count: 0, average: null })
})
