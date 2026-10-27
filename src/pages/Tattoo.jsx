import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Hack from '../components/Hack.jsx'
import Reviews from '../components/Reviews.jsx'
import { img } from '../content.js'

const choices = [
  { to: '/tattoo-work-thing', label: 'Work thing' },
  { to: '/tattoo-good-friend', label: 'A good friend' },
  { to: '/tattoo-love-interest', label: 'Love interest' },
]

// Each browser session counts as one scan (the API also limits repeats per visitor),
// though the hack itself plays on every visit to the page.
const COUNTED_KEY = 'tattoo-scan-counted'

function useScanCount() {
  const [count, setCount] = useState(null)
  useEffect(() => {
    let counted = false
    try {
      counted = sessionStorage.getItem(COUNTED_KEY) === '1'
      sessionStorage.setItem(COUNTED_KEY, '1')
    } catch {
      // Storage blocked: the API's own limit stops double counting
    }
    fetch('/api/scans', { method: counted ? 'GET' : 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setCount(data.count))
      .catch(() => {}) // No counter (e.g. local dev without the API): the page just leaves it out
  }, [])
  return count
}

// The spinning head as a hologram, floating over a projector. Every effect (tint, colour fringes,
// scanlines) is drawn on the one animated image: separate copies of an animation each keep their
// own clock, and drifted out of step with each other.
function Hologram({ src, width, height, alt }) {
  return (
    <div className="tattoo-face holo">
      <div className="holo-stack">
        <img className="holo-img" src={src} width={width} height={height} alt={alt} />
      </div>
    </div>
  )
}

export default function Tattoo() {
  // The hack (components/Hack.jsx) plays on every visit, over the page, until the visitor continues
  const [intro, setIntro] = useState(true)
  const scans = useScanCount()

  return (
    <>
      {intro && <Hack victim={scans} onFinish={() => setIntro(false)} />}

      <article className={'page tattoo' + (intro ? '' : ' tattoo-in')}>
        <h1 className="page-title glitch" data-text="Woah, you actually scanned it!">
          Woah, you actually scanned it!
        </h1>
        <Hologram {...img('face')} alt="Caleb's head, spinning, as a hologram" />
        <p className="lede">
          That's so amazing! While I steal your bank information, why not stick around and check out some stuff?
        </p>
        {scans !== null && (
          <p className="scan-count">
            <strong>{scans.toLocaleString()}</strong> {scans === 1 ? 'person has' : 'people have'} scanned this tattoo
          </p>
        )}
        <h2 className="choice-prompt">
          <span className="prompt-caret" aria-hidden="true">
            &gt;
          </span>{' '}
          Which of these best describes you?
        </h2>
        <ol className="choices">
          {choices.map((c, i) => (
            <li key={c.to} style={{ '--i': i }}>
              <Link to={c.to} className="choice" viewTransition>
                <span className="choice-n" aria-hidden="true">
                  [{i + 1}]
                </span>
                {c.label}
              </Link>
            </li>
          ))}
        </ol>
        <Reviews />
      </article>
    </>
  )
}
