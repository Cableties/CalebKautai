import { SITE_NAME, notFoundMeta, pageMeta } from './content.js'

// Shared by the browser (Layout) and the build-time prerender, so both write the same <head>.
export const metaFor = (pathname) => pageMeta[pathname.replace(/(.)\/$/, '$1')] ?? notFoundMeta

export const pageTitle = ({ title }) => (title ? `${title} | Caleb Kautai` : SITE_NAME)
