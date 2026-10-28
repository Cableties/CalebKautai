import { useEffect, useState } from 'react'
import { setSoundOn, soundOn } from '../lib/feedback.js'
import { useCheats } from './Cheats.jsx'

// Switches the games' sound effects on or off (lib/feedback.js), for every game, remembered. Beside
// it, a badge while the secret Easy Mode cheat is on.
export default function SoundToggle() {
  const easy = useCheats().isOn('easy')
  // On to start with, like the prerendered page; the saved choice loads after mount
  const [on, setOn] = useState(true)
  useEffect(() => setOn(soundOn()), [])
  function toggle() {
    setSoundOn(!on)
    setOn(!on)
  }
  return (
    <span className="game-tools">
      {easy && <span className="easy-badge">Easy mode</span>}
      <button type="button" className="sound-toggle" aria-pressed={on} onClick={toggle}>
        <span aria-hidden="true">{on ? '🔊' : '🔇'}</span> Sound
      </button>
    </span>
  )
}
