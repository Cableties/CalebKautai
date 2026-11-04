import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as d from '../../src/lib/drawing.js'

test('drawing: undo and redo step back and forth, and drawing something new forgets the redos', () => {
  const [a, b, c] = [{ points: [1, 1] }, { points: [2, 2] }, { points: [3, 3] }]
  let h = d.add(d.add(d.history(), a), b)
  assert.deepEqual(h.marks, [a, b])
  h = d.undo(h)
  assert.deepEqual(h.marks, [a])
  h = d.redo(h)
  assert.deepEqual(h.marks, [a, b])
  h = d.add(d.undo(h), c)
  assert.deepEqual(h.marks, [a, c])
  assert.equal(d.redo(h), h)
  // Nothing to undo at the start
  const fresh = d.history()
  assert.equal(d.undo(fresh), fresh)
})

test('drawing: clearing can be undone, and an empty sheet has nothing to clear', () => {
  const marks = [{ points: [1, 1] }, { points: [2, 2] }]
  let h = d.clear(d.add(d.history([marks[0]]), marks[1]))
  assert.deepEqual(h.marks, [])
  h = d.undo(h)
  assert.deepEqual(h.marks, marks)
  const empty = d.history()
  assert.equal(d.clear(empty), empty)
})

test('drawing: only so many undos are kept', () => {
  let h = d.history()
  for (let i = 0; i < d.UNDOS + 50; i++) h = d.add(h, { points: [i, i] })
  assert.equal(h.past.length, d.UNDOS)
  for (let i = 0; i < d.UNDOS + 50; i++) h = d.undo(h)
  assert.equal(h.marks.length, 50)
})

test('drawing: a pencil line follows the pointer, a straight one just moves its end, and tiny wiggles are ignored', () => {
  const pencil = d.startMark('pencil', { colour: '#123456', size: 1 }, [10, 10])
  assert.deepEqual(pencil, { colour: '#123456', size: d.sizeFor('pencil', 1), points: [10, 10] })
  assert.equal(d.extendMark('pencil', pencil, [10.5, 10]), false)
  d.extendMark('pencil', pencil, [20, 10])
  d.extendMark('pencil', pencil, [30, 10])
  assert.deepEqual(pencil.points, [10, 10, 20, 10, 30, 10])

  const straight = d.startMark('line', { colour: '#123456', size: 0 }, [10, 10])
  d.extendMark('line', straight, [20, 10])
  d.extendMark('line', straight, [40, 40])
  assert.deepEqual(straight.points, [10, 10, 40, 40])
  assert.equal(straight.tool, undefined) // drawn in pencil

  assert.equal(d.startMark('marker', { colour: '#123456', size: 3 }, [0, 0]).size, d.sizeFor('marker', 3))
  assert.deepEqual(d.startMark('erase', { colour: '#123456', size: 0 }, [5, 5]), { tool: 'erase', size: d.sizeFor('erase', 0), points: [5, 5] })
  assert.deepEqual(d.startMark('fill', { colour: '#123456', size: 0 }, [5, 5]), { tool: 'fill', colour: '#123456', points: [5, 5] })
})

test('drawing: sizes grow, and every tool has one for each size', () => {
  for (const tool of ['pencil', 'marker', 'erase', 'line']) {
    const sizes = d.SIZE_NAMES.map((_, i) => d.sizeFor(tool, i))
    assert.ok(sizes.every((s, i) => s > 0 && (i === 0 || s > sizes[i - 1])), tool)
  }
})

test("drawing: a saved drawing comes back, leaving out anything that isn't a mark", () => {
  const good = { colour: '#abcdef', size: 3, points: [1, 2, 3, 4] }
  const saved = d.parseSaved({
    sheet: 'portrait',
    paper: 'grid',
    marks: [good, { tool: 'erase', points: [1, 1] }, { ink: 2, points: [5, 5] }, { colour: 'red', points: [1, 1] }, { colour: '#abcdef', points: [1] }, null],
  })
  assert.equal(saved.sheet, 'portrait')
  assert.equal(saved.paper, 'grid')
  assert.equal(saved.marks.length, 3)
  assert.deepEqual(d.parseSaved({ sheet: 'huge', paper: 'gold', marks: [] }), { sheet: 'square', paper: 'sketch', marks: [] })
  assert.equal(d.parseSaved(null), null)
  assert.equal(d.parseSaved({ marks: 'lots' }), null)
})

test('drawing: the download is named for the day, and an idea is never the same one twice running', () => {
  assert.equal(d.fileName(new Date(2026, 10, 4)), 'drawing-2026-11-04.png')
  for (const r of [0, 0.5, 0.999]) {
    const first = d.idea(() => r)
    assert.ok(d.IDEAS.includes(first))
    assert.notEqual(d.idea(() => r, first), first)
  }
  assert.equal(new Set(d.COLOURS.map((c) => c.colour)).size, d.COLOURS.length)
})
