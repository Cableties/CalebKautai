import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// The fake "you've been hacked" cutscene: the tattoo page's intro, and the Konami code's secret.
// It plays through on its CSS timeline, then waits: playing → done (Continue shows) → leaving
// (exit animation) → gone, when it calls onFinish. With reduced motion it's a still screen,
// already done. On the tattoo page it's in the prerendered HTML; JS fills in the device details.

// When the CSS timeline finishes (just after the victim number appears) and Continue shows up
const INTRO_MS = 5000

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

export default function Hack({ victim = null, granted = 'ACCESS GRANTED', onFinish = () => {} }) {
  const [stage, setStage] = useState('playing')
  const [info, setInfo] = useState(null)
  const [battery, setBattery] = useState(null)
  const reducedMotion = useRef(false)
  const continueButton = useRef(null)

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
    if (stage === 'gone') onFinish()
    // No scrolling the page underneath while the hack is on screen
    document.documentElement.classList.toggle('no-scroll', stage !== 'gone')
    return () => document.documentElement.classList.remove('no-scroll')
  }, [stage])

  const finish = () => setStage(reducedMotion.current ? 'gone' : 'leaving')
  if (stage === 'gone') return null

  return (
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
        <p className="hack-granted" data-text={granted}>
          {granted}
        </p>
        {victim !== null && <p className="hack-victim">You are victim #{victim.toLocaleString()}</p>}
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
  )
}
