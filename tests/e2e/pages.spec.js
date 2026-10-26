import { notFoundMeta, pageMeta } from '../../src/content.js'
import { metaFor, pageTitle } from '../../src/meta.js'
import { expect, openNav, test } from './fixtures.js'

// The tattoo page opens with the fake hack; skip it here, it has its own tests.
async function visit(page, path) {
  await page.addInitScript(() => sessionStorage.setItem('tattoo-hack-seen', '1'))
  await page.goto(path)
}

for (const path of Object.keys(pageMeta)) {
  test(`${path} loads with its title and heading, and fits the screen`, async ({ page }) => {
    await visit(page, path)
    await expect(page).toHaveTitle(pageTitle(metaFor(path)))
    await expect(page.locator('h1').first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, 'horizontal scroll').toBeLessThanOrEqual(0)
  })
}

test('pages arrive prerendered, with content before JavaScript runs', async ({ request }) => {
  const html = await (await request.get('/about')).text()
  expect(html).toContain('data-path="/about"')
  expect(html).toContain('Bendigo')
  expect(html).toContain('<title>About | Caleb Kautai</title>')
})

test('an unknown link shows the not-found page', async ({ page }) => {
  await page.goto('/some/old/wix/link')
  await expect(page).toHaveTitle(pageTitle(notFoundMeta))
  await expect(page.getByRole('heading', { name: "This page doesn't exist" })).toBeVisible()
})

test('the nav moves between pages', async ({ page }) => {
  await visit(page, '/')
  await openNav(page)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Work' }).click()
  await expect(page).toHaveURL('/work')
  await expect(page.getByRole('heading', { name: 'Selected work' })).toBeVisible()
})

test('the theme toggle switches to dark mode and remembers it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await visit(page, '/')
  await page.getByRole('button', { name: 'Dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('the love-interest application sends', async ({ page }) => {
  await visit(page, '/tattoo-love-interest')
  await page.getByLabel('First name').fill('Testy')
  await page.getByRole('button', { name: 'Submit application' }).click()
  await expect(page.getByText('Application received')).toBeVisible()
})

test('the work page lists projects and skills', async ({ page }) => {
  await visit(page, '/work')
  const { projects } = await import('../../src/content.js')
  await expect(page.locator('.project')).toHaveCount(projects.length)
  await expect(page.getByRole('link', { name: 'More on GitHub' })).toHaveAttribute('href', 'https://github.com/Cableties')
  await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Email me' }).first()).toHaveAttribute('href', /^mailto:/)
})

test('find me shows coordinates and a map', async ({ page }) => {
  await visit(page, '/find-me')
  await expect(page.getByText('Latitude')).toBeVisible()
  await expect(page.locator('.map iframe')).toHaveAttribute('src', /maps\?q=-27\.\d+,15[23]\.\d+/)
})
