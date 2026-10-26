import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
// When the CSS timeline finishes (just after the victim number appears) and Continue shows up
const INTRO_MS = 5000

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

// Everything here is read in the visitor's own browser for the joke and never leaves it.
function readDevice() {
  const ua = navigator.userAgent
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android phone'
        : /Mac/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows PC'
            : 'mystery device'
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return { device, screen: `${screen.width}×${screen.height}`, time }
}

// The spinning head as a hologram: a tinted image, two colour-fringe copies, and scanlines cut to
// the head's shape (the image's own transparency is the mask), floating over a projector.
function Hologram({ src, width, height, alt }) {
  return (
    <div className="tattoo-face holo" style={{ '--holo-src': `url(${src})` }}>
      <div className="holo-stack">
        <img className="holo-img" src={src} width={width} height={height} alt={alt} />
        <span className="holo-fringe holo-fringe-pink" aria-hidden="true" />
        <span className="holo-fringe holo-fringe-blue" aria-hidden="true" />
        <span className="holo-lines" aria-hidden="true" />
      </div>
    </div>
  )
}

export default function Tattoo() {
  // The hack plays on every visit and waits for the visitor: playing → done (Continue shows)
  // → leaving (exit animation) → gone. It's in the prerendered HTML; JS fills in the device
  // details and handles the buttons. With reduced motion it's a still screen, already done.
  const [stage, setStage] = useState('playing')
  const [info, setInfo] = useState(null)
  const [battery, setBattery] = useState(null)
  const reducedMotion = useRef(false)
  const continueButton = useRef(null)
  const scans = useScanCount()

  useLayoutEffect(() => {
    reducedMotion.current = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion.current) setStage('done')
    setInfo(readDevice())
    navigator.getBattery?.().then((b) => setBattery(Math.round(b.level * 100)), () => {})
  }, [])

  useEffect(() => {
    if (stage !== 'playing') return
    const id = setTimeout(() => setStage('done'), INTRO_MS)
    return () => clearTimeout(id)
  }, [stage])

  useEffect(() => {
    if (stage === 'done') continueButton.current?.focus()
    // No scrolling the page underneath while the hack is on screen
    document.documentElement.classList.toggle('no-scroll', stage !== 'gone')
    return () => document.documentElement.classList.remove('no-scroll')
  }, [stage])

  const finish = () => setStage(reducedMotion.current ? 'gone' : 'leaving')
  const intro = stage !== 'gone'

  return (
    <>
      {intro && (
        <div
          className={'hack' + (stage === 'leaving' ? ' leaving' : '')}
          role="dialog"
          aria-modal="true"
          aria-label="Totally real hacking in progress"
          onAnimationEnd={(e) => e.animationName === 'hack-out' && setStage('gone')}
        >
          <div className="hack-screen">
            <p className="hack-alert">⚠ Intrusion in progress</p>
            <ol className="hack-log">
              <li>&gt; connecting to device… OK</li>
              <li>&gt; device: {info ? info.device : 'identifying…'}</li>
              <li>
                &gt; screen {info ? info.screen : '…'}
                {battery !== null && ` · battery ${battery}%`}
              </li>
              <li>&gt; local time: {info ? info.time : '…'}. Shouldn't you be busy?</li>
              <li>&gt; contacts found: 312</li>
              <li>&gt; photos found: 4,096 (mostly screenshots)</li>
            </ol>
            <div className="hack-progress">
              <span>Downloading bank details</span>
              <span className="hack-bar" aria-hidden="true">
                <span />
              </span>
            </div>
            <p className="hack-granted" data-text="ACCESS GRANTED">
              ACCESS GRANTED
            </p>
            {scans !== null && <p className="hack-victim">You are victim #{scans.toLocaleString()}</p>}
          </div>
          {stage === 'playing' ? (
            <button type="button" className="hack-skip" onClick={finish}>
              Skip hack →
            </button>
          ) : (
            <button type="button" className="hack-continue" ref={continueButton} onClick={finish}>
              Continue →
            </button>
          )}
        </div>
      )}

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
