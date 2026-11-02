import { SITE_NAME, notFoundMeta, pageMeta } from './content.js'

// Shared by the browser (Layout) and the build-time prerender, so both write the same <head>.
export const SITE = 'https://www.calebkautai.com'

export const metaFor = (pathname) => pageMeta[pathname.replace(/(.)\/$/, '$1')] ?? notFoundMeta

export const pageTitle = ({ title }) => (title ? `${title} | Caleb Kautai` : SITE_NAME)

// The one address search engines should list a page under (not the vercel.app copy, or with a
// trailing slash)
export const canonical = (pathname) => SITE + (pathname.replace(/(.)\/$/, '$1') === '/' ? '/' : pathname.replace(/\/$/, ''))
