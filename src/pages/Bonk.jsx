import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS, POSES, TILTS, frame } from '../lib/bounce.js'
import { DECOY, GAP_MS, HOLES, ROUND_MS, SETTINGS, bonkGame, freeHole, lanesFor, upTime } from '../lib/bonk.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import GameSettings, { useGameSettings } from '../components/GameSettings.jsx'
import { PauseButton, Paused, usePause } from '../components/Pause.jsx'
import SoundToggle from '../components/SoundToggle.jsx'
import { feedback } from '../lib/feedback.js'
import { useCheats } from '../components/Cheats.jsx'
import { cheatOn } from '../lib/gameHead.js'
import { themeAt } from '../lib/themes.js'

// Bonk: whack-a-mole with Caleb's pixel head. The rules are in lib/bonk.js; the holes are buttons,
// so it works with a mouse, a finger or a keyboard. Settings (decoys, frenzy) are behind the cog,
// and each mix has its own high scores. Over the round the day goes by: the board starts out in the
// morning and ends at dusk.
const DAY = [
  { board: '#bfe8d6', turf: '#a3dcc3' }, // morning
  { board: '#d8efb6', turf: '#c2e29c' }, // midday
  { board: '#fbd4b5', turf: '#f1bc96' }, // sunset
  { board: '#d6cdf0', turf: '#bfb3e5' }, // dusk (light enough for the score on it)
]
function sky(left) {
  const { board, turf } = themeAt(DAY, (1 - left / ROUND_MS) * (DAY.length - 1)).palette
  return { '--bonk-board': board, '--bonk-turf': turf }
}
const NAMES = { caleb: 'Caleb', amber: 'Amber' }

// Whoever's playing, sized so their face (sprite.art) is just under half the hole's width, whatever
// else is round it (Amber's hair)
const FACE = 48 // % of the hole
function look(who) {
  const { sheet, sprite } = HEADS[who]
  const width = (FACE * sprite.width) / sprite.art
  return {
    backgroundImage: `url(${sheet})`,
    width: `${width}%`,
    left: `${(100 - width) / 2}%`,
    aspectRatio: `${sprite.width} / ${sprite.height}`,
  }
}

// Background position of one sprite frame, in percent so it works at any size
function sprite(facing) {
  const { row, col, mirrored } = frame(facing)
  return {
    backgroundPosition: `${(col / (TILTS.length - 1)) * 100}% ${(row / (POSES.length - 1)) * 100}%`,
    transform: mirrored ? 'scaleX(-1)' : undefined,
  }
}

export default function Bonk() {
  const [phase, setPhase] = useState('ready') // ready | playing | paused | over
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [score, setScore] = useState(0)
  // The heads that are up, by hole: { decoy, facing }. One at a time, or two with Frenzy.
  const [ups, setUps] = useState({})
  const [bonked, setBonked] = useState(null) // the hole that was just hit, for the squash
  const [oops, setOops] = useState(null) // a decoy just bonked, for a red flash
  const [missed, setMissed] = useState(null) // an empty hole just tapped, for a puff of dust
  const [left, setLeft] = useState(ROUND_MS)
  const [newBest, setNewBest] = useState(false)
  const [scores, setScores] = useState(null)
  const [settings, toggleSetting] = useGameSettings('bonk', SETTINGS)
  const GAME = bonkGame(settings)
  const [best, record] = useBest(GAME)
  const { run, begin } = useRun(GAME)
  const timers = useRef([])
  const board = useRef(null)
  const started = useRef(0)
  const scoreRef = useRef(0)
  const upsRef = useRef({})
  const easy = useRef(false) // Easy Mode, as it was when this round started
  const pausedAt = useRef(0)
  const { player } = useCheats()
  const other = player === 'amber' ? 'caleb' : 'amber'

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clear, [])
  // A new mix of settings has its own board
  useEffect(() => setScores(null), [GAME])

  const show = (next) => {
    upsRef.current = next
    setUps(next)
  }
  const down = (hole) => {
    const { [hole]: _, ...rest } = upsRef.current
    show(rest)
  }

  // One lane: a head pops up somewhere free, stays a while, goes down, and the next one comes
  function popUp(previous) {
    const elapsed = Date.now() - started.current
    if (elapsed >= ROUND_MS) return
    const taken = Object.keys(upsRef.current).map(Number)
    const next = freeHole(taken, previous)
    const decoy = settings.decoys && Math.random() < DECOY.chance
    // Its own id, so going down later can't take down another lane's head that's since come up there
    const id = Math.random()
    show({ ...upsRef.current, [next]: { id, decoy, facing: [0, 180, -20, 200][Math.floor(Math.random() * 4)] } })
    later(() => {
      if (upsRef.current[next]?.id === id) down(next)
      later(() => popUp(next), GAP_MS)
    }, upTime(elapsed, easy.current))
  }

  // Pausing stops the clock and puts the heads down; going on, the clock picks up where it was and
  // they start popping up again
  const { pause, resume } = usePause(phaseRef, setPhase, {
    onPause: () => {
      clear()
      show({})
      pausedAt.current = Date.now()
    },
    onResume: () => {
      started.current += Date.now() - pausedAt.current
      roll()
    },
  })

  // The round's clock, and the heads popping up (Frenzy's second lane a beat after the first, so
  // they don't move in step)
  function roll() {
    for (let lane = 0; lane < lanesFor(settings); lane++) later(() => popUp(null), 400 + lane * 550)
    const tick = () => {
      const remaining = Math.max(0, ROUND_MS - (Date.now() - started.current))
      setLeft(remaining)
      if (remaining > 0) later(tick, 100)
      else {
        clear()
        show({})
        feedback('time')
        setPhase('over')
        setNewBest(!easy.current && record(scoreRef.current))
      }
    }
    later(tick, 100)
  }

  function play() {
    board.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    clear()
    scoreRef.current = 0
    setScore(0)
    setNewBest(false)
    setBonked(null)
    setOops(null)
    setMissed(null)
    show({})
    setLeft(ROUND_MS)
    setPhase('playing')
    started.current = Date.now()
    easy.current = cheatOn('easy')
    begin()
    roll()
  }

  const flash = (set, i) => {
    set(i)
    later(() => set((b) => (b === i ? null : b)), 300)
  }

  function bonk(i) {
    if (phase !== 'playing') return
    const up = upsRef.current[i]
    if (!up) {
      // Nobody home: a whiff and a puff of dust
      feedback('whiff')
      flash(setMissed, i)
      return
    }
    down(i)
    if (up.decoy) {
      // Wrong head: points off
      feedback('splat')
      scoreRef.current = Math.max(0, scoreRef.current - DECOY.penalty)
      setScore(scoreRef.current)
      flash(setOops, i)
      return
    }
    feedback('bonk')
    scoreRef.current++
    setScore(scoreRef.current)
    flash(setBonked, i)
  }

  return (
    <article className="page game-page">
      <p className="game-back">
        <Link to="/games" viewTransition>
          ← All games
        </Link>
        <SoundToggle />
      </p>
      <h1 className="page-title">Bonk</h1>
      <p className="lede">My head pops up. You bonk it. 30 seconds, as many as you can.</p>

      <div className="game-layout">
        <div className="bonk" ref={board} style={sky(left)}>
          <div className="bonk-bar">
            <p>
              Score <strong>{score}</strong>
            </p>
            <p>
              <strong>{Math.ceil(left / 1000)}</strong>s
            </p>
          </div>
          <div className="bonk-grid">
            {Array.from({ length: HOLES }, (_, i) => {
              const up = ups[i]
              return (
                <button
                  key={i}
                  type="button"
                  className={
                    'bonk-hole' +
                    (up ? ' up' : '') +
                    (up?.decoy ? ' decoy' : '') +
                    (bonked === i ? ' bonked' : '') +
                    (oops === i ? ' oops' : '') +
                    (missed === i ? ' missed' : '')
                  }
                  aria-label={up ? (up.decoy ? `Don't bonk ${NAMES[other]}!` : 'Bonk the head!') : `Hole ${i + 1}`}
                  onPointerDown={(e) => (e.preventDefault(), bonk(i))}
                  onClick={(e) => e.detail === 0 && bonk(i)} // keyboard (Enter or Space)
                  disabled={phase !== 'playing'}
                >
                  <span
                    className="bonk-head"
                    style={{ ...look(up?.decoy ? other : player), ...sprite(up?.facing ?? 0) }}
                    aria-hidden="true"
                  />
                  <span className="bonk-stars" aria-hidden="true">
                    ✦ ✧ ✦
                  </span>
                  <span className="bonk-dust" aria-hidden="true" />
                </button>
              )
            })}
          </div>
          {phase === 'playing' && <PauseButton onPause={pause} />}
          {phase === 'paused' && <Paused onResume={resume} />}
          {(phase === 'ready' || phase === 'over') && (
            <div className="game-overlay">
              {phase === 'over' ? (
                <>
                  <h2>Time!</h2>
                  <p className="game-final" role="status">
                    Score: <strong>{score}</strong>
                    {newBest ? ' · New best!' : best ? ` · Best: ${best}` : ''}
                  </p>
                  <ScoreEntry game={GAME} score={score} run={run} easy={easy.current} onSaved={setScores} />
                </>
              ) : (
                <h2>Ready?</h2>
              )}
              <button type="button" className="button" onClick={play}>
                {phase === 'over' ? 'Play again' : 'Start'}
              </button>
            </div>
          )}
          <GameSettings options={SETTINGS} settings={settings} onToggle={toggleSetting} hidden={phase === 'playing' || phase === 'paused'} />
        </div>
        <ScoreBoard game={GAME} scores={scores} />
      </div>
    </article>
  )
}
