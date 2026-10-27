import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { contact, nav, socials } from '../content.js'
import { metaFor, pageTitle } from '../meta.js'
import { CheatsProvider } from './Cheats.jsx'
import { PlayerBar, PlayerProvider } from './Player.jsx'
import ThemeToggle from './ThemeToggle.jsx'

export default function Layout() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // Card spotlight: tell the hovered card where the cursor is (styles.css draws the glow)
  useEffect(() => {
    function track(e) {
      if (e.pointerType !== 'mouse') return
      const card = e.target.closest?.('.card, .project')
      if (!card) return
      const box = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${e.clientX - box.left}px`)
      card.style.setProperty('--my', `${e.clientY - box.top}px`)
    }
    document.addEventListener('pointermove', track, { passive: true })
    return () => document.removeEventListener('pointermove', track)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
    // In Australia Mode the page scrolls inside the flipped #root instead of the window
    document.getElementById('root')?.scrollTo(0, 0)
    setMenuOpen(false)
    const meta = metaFor(pathname)
    document.title = pageTitle(meta)
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description)
  }, [pathname])

  return (
    <CheatsProvider>
      <PlayerProvider>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <Link to="/" className="wordmark" aria-label="Caleb Kautai, home" viewTransition>
            <span>Caleb</span>
            <span>Kautai</span>
          </Link>
          <div className="header-tools">
            <ThemeToggle />
            <button
              type="button"
              className="menu-button"
              aria-expanded={menuOpen}
              aria-controls="site-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
          <nav id="site-nav" aria-label="Main" className={menuOpen ? 'open' : ''}>
            <ul>
              {nav.map((item) =>
                item.items ? (
                  <NavGroup key={item.label} group={item} />
                ) : (
                  <li key={item.to}>
                    <NavLink to={item.to} end={item.to === '/'} viewTransition>
                      {item.label}
                    </NavLink>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </header>
        <main id="main">
          <Outlet />
        </main>
        <footer className="site-footer">
          <ul className="footer-links">
            <li>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </li>
            {socials.map((s) => (
              <li key={s.name}>
                <a href={s.href} target="_blank" rel="noreferrer">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
          <p>
            © 2022–{new Date().getFullYear()} by Caleb Kautai. <span className="muted">(Surprise surprise.)</span>
          </p>
        </footer>
        <PlayerBar />
        <Analytics />
      </PlayerProvider>
    </CheatsProvider>
  )
}


// A menu item with its own little menu: a drop-down on desktop, a fold-out list in the phone menu.
// Closes on picking a page, Escape, or clicking anywhere else.
function NavGroup({ group }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const id = `nav-${group.label.toLowerCase().replace(/\W+/g, '-')}`
  const here = group.items.some((item) => pathname.startsWith(item.to))

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const away = (e) => box.current?.contains(e.target) || setOpen(false)
    const escape = (e) => e.key === 'Escape' && (setOpen(false), box.current?.querySelector('button').focus())
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <li className="nav-group" ref={box}>
      <button
        type="button"
        className={here ? 'active' : ''}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {group.label}
        <span className="nav-caret" aria-hidden="true" />
      </button>
      <ul id={id} hidden={!open}>
        {group.items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} viewTransition>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </li>
  )
}
