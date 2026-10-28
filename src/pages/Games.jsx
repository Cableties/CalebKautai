import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCheats } from '../components/Cheats.jsx'
import { games } from '../content.js'

// The games hub: a card per game (the list is in content.js)
// Tapping the heading four times quickly is the phone way in to Easy Mode (EZPZ on a keyboard)
const TAPS = 4
const TAP_WINDOW = 1500 // ms, for all four

export default function Games() {
  const { toggle } = useCheats()
  const taps = useRef([])
  function tap() {
    const now = Date.now()
    taps.current = [...taps.current, now].filter((t) => now - t <= TAP_WINDOW)
    if (taps.current.length < TAPS) return
    taps.current = []
    toggle('easy')
  }

  return (
    <article className="page games">
      <h1 className="page-title" onClick={tap}>
        Games
      </h1>
      <p className="lede">Quick ones, made for your phone. Get your initials on the board.</p>
      <ul className="cards">
        {games.map((g) => (
          <li key={g.to}>
            <Link to={g.to} className="card game-card" viewTransition>
              <span className="game-card-icon" aria-hidden="true">
                {g.icon}
              </span>
              <span className="card-label">{g.label}</span>
              <span className="card-note">{g.note}</span>
              <span className="card-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  )
}
