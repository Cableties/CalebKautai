import { useCheats } from './Cheats.jsx'
import FullscreenToggle from './Fullscreen.jsx'
import SoundToggle from './SoundToggle.jsx'

// The strip just above a game, keeping its buttons off the game itself: whatever the game puts in
// (`children`: its settings cog, or pause while it's being played, and so on), then full screen and
// sound, which every game has. `info` goes on the left (Pinball's score), along with a badge while
// the secret Easy Mode cheat is on.
export default function GameBar({ info, children }) {
  const easy = useCheats().isOn('easy')
  return (
    <div className="game-bar">
      <div className="game-bar-info">
        {info}
        {easy && <span className="easy-badge">Easy mode</span>}
      </div>
      <div className="game-tools">
        {children}
        <FullscreenToggle />
        <SoundToggle />
      </div>
    </div>
  )
}
