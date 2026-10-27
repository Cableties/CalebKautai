import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HEADS, POSES, TILTS, frame } from '../lib/bounce.js'
import { GAP_MS, HOLES, ROUND_MS, nextHole, upTime } from '../lib/bonk.js'
import { ScoreBoard, ScoreEntry, useBest, useRun } from '../components/Scores.jsx'
import SoundToggle from '../components/SoundToggle.jsx'
import { feedback } from '../lib/feedback.js'
import { useCheats } from '../components/Cheats.jsx'

// Bonk: whack-a-mole with Caleb's pixel head. The rules are in lib/bonk.js; the holes are buttons,
// so it works with a mouse, a finger or a keyboard.
const GAME = 'bonk'

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
  const [phase, setPhase] = useState('ready') // ready | playing | over
  const [score, setScore] = useState(0)
  const [hole, setHole] = useState(null) // where the head is up, if anywhere
  const [bonked, setBonked] = useState(null) // the hole that was just hit, for the squash
  const [missed, setMissed] = useState(null) // an empty hole just tapped, for a puff of dust
  const [left, setLeft] = useState(ROUND_MS)
  const [facing, setFacing] = useState(0) // which way the head faces this time
  const [newBest, setNewBest] = useState(false)
  const [scores, setScores] = useState(null)
  const [best, record] = useBest(GAME)
  const { run, begin } = useRun(GAME)
  const timers = useRef([])
  const board = useRef(null)
  const started = useRef(0)
  const scoreRef = useRef(0)
  const { player } = useCheats()

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clear, [])

  function popUp(previous) {
    const elapsed = Date.now() - started.current
    if (elapsed >= ROUND_MS) return
    const next = nextHole(previous)
    setHole(next)
    setFacing([0, 180, -20, 200][Math.floor(Math.random() * 4)])
    const stay = upTime(elapsed)
    later(() => {
      setHole((h) => (h === next ? null : h))
      later(() => popUp(next), GAP_MS)
    }, stay)
  }

  function play() {
    board.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    clear()
    scoreRef.current = 0
    setScore(0)
    setNewBest(false)
    setBonked(null)
    setMissed(null)
    setLeft(ROUND_MS)
    setPhase('playing')
    started.current = Date.now()
    begin()
    later(() => popUp(null), 400)
    const tick = () => {
      const remaining = Math.max(0, ROUND_MS - (Date.now() - started.current))
      setLeft(remaining)
      if (remaining > 0) later(tick, 100)
      else {
        clear()
        setHole(null)
        feedback('time')
        setPhase('over')
        setNewBest(record(scoreRef.current))
      }
    }
    later(tick, 100)
  }

  function bonk(i) {
    if (phase !== 'playing') return
    if (i !== hole) {
      // Nobody home: a whiff and a puff of dust
      feedback('whiff')
      setMissed(i)
      later(() => setMissed((m) => (m === i ? null : m)), 300)
      return
    }
    feedback('bonk')
    scoreRef.current++
    setScore(scoreRef.current)
    setHole(null)
    setBonked(i)
    later(() => setBonked((b) => (b === i ? null : b)), 300)
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
        <div className="bonk" ref={board}>
          <div className="bonk-bar">
            <p>
              Score <strong>{score}</strong>
            </p>
            <p>
              <strong>{Math.ceil(left / 1000)}</strong>s
            </p>
          </div>
          <div className="bonk-grid">
            {Array.from({ length: HOLES }, (_, i) => (
              <button
                key={i}
                type="button"
                className={'bonk-hole' + (hole === i ? ' up' : '') + (bonked === i ? ' bonked' : '') + (missed === i ? ' missed' : '')}
                aria-label={hole === i ? 'Bonk the head!' : `Hole ${i + 1}`}
                onPointerDown={(e) => (e.preventDefault(), bonk(i))}
                onClick={(e) => e.detail === 0 && bonk(i)} // keyboard (Enter or Space)
                disabled={phase !== 'playing'}
              >
                <span className="bonk-head" style={{ ...look(player), ...sprite(facing) }} aria-hidden="true" />
                <span className="bonk-stars" aria-hidden="true">
                  ✦ ✧ ✦
                </span>
                <span className="bonk-dust" aria-hidden="true" />
              </button>
            ))}
          </div>
          {phase !== 'playing' && (
            <div className="game-overlay">
              {phase === 'over' ? (
                <>
                  <h2>Time!</h2>
                  <p className="game-final" role="status">
                    Score: <strong>{score}</strong>
                    {newBest ? ' · New best!' : best ? ` · Best: ${best}` : ''}
                  </p>
                  <ScoreEntry game={GAME} score={score} run={run} onSaved={setScores} />
                </>
              ) : (
                <h2>Ready?</h2>
              )}
              <button type="button" className="button" onClick={play}>
                {phase === 'over' ? 'Play again' : 'Start'}
              </button>
            </div>
          )}
        </div>
        <ScoreBoard game={GAME} scores={scores} />
      </div>
    </article>
  )
}
