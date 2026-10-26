import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `vite preview` answers /about with dist/index.html; Vercel serves the prerendered
// dist/about/index.html. Match Vercel so local checks (and the browser tests) see the real thing.
const servePrerendered = {
  name: 'serve-prerendered-pages',
  configurePreviewServer(server) {
    const dist = server.config.build.outDir
    server.middlewares.use((req, _res, next) => {
      const [path, query = ''] = req.url.split('?')
      const page = path.replace(/\/$/, '')
      if (page && !page.includes('.') && existsSync(join(dist, page, 'index.html'))) {
        req.url = `${page}/index.html${query && '?' + query}`
      }
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), servePrerendered],
})
