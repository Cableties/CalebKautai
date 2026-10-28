import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import BouncingHead from './BouncingHead.jsx'
import { Gravity, HeadTrail, MatrixRain, PixelFilter } from './CheatEffects.jsx'
import Hack from './Hack.jsx'

// Site-wide cheat codes: toggled on the /cheat-codes page, or by typing a code on a keyboard.
// They last for the browser session (so a visitor coming back next week doesn't find the site
// mysteriously upside down) and show up as data-cheat-* attributes on <html> for the CSS.
// index.html applies the saved ones before first paint, like the theme.
export const CHEATS = [
  { id: 'head', name: 'Head Mode', description: 'My head bounces around every page. Forever.', code: 'HEAD' },
  { id: 'amber', name: 'Amber Mode', description: "Amber's head bounces around every page too, hair flying.", code: 'AMBER' },
  { id: 'bighead', name: 'Big Head Mode', description: 'Every photo of me becomes a wobbling bobblehead.', code: 'BIGHEAD' },
  { id: 'dance', name: 'Dance Mode', description: 'Every colour on the site cycles like a disco floor.', code: 'DISCO' },
  { id: 'australia', name: 'Australia Mode', description: 'View the site the way we see it down here.', code: 'GDAY' },
  { id: '8bit', name: '8-bit Mode', description: 'Pixel font, pixel photos, square everything.', code: '8BIT' },
  { id: 'matrix', name: 'Matrix Mode', description: 'Follow the white rabbit. It is green, though.', code: 'MATRIX' },
  { id: 'gravity', name: 'Gravity Mode', description: 'Tap anything and it falls off the page. Turn it off to tidy up.', code: 'GRAVITY' },
  { id: 'comic', name: 'Comic Sans Mode', description: 'The most professional font.', code: 'COMIC' },
  { id: 'trail', name: 'Head Trail', description: 'Tiny heads follow your cursor or finger.', code: 'TRAIL' },
  { id: 'night', name: 'Night Vision', description: 'Goggles on.', code: 'NIGHT' },
  // Secret: not on the cheat codes page. On a phone, tap the Games heading four times (pages/Games.jsx).
  // Easy runs stay off the high-score boards (components/Scores.jsx).
  { id: 'easy', name: 'Easy Mode', description: 'All the games go a little easier on you.', code: 'EZPZ', hidden: true },
]

// The secret: replays the tattoo hack wherever you are
export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

// Fonts some cheats need, loaded only when they're switched on
const FONTS = {
  '8bit': 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap',
  comic: 'https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&display=swap',
}

// The other secret: switch Amber Mode on and off three times (six flips, close together) and Amber
// takes over from Caleb in the games. Doing it again brings Caleb back. Unlike the cheats, this is
// remembered for good, like the games' sound setting.
const PLAYER_KEY = 'games-player'
const AMBER_FLIPS = 6
const AMBER_WINDOW = 30000 // ms, for all six

const STORAGE_KEY = 'cheats'
const CheatsContext = createContext(null)
export const useCheats = () => useContext(CheatsContext)

function save(active) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(active))
  } catch {
    // Storage blocked: cheats just won't survive a reload
  }
}

function loadFont(href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.append(link)
}

export function CheatsProvider({ children }) {
  // Starts empty so the prerendered HTML matches the first render; the saved set loads after mount
  const [active, setActive] = useState([])
  const [toast, setToast] = useState(null)
  const [hacking, setHacking] = useState(false)
  const typed = useRef('')
  const keys = useRef([])
  const firstRun = useRef(true)
  const { pathname } = useLocation()
  // Who you play as in the games (a key of HEADS in lib/bounce.js)
  const [player, setPlayer] = useState('caleb')
  const amberFlips = useRef([])

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
      setActive(saved.filter((id) => CHEATS.some((c) => c.id === id)))
    } catch {
      // Nothing saved, or storage blocked
    }
    try {
      if (localStorage.getItem(PLAYER_KEY) === 'amber') setPlayer('amber')
    } catch {
      // Storage blocked: Caleb it is
    }
  }, [])

  function flipAmber() {
    const now = Date.now()
    amberFlips.current = [...amberFlips.current, now].filter((t) => now - t <= AMBER_WINDOW)
    if (amberFlips.current.length < AMBER_FLIPS) return false
    amberFlips.current = []
    setPlayer((was) => {
      const next = was === 'amber' ? 'caleb' : 'amber'
      try {
        localStorage.setItem(PLAYER_KEY, next)
      } catch {
        // Storage blocked: it lasts until the page is closed
      }
      setToast({ text: next === 'amber' ? 'Amber unlocked: she’s playing the games now' : 'Caleb’s back in the games', key: now })
      return next
    })
    return true
  }

  useEffect(() => {
    // The first run still has the empty starting state: skip it, or it would undo the attributes
    // index.html applied before paint (and Australia Mode would flip upright and back on reload)
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    for (const cheat of CHEATS) {
      document.documentElement.toggleAttribute(`data-cheat-${cheat.id}`, active.includes(cheat.id))
    }
    for (const id of active) if (FONTS[id]) loadFont(FONTS[id])
    save(active)
  }, [active])

  function toggle(id) {
    const cheat = CHEATS.find((c) => c.id === id)
    // The sixth flip shows the unlock instead of the usual toast
    const unlocked = id === 'amber' && flipAmber()
    setActive((now) => {
      const on = !now.includes(id)
      if (!unlocked) setToast({ text: `${cheat.name} ${on ? 'activated' : 'deactivated'}`, key: Date.now() })
      return on ? [...now, id] : now.filter((c) => c !== id)
    })
  }
  const reset = () => setActive([])
  const runKonami = () => setHacking(true)

  // Typing a code anywhere (outside form fields) toggles its cheat; the Konami code runs the hack
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      keys.current = [...keys.current, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length)
      if (keys.current.join() === KONAMI.join()) {
        keys.current = []
        setHacking(true)
        return
      }
      if (e.key.length !== 1) return
      typed.current = (typed.current + e.key.toUpperCase()).slice(-12)
      // Longest match wins, so typing BIGHEAD doesn't also count as HEAD
      const match = CHEATS.filter((c) => typed.current.endsWith(c.code)).sort((a, b) => b.code.length - a.code.length)[0]
      if (match) {
        typed.current = ''
        toggle(match.id)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(id)
  }, [toast])

  const isOn = (id) => active.includes(id)
  const value = { active, isOn, toggle, reset, runKonami, player }
  return (
    <CheatsContext.Provider value={value}>
      {children}
      {/* Head Mode: one head on every page (the good friend page leaves its own out when this is on) */}
      {isOn('head') && <BouncingHead chosen />}
      {/* Amber Mode: Amber's head too (the love interest page leaves its own out when this is on) */}
      {isOn('amber') && <BouncingHead who="amber" chosen />}
      {isOn('matrix') && <MatrixRain />}
      {isOn('trail') && <HeadTrail />}
      {isOn('8bit') && <PixelFilter />}
      <Gravity on={isOn('gravity')} pathname={pathname} />
      {hacking && <Hack granted="CHEATER DETECTED" onFinish={() => setHacking(false)} />}
      <p className="cheat-toast" role="status" aria-live="polite">
        {toast && <span key={toast.key}>{toast.text}</span>}
      </p>
    </CheatsContext.Provider>
  )
}
