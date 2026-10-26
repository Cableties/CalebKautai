import { Link } from 'react-router-dom'
import Overprint from '../components/Overprint.jsx'
import { alchemy, img, intro, testimonial, thingsToDo } from '../content.js'

export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="hero-hi">Howdy! My name is</p>
        <h1 className="hero-name">
          <Overprint text="Caleb" />
          <Overprint text="Kautai" delay />
        </h1>
        <p className="hero-intro">{intro}</p>
        <div className="hero-actions">
          <Link className="button" to="/work" viewTransition>
            Hire me
          </Link>
          <a className="button button-ghost" href="#things">
            Explore the weird stuff
          </a>
        </div>
      </section>

      <section className="section" id="things" aria-labelledby="things-heading">
        <h2 id="things-heading" className="section-title">
          Things to do while you're here
        </h2>
        <ul className="cards">
          {thingsToDo.map((t) => (
            <li key={t.to}>
              <Link to={t.to} className="card" viewTransition>
                <span className="card-label">{t.label}</span>
                <span className="card-note">{t.note}</span>
                <span className="card-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="section alchemy">
        <div>
          <h2 className="section-title">Proud creator of the Masters of Alchemy website</h2>
          <p className="lede">{alchemy.tagline}. I was the sole developer, and the site is still in use today.</p>
          <a className="button" href={alchemy.href} target="_blank" rel="noreferrer">
            Visit mastersofalchemy.au
          </a>
        </div>
        <img {...img('alchemyBanner')} alt="Masters of Alchemy banner" loading="lazy" />
      </section>

      <section className="section">
        <figure className="quote">
          <blockquote>“{testimonial.quote}”</blockquote>
          <figcaption>{testimonial.author}, a satisfied customer</figcaption>
        </figure>
      </section>
    </>
  )
}
