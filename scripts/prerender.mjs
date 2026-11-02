// Writes a static HTML file per route into dist/, so pages show content (and the right
// title, description and link preview) before JavaScript loads. Runs as the last build step.
// Also writes the 404 page, the sitemap and robots.txt, for search engines.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const { render, pageMeta, notFoundMeta, socials, metaFor, pageTitle, canonical, SITE } = await import('../dist-ssr/entry-server.js')
const template = await readFile(new URL('index.html', dist), 'utf8')

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Who the site's about, for search engines (the home page only): my name in results, and my socials
const person = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: 'Caleb Kautai', alternateName: 'Caleb Kautai: The web experience', inLanguage: 'en-AU' },
    {
      '@type': 'Person',
      '@id': `${SITE}/#me`,
      name: 'Caleb Kautai',
      url: `${SITE}/`,
      image: `${SITE}/og.png`,
      jobTitle: 'Software engineer',
      homeLocation: { '@type': 'Place', name: 'Brisbane, Australia' },
      birthPlace: { '@type': 'Place', name: 'Bendigo, Australia' },
      sameAs: socials.map((s) => s.href),
    },
  ],
}

function page(path, meta, html) {
  const title = escape(pageTitle(meta))
  const description = escape(meta.description)
  const url = canonical(path)
  // A page kept out of search results has no address to list it under
  let head = meta.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${url}" />`
  if (path === '/') head += `\n    <script type="application/ld+json">${JSON.stringify(person).replace(/</g, '\u003c')}</script>`
  return template
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${title}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/<link rel="canonical"[^>]*>/, head)
    .replace('<div id="root"></div>', html)
}

for (const path of Object.keys(pageMeta)) {
  // data-path lets main.jsx check the HTML matches the URL before hydrating it
  const html = page(path, metaFor(path), `<div id="root" data-path="${path}">${render(path)}</div>`)
  const out = path === '/' ? dist : new URL('.' + path + '/', dist)
  await mkdir(out, { recursive: true })
  await writeFile(new URL('index.html', out), html)
  console.log(`✓ ${path}`)
}

// Served (as a real 404) for any address that isn't a page; it renders afresh for whatever URL it's at
await writeFile(new URL('404.html', dist), page('/404', notFoundMeta, '<div id="root"></div>'))

const listed = Object.keys(pageMeta).filter((path) => !pageMeta[path].noindex)
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${listed.map((path) => `  <url><loc>${canonical(path)}</loc></url>`).join('\n')}
</urlset>
`
await writeFile(new URL('sitemap.xml', dist), sitemap)
await writeFile(new URL('robots.txt', dist), `User-agent: *\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`)
console.log(`✓ 404, sitemap (${listed.length} pages), robots.txt`)

await rm(new URL('../dist-ssr/', import.meta.url), { recursive: true })
