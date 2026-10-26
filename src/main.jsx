import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'

// Hash routing is only used for single-file previews; the real site uses clean URLs
// (important: the tattoo QR code points at /tattoo).
const Router = import.meta.env.VITE_HASH_ROUTER ? HashRouter : BrowserRouter

const app = (
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>
)

// Built pages arrive prerendered (scripts/prerender.mjs). Hydrate them when the HTML is for this
// URL; otherwise (dev, or an unknown URL served the home page as a fallback) render from scratch.
const root = document.getElementById('root')
const path = location.pathname.replace(/(.)\/$/, '$1')
if (root.dataset.path === path && !import.meta.env.VITE_HASH_ROUTER) {
  hydrateRoot(root, app)
} else {
  root.textContent = ''
  createRoot(root).render(app)
}
