import { useEffect, useState } from 'react'
import { setSoundOn, soundOn } from '../lib/feedback.js'

// Switches the games' sound effects on or off (lib/feedback.js), for every game, remembered
export default function SoundToggle() {
  // On to start with, like the prerendered page; the saved choice loads after mount
  const [on, setOn] = useState(true)
  useEffect(() => setOn(soundOn()), [])
  function toggle() {
    setSoundOn(!on)
    setOn(!on)
  }
  return (
    <button type="button" className="game-tool sound-toggle" aria-label="Sound" aria-pressed={on} onClick={toggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
      </svg>
    </button>
  )
}
