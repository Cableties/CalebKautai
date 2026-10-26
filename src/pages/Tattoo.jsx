import { useEffect, useLayoutEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { img } from '../content.js'

const choices = [
  { to: '/tattoo-work-thing', label: 'Work thing' },
  { to: '/tattoo-good-friend', label: 'A good friend' },
  { to: '/tattoo-love-interest', label: 'Love interest' },
]

// The fake "hack" plays once per visit; coming back from a choice page skips it.
const SEEN_KEY = 'tattoo-hack-seen'
const INTRO_MS = 5600

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

export default function Tattoo() {
  // The intro is in the prerendered HTML (its CSS timeline clears it even without JS);
  // after mount, JS fills in the device details, handles Skip, and remembers it was seen.
  const [intro, setIntro] = useState(true)
  const [info, setInfo] = useState(null)
  const [battery, setBattery] = useState(null)

  useLayoutEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1'
    } catch {
      // Storage blocked: just play it
    }
    if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches) setIntro(false)
  }, [])

  useEffect(() => {
    if (!intro) return
    setInfo(readDevice())
    navigator.getBattery?.().then((b) => setBattery(Math.round(b.level * 100)), () => {})
    document.documentElement.classList.add('no-scroll')
    const id = setTimeout(finish, INTRO_MS)
    return () => {
      clearTimeout(id)
      document.documentElement.classList.remove('no-scroll')
    }
  }, [intro])

  function finish() {
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      // Storage blocked: it'll replay next time, which is fine
    }
    setIntro(false)
  }

  return (
    <>
      {intro && (
        <div className="hack" role="dialog" aria-modal="true" aria-label="Totally real hacking in progress">
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
          </div>
          <button type="button" className="hack-skip" onClick={finish}>
            Skip hack →
          </button>
        </div>
      )}

      <article className={'page tattoo' + (intro ? '' : ' tattoo-in')}>
        <h1 className="page-title glitch" data-text="Woah, you actually scanned it!">
          Woah, you actually scanned it!
        </h1>
        <div className="tattoo-gif">
          <img {...img('tattooGif')} alt="Caleb waving" />
        </div>
        <p className="lede">
          That's so amazing! While I steal your bank information, why not stick around and check out some stuff?
        </p>
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
      </article>
    </>
  )
}
