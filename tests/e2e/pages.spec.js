import { notFoundMeta, pageMeta } from '../../src/content.js'
import { metaFor, pageTitle } from '../../src/meta.js'
import { expect, openNav, test } from './fixtures.js'

const visit = (page, path) => page.goto(path)

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

test.describe('bouncing head on the good friend page', () => {
  test('bounces around without getting in the way of taps', async ({ page }) => {
    await page.goto('/tattoo-good-friend')
    const head = page.locator('.bounce-head')
    await expect(head).toBeAttached()
    const first = await head.evaluate((el) => el.style.transform)
    await page.waitForTimeout(500)
    expect(await head.evaluate((el) => el.style.transform)).not.toBe(first)
    // Crisp pixel art: one frame of the sprite sheet at a time, scaled up without smoothing
    expect(await head.evaluate((el) => getComputedStyle(el).imageRendering)).toBe('pixelated')
    const { SPRITE, TILTS, POSES } = await import('../../src/lib/bounce.js')
    for (let i = 0; i < 10; i++) {
      const [bx, by, px] = await head.evaluate((el) => [
        ...el.style.backgroundPosition.split(' ').map(parseFloat),
        parseFloat(el.style.getPropertyValue('--px')),
      ])
      const col = -bx / (SPRITE.width * px)
      const row = -by / (SPRITE.height * px)
      expect(Number.isInteger(col) && col >= 0 && col < TILTS.length, `column ${col}`).toBe(true)
      expect(Number.isInteger(row) && row >= 0 && row < POSES.length, `row ${row}`).toBe(true)
      await page.waitForTimeout(100)
    }
    // Taps pass straight through it to whatever is underneath
    expect(await head.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')
  })

  test('moves smoothly, on every frame', async ({ page }) => {
    await page.goto('/tattoo-good-friend')
    await page.waitForTimeout(300)
    // The head's on-screen movement for each animation frame over 2 seconds, scaled to a 60fps frame
    const steps = await page.evaluate(
      () =>
        new Promise((done) => {
          const el = document.querySelector('.bounce-head')
          const out = []
          let prev = null
          const start = performance.now()
          function read(now) {
            const m = new DOMMatrix(getComputedStyle(el).transform)
            if (prev && now - prev[2] > 8 && now - prev[2] < 25) out.push(Math.hypot(m.e - prev[0], m.f - prev[1]) * (16.7 / (now - prev[2])))
            prev = [m.e, m.f, now]
            now - start < 2000 ? requestAnimationFrame(read) : done(out)
          }
          requestAnimationFrame(read)
        }),
    )
    // Snapping to the art's 2–3px grid used to freeze it on some frames and jump on others
    const frozen = steps.filter((s) => s < 0.5).length
    expect(frozen, `${frozen} of ${steps.length} frames without movement`).toBeLessThanOrEqual(steps.length * 0.05)
  })

  test('is left out for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/tattoo-good-friend')
    await expect(page.getByRole('heading', { name: 'Hey buddy!' })).toBeVisible()
    await expect(page.locator('.bounce-head')).toHaveCount(0)
  })
})
