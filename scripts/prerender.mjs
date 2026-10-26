// Writes a static HTML file per route into dist/, so pages show content (and the right
// title, description and link preview) before JavaScript loads. Runs as the last build step.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const { render, pageMeta, metaFor, pageTitle } = await import('../dist-ssr/entry-server.js')
const template = await readFile(new URL('index.html', dist), 'utf8')
const SITE = 'https://www.calebkautai.com'

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

for (const path of Object.keys(pageMeta)) {
  const meta = metaFor(path)
  const title = escape(pageTitle(meta))
  const description = escape(meta.description)
  const html = template
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}${path === '/' ? '' : path}`)
    // data-path lets main.jsx check the HTML matches the URL before hydrating it
    .replace('<div id="root"></div>', `<div id="root" data-path="${path}">${render(path)}</div>`)

  const out = path === '/' ? dist : new URL('.' + path + '/', dist)
  await mkdir(out, { recursive: true })
  await writeFile(new URL('index.html', out), html)
  console.log(`✓ ${path}`)
}

await rm(new URL('../dist-ssr/', import.meta.url), { recursive: true })
