import { test as base, expect } from '@playwright/test'

// Every test gets:
// - fake /api and Formspree responses (the preview server has no backend), overridable per test
// - external embeds stubbed, so tests don't depend on Google being reachable
// - a check that the page logged no errors of its own
export const test = base.extend({
  api: [
    async ({ page }, use) => {
      const api = {
        scans: 41,
        scanPosts: 0,
        reviews: { count: 2, average: 4.5, reviews: [] },
        reviewStatus: 201,
        reviewBody: { approved: false },
        down: false,
      }
      await page.route('**/api/scans', (route) => {
        if (api.down) return route.fulfill({ status: 503, json: { error: 'Storage is not configured' } })
        if (route.request().method() === 'POST') {
          api.scanPosts++
          api.scans++
        }
        return route.fulfill({ json: { count: api.scans } })
      })
      await page.route('**/api/reviews', (route) => {
        if (api.down) return route.fulfill({ status: 503, json: { error: 'Storage is not configured' } })
        return route.request().method() === 'POST'
          ? route.fulfill({ status: api.reviewStatus, json: api.reviewBody })
          : route.fulfill({ json: api.reviews })
      })
      await page.route('https://formspree.io/**', (route) => route.fulfill({ json: { ok: true } }))
      await page.route('https://www.google.com/maps**', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>map</title>' }),
      )
      // Vercel serves its analytics script only on deployments
      await page.route('**/_vercel/**', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
      await use(api)
    },
    { auto: true },
  ],

  consoleErrors: [
    async ({ page }, use) => {
      const errors = []
      page.on('pageerror', (err) => errors.push(err.message))
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return
        // Browsers log every failed request; API failures are expected in some tests and the page handles them
        if (msg.text().startsWith('Failed to load resource') && msg.location().url.includes('/api/')) return
        errors.push(msg.text())
      })
      await use(errors)
      expect(errors, 'console errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

// On phones the nav sits behind the Menu button. A tap that lands before the page has hydrated
// does nothing, so keep trying until the menu reports itself open.
export async function openNav(page) {
  const menu = page.locator('.menu-button')
  if (!(await menu.isVisible())) return
  await expect(async () => {
    if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 })
  }).toPass()
}

// Tap the nth star (1–5) in the review form, the way a visitor would
export const tapStar = (page, n) => page.locator('.star-input label').nth(n - 1).click()
