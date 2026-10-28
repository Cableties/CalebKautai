import assert from 'node:assert/strict'
import { test } from 'node:test'
import { approach, mix, mixPalette, themeAt } from '../../src/lib/themes.js'

const THEMES = [
  { sky: '#000000', list: ['#ffffff'], amount: 0, kind: 'a' },
  { sky: '#ffffff', list: ['#000000'], amount: 1, kind: 'b' },
  { sky: '#ff0000', list: ['#00ff00'], amount: 2, kind: 'c' },
]

test('themes: colours and palettes mix', () => {
  assert.equal(mix('#000000', '#ffffff', 0), '#000000')
  assert.equal(mix('#000000', '#ffffff', 1), '#ffffff')
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080')
  assert.deepEqual(mixPalette(THEMES[0], THEMES[1], 0.25), { sky: '#404040', list: ['#bfbfbf'], amount: 0.25, kind: 'a' })
  assert.equal(mixPalette(THEMES[0], THEMES[1], 0.75).kind, 'b')
})

test('themes: each holds, then changes into the next, going round', () => {
  assert.deepEqual(themeAt(THEMES, 0.5, 0.2).palette, THEMES[0]) // still holding
  assert.ok(Math.abs(themeAt(THEMES, 0.9, 0.2).t - 0.5) < 1e-9) // halfway through the change
  assert.deepEqual(themeAt(THEMES, 1).palette, THEMES[1])
  assert.deepEqual(themeAt(THEMES, 3).palette, THEMES[0]) // back round to the first
  const last = themeAt(THEMES, 2.5)
  assert.equal(last.from, 2)
  assert.equal(last.to, 0)
})

test('themes: a new level fades in, and a new game snaps back', () => {
  assert.equal(approach(0, 1, 0.5, 1), 0.5)
  assert.equal(approach(0.5, 1, 1, 1), 1)
  assert.equal(approach(3, 0, 0.1), 0)
})
