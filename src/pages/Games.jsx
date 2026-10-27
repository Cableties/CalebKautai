import { Link } from 'react-router-dom'
import { games } from '../content.js'

// The games hub: a card per game (the list is in content.js)
export default function Games() {
  return (
    <article className="page games">
      <h1 className="page-title">Games</h1>
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
