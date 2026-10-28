import { useEffect, useRef, useState } from 'react'

// A game's settings: a cog in the corner of the game (while it isn't being played) that opens a
// panel of switches over it. The options (id, name, note) live with each game's rules, since the
// scores API needs them too (lib/settings.js).

// The settings themselves, remembered in this browser. Returns [settings, toggle(id), ref], the ref
// for game loops and key handlers set up once.
export function useGameSettings(name, options) {
  const key = `${name}-settings`
  // All off to start with, like the prerendered page; the saved ones load after mount
  const [settings, setSettings] = useState(() => Object.fromEntries(options.map((o) => [o.id, false])))
  const ref = useRef(settings)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '{}')
      const loaded = Object.fromEntries(options.map((o) => [o.id, saved[o.id] === true]))
      ref.current = loaded
      setSettings(loaded)
    } catch {
      // Nothing saved, or storage blocked
    }
  }, [key])
  function toggle(id) {
    const next = { ...ref.current, [id]: !ref.current[id] }
    ref.current = next
    setSettings(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Not remembered, then
    }
    return next
  }
  return [settings, toggle, ref]
}

const COG = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
    <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z" />
  </svg>
)

// `hidden` while a game's being played. Taps and keys in here stay here, so they don't start or
// steer the game underneath.
export default function GameSettings({ options, settings, onToggle, hidden }) {
  const [open, setOpen] = useState(false)
  const done = useRef(null)
  useEffect(() => {
    if (open) done.current?.focus()
  }, [open])
  if (hidden) return null
  const keep = (e) => {
    e.stopPropagation()
    if (e.key === 'Escape') setOpen(false)
  }
  const on = options.filter((o) => settings[o.id]).length
  return (
    <>
      <button
        type="button"
        className="game-cog"
        aria-label={on ? `Settings (${on} on)` : 'Settings'}
        aria-expanded={open}
        onPointerDown={keep}
        onKeyDown={keep}
        onClick={() => setOpen(true)}
      >
        {COG}
        {on > 0 && <span className="game-cog-count">{on}</span>}
      </button>
      {open && (
        <div className="game-settings-panel" role="dialog" aria-label="Settings" onPointerDown={keep} onKeyDown={keep}>
          <h2>Settings</h2>
          <ul>
            {options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings[o.id]}
                  className="game-setting"
                  onClick={() => onToggle(o.id)}
                >
                  <span className="game-setting-name">{o.name}</span>
                  <span className="game-setting-note">{o.note}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="game-settings-boards">Each mix of settings has its own high scores.</p>
          <button type="button" className="button" ref={done} onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}
    </>
  )
}
