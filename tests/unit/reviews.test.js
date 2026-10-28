import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOODLE, GRID, INKS, parseDoodle, strokePath } from '../../api/_lib/doodle.js'
import { LIMITS, parseReview, summarise } from '../../api/_lib/reviews.js'

const line = { ink: 0, points: [10, 10, 50, 60] }

test('accepts a rating on its own and names it anonymously', () => {
  assert.deepEqual(parseReview({ rating: 5 }), { review: { rating: 5, name: 'Anonymous', comment: '', doodle: [] } })
})

test('stars are optional when there is a comment or a doodle', () => {
  assert.deepEqual(parseReview({ comment: 'nice' }).review, { rating: null, name: 'Anonymous', comment: 'nice', doodle: [] })
  assert.deepEqual(parseReview({ rating: 0, doodle: [line] }).review, { rating: null, name: 'Anonymous', comment: '', doodle: [line] })
})

test('needs stars, a comment or a doodle', () => {
  assert.ok(parseReview({}).error)
  assert.ok(parseReview({ name: 'Kev', comment: '   ', doodle: [] }).error)
})

test('rejects ratings outside 1–5 or not whole numbers', () => {
  for (const rating of [-1, 6, 2.5, 'lots']) {
    assert.ok(parseReview({ rating, comment: 'hi' }).error, `rating ${rating}`)
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

test('doodles only take whole-number points on the grid, in one of the inks', () => {
  for (const bad of [
    { ink: INKS.length, points: [1, 1] },
    { ink: -1, points: [1, 1] },
    { ink: 0.5, points: [1, 1] },
    { ink: 0, points: [1] }, // half a point
    { ink: 0, points: [] },
    { ink: 0, points: [1, GRID + 1] },
    { ink: 0, points: [1.5, 2] },
    { ink: 0, points: ['1', 2] },
    { ink: 0, points: [-1, 2] },
    { ink: '0', points: [1, 2] },
    null,
  ]) {
    assert.equal(parseDoodle([bad]), null, JSON.stringify(bad))
  }
  assert.equal(parseDoodle('M0 0 L10 10'), null)
  assert.ok(parseReview({ rating: 5, doodle: [{ ink: 9, points: [1, 1] }] }).error)
})

test('doodles can have fills and eraser marks', () => {
  const marks = [line, { tool: 'fill', ink: 2, points: [100, 100] }, { tool: 'erase', points: [10, 10, 40, 40] }]
  assert.deepEqual(parseDoodle(marks), marks)
  // The eraser has no colour to keep
  assert.deepEqual(parseDoodle([{ tool: 'erase', ink: 3, points: [1, 1] }]), [{ tool: 'erase', points: [1, 1] }])
  for (const bad of [
    { tool: 'fill', ink: 0, points: [1, 1, 2, 2] }, // a fill is one point
    { tool: 'fill', points: [1, 1] }, // in a colour
    { tool: 'spray', ink: 0, points: [1, 1] },
  ]) {
    assert.equal(parseDoodle([bad]), null, JSON.stringify(bad))
  }
})

test('doodles drop anything extra on a stroke', () => {
  assert.deepEqual(parseDoodle([{ ...line, colour: 'red', onclick: 'x' }]), [line])
})

test('doodles are capped in strokes and points', () => {
  assert.equal(parseDoodle(Array(DOODLE.strokes + 1).fill({ ink: 0, points: [1, 1] })), null)
  assert.equal(parseDoodle([{ ink: 0, points: Array((DOODLE.points + 1) * 2).fill(5) }]), null)
  assert.ok(parseDoodle([{ ink: 0, points: Array(DOODLE.points * 2).fill(5) }]))
})

test('strokes become SVG paths, with a dot for a single point', () => {
  assert.equal(strokePath([10, 10, 50, 60, 70, 80]), 'M10 10L50 60L70 80')
  assert.equal(strokePath([5, 6]), 'M5 6l0.01 0')
})
