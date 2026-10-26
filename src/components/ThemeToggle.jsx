import { useEffect, useState } from 'react'

// index.html applies a saved choice before first paint; this keeps the button in sync with it.
// `dark` stays null until mounted, so the prerendered HTML matches the first client render.
export default function ThemeToggle() {
  const [dark, setDark] = useState(null)

  useEffect(() => {
    const saved = document.documentElement.dataset.theme
    setDark(saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches)
  }, [])

  function toggle() {
    const next = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Private mode or blocked storage: the choice just won't be remembered.
    }
    setDark(!dark)
  }

  return (
    <button type="button" className="theme-toggle" aria-label="Dark mode" aria-pressed={dark ?? undefined} onClick={toggle}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path className="moon" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        <g className="sun">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" />
        </g>
      </svg>
    </button>
  )
}
