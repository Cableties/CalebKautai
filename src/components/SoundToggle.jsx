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
    <button type="button" className="sound-toggle" aria-pressed={on} onClick={toggle}>
      <span aria-hidden="true">{on ? '🔊' : '🔇'}</span> Sound
    </button>
  )
}
