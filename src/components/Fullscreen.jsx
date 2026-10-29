import { useEffect, useState } from 'react'

// Full screen, for playing on a phone (the button only shows on a touch screen): the game takes
// over the whole screen, as big as it fits, with just this button and the sound one above it. The
// page's title, blurb and high scores are tucked away until it's switched off. Where the browser
// can (Android), its own bars go too; where it can't (an iPhone), the game still fills the page.
// It's switched on with an attribute on <html>, which styles.css takes from there.
export default function FullscreenToggle() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!on) return
    const root = document.documentElement
    root.setAttribute('data-game-fullscreen', '')
    // Back to the top, so nothing scrolled is left peeking out (Australia Mode scrolls #root)
    scrollTo(0, 0)
    document.getElementById('root')?.scrollTo?.(0, 0)
    root.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {
      // Not allowed here: the page-filling version will do
    })
    // Leaving the browser's full screen (the back gesture, say) leaves this too
    const left = () => document.fullscreenElement || setOn(false)
    document.addEventListener('fullscreenchange', left)
    return () => {
      document.removeEventListener('fullscreenchange', left)
      root.removeAttribute('data-game-fullscreen')
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [on])
  return (
    <button
      type="button"
      className="game-tool fullscreen-toggle"
      aria-label={on ? 'Exit full screen' : 'Full screen'}
      aria-pressed={on}
      onClick={() => setOn(!on)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {on ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
      </svg>
    </button>
  )
}
