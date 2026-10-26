import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App.jsx'

// Used at build time only (scripts/prerender.mjs) to turn each route into static HTML.
export { pageMeta } from './content.js'
export { metaFor, pageTitle } from './meta.js'

export function render(url) {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>,
  )
}
