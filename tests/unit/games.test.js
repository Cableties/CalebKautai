import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GAMES, board, cleanInitials, parseScore, runStart, startRun } from '../../api/_lib/scores.js'
import { HOLES, MAX_SCORE, ROUND_MS, UP_MS, nextHole, upTime } from '../../src/lib/bonk.js'
import * as flappy from '../../src/lib/flappy.js'
import * as pinball from '../../src/lib/pinball.js'

const { FLAP, GROUND, HEAD_X, HEIGHT, PIPE_WIDTH, RADIUS, SECONDS_PER_PIPE, SPACING, WIDTH } = flappy
const half = () => 0.5

// Run the game for `seconds` in 60fps steps, calling `each` (which may flap) every frame
function play(state, seconds, each = (s) => s) {
  for (let t = 0; t < seconds && !state.dead; t += 1 / 60) state = flappy.step(each(state), 1 / 60, half)
  return state
}

test('flappy: without flapping, the head falls and hits the ground', () => {
  const end = play(flappy.start({}, half), 5)
  assert.equal(end.dead, true)
  assert.equal(end.y, HEIGHT - GROUND - RADIUS)
})

test('flappy: a flap sends it up, and the ceiling stops it without ending the game', () => {
  let s = flappy.flap(flappy.start({}, half))
  assert.equal(s.vy, FLAP)
  s = flappy.step(s, 1 / 60, half)
  assert.ok(s.y < HEIGHT * 0.42)
  // Flap every frame: pinned to the top, still alive (until a pipe arrives)
  s = play(flappy.start({}, half), 1, flappy.flap)
  assert.equal(s.dead, false)
  assert.equal(s.y, RADIUS)
})

test('flappy: staying in the middle of each gap scores a point per pipe', () => {
  // Steer: flap whenever below the next gap's middle. With every gap centred (random = 0.5) that's
  // enough to fly through for a while.
  const steer = (s) => {
    const next = s.pipes.find((p) => p.x + PIPE_WIDTH >= HEAD_X - s.radius) ?? s.pipes[0]
    return s.y > next.gapY + 10 && s.vy > 0 ? flappy.flap(s) : s
  }
  const end = play(flappy.start({}, half), 20, steer)
  assert.equal(end.dead, false)
  // Pipes arrive every SECONDS_PER_PIPE after the first reaches the head
  const firstArrives = (WIDTH + 80 + PIPE_WIDTH - (HEAD_X - RADIUS)) / flappy.SPEED
  assert.equal(end.score, Math.floor((20 - firstArrives) / SECONDS_PER_PIPE) + 1)
})

test('flappy: pipes keep coming at the same spacing, and old ones are dropped', () => {
  let s = flappy.start({}, half)
  for (let i = 0; i < 600; i++) s = flappy.step({ ...s, y: s.pipes[0].gapY, vy: 0 }, 1 / 60, half)
  for (let i = 1; i < s.pipes.length; i++) assert.ok(Math.abs(s.pipes[i].x - s.pipes[i - 1].x - SPACING) < 1e-6)
  assert.ok(s.pipes.length <= Math.ceil(WIDTH / SPACING) + 2)
})

test('flappy: hitting a pipe ends it', () => {
  const s = { ...flappy.start({}, half), pipes: [{ x: HEAD_X - 10, gapY: 100, gap: 140, scored: false }], y: 400 }
  assert.equal(flappy.step(s, 1 / 60, half).dead, true)
})

test('flappy: auto flap plays itself through random pipes, with any of the settings, keeping to a plan', () => {
  // The same random pipes every time
  const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (const settings of [{}, { moving: true }, { moon: true }, { radius: RADIUS * 1.6 }, { width: 840 }]) {
    for (const seed of [1, 2, 3]) {
      const random = seeded(seed)
      let s = flappy.start(settings, random)
      let plan = null
      for (let i = 0; i < 60 * 60 && !s.dead; i++) {
        const next = flappy.autoFlap(s, plan)
        plan = next.plan
        s = flappy.step(next.flap ? flappy.flap(s) : s, 1 / 60, random)
      }
      assert.equal(s.dead, false, `${JSON.stringify(settings)}, seed ${seed}: crashed at ${s.score}`)
      assert.ok(s.score >= 35)
    }
  }
  assert.deepEqual(flappy.autoFlap({ ...flappy.start({}, half), dead: true }), { flap: false, plan: null })
})

test('flappy: gaps narrow as the score goes up, but not forever', () => {
  assert.ok(flappy.gapFor(10) < flappy.gapFor(0))
  assert.equal(flappy.gapFor(1000), flappy.gapFor(2000))
})

test('Easy Mode: wider gaps and a gentler fall, longer heads, and an extra pinball', () => {
  assert.ok(flappy.gapFor(0, true) > flappy.gapFor(0))
  assert.ok(flappy.gapFor(1000, true) > flappy.gapFor(1000))
  const easy = flappy.start({ easy: true }, half)
  assert.ok(easy.pipes[0].gap > flappy.start({}, half).pipes[0].gap)
  // After half a second without flapping, the easy head hasn't fallen as far
  assert.ok(play(easy, 0.5).y < play(flappy.start({}, half), 0.5).y)
  assert.ok(upTime(0, true) > upTime(0))
  assert.ok(upTime(ROUND_MS, true) > upTime(ROUND_MS))
  assert.equal(pinball.start(undefined, { easy: true }).balls, pinball.BALLS + 1)
  assert.equal(pinball.start().balls, pinball.BALLS)
})

test('flappy: the face tilts up after a flap and down in a dive', () => {
  assert.ok(flappy.facing(FLAP) < 0)
  assert.ok(flappy.facing(700) > 0)
})

test('bonk: heads stay up for less time as the round goes on', () => {
  assert.equal(upTime(0), UP_MS.start)
  assert.equal(upTime(ROUND_MS), UP_MS.end)
  assert.ok(upTime(ROUND_MS / 2) < UP_MS.start && upTime(ROUND_MS / 2) > UP_MS.end)
})

test('bonk: the next head never comes up in the same hole', () => {
  for (let prev = 0; prev < HOLES; prev++) {
    for (const r of [0, 0.3, 0.5, 0.99]) {
      const next = nextHole(prev, () => r)
      assert.notEqual(next, prev)
      assert.ok(next >= 0 && next < HOLES)
    }
  }
})

const SECRET = 'scores-secret'
const NOW = 1_800_000_000_000

test('scores: a run token only works for its own game and secret', () => {
  const run = startRun('bonk', NOW, SECRET)
  assert.equal(runStart('bonk', run, SECRET), NOW)
  assert.equal(runStart('flappy-head', run, SECRET), null)
  assert.equal(runStart('bonk', run, 'other'), null)
  assert.equal(runStart('bonk', run.replace(String(NOW), String(NOW - 60_000)), SECRET), null)
  assert.equal(runStart('bonk', 'nonsense', SECRET), null)
})

test('scores: initials are three letters or numbers, uppercased', () => {
  assert.equal(cleanInitials('cal'), 'CAL')
  assert.equal(cleanInitials('c.4l'), 'C4L')
  assert.equal(cleanInitials('ca'), null)
  assert.equal(cleanInitials('cale'), null)
})

test('scores: a score has to be reachable in the time the run took', () => {
  const flappyRun = startRun('flappy-head', NOW, SECRET)
  const at = (ms, score, game = 'flappy-head', run = flappyRun) => parseScore({ game, initials: 'CAL', score, run }, NOW + ms, SECRET)
  // 10 pipes take about 14.7 seconds
  assert.ok(at(15_000, 10).entry)
  assert.ok(at(5_000, 10).error)
  // Bonk is a fixed 30-second round
  const bonkRun = startRun('bonk', NOW, SECRET)
  assert.ok(at(ROUND_MS + 500, 40, 'bonk', bonkRun).entry)
  assert.ok(at(10_000, 40, 'bonk', bonkRun).error)
  assert.ok(at(ROUND_MS + 500, MAX_SCORE + 1, 'bonk', bonkRun).error)
  // An old run, a run for another game, or no run at all
  assert.ok(at(2 * 60 * 60 * 1000, 10).error)
  assert.ok(at(ROUND_MS + 500, 10, 'flappy-head', bonkRun).error)
  assert.ok(at(15_000, 10, 'flappy-head', null).error)
  // Plink's points grow with the level, so a big score is a long game: it has a day, not an hour
  const plinkRun = startRun('plink', NOW, SECRET)
  assert.ok(at(90 * 60 * 1000, 10_599_905, 'plink', plinkRun).entry)
  assert.ok(at(25 * 60 * 60 * 1000, 10_599_905, 'plink', plinkRun).error)
})

test('scores: rejects unknown games and odd scores', () => {
  const run = startRun('bonk', NOW, SECRET)
  for (const score of [0, -1, 2.5, 'lots', GAMES.bonk.max + 1]) {
    assert.ok(parseScore({ game: 'bonk', initials: 'CAL', score, run }, NOW + ROUND_MS, SECRET).error, String(score))
  }
  assert.ok(parseScore({ game: 'tetris', initials: 'CAL', score: 1, run }, NOW + ROUND_MS, SECRET).error)
  assert.ok(parseScore(null, NOW, SECRET).error)
})

test('scores: the board reads Upstash member/score pairs', () => {
  assert.deepEqual(board(['CAL#ab12', '42', 'MEL#cd34', 7]), [
    { initials: 'CAL', score: 42 },
    { initials: 'MEL', score: 7 },
  ])
})

test("scores: every mix of a game's settings has a board, and Bonk Frenzy can go twice as high", () => {
  for (const game of ['flappy-head-moving-moon', 'bonk-decoys', 'snake-wrap-obstacles-portals', 'invaders-rapid', 'bricks-nopowers-small', 'plink-nobucket-moving', 'headcount-swarm-fragile']) {
    assert.ok(GAMES[game], game)
  }
  assert.equal(GAMES['bonk-frenzy'].max, GAMES.bonk.max * 2)
})
