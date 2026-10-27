import { expect, openTattoo, tapStar, test } from './fixtures.js'

const hackDialog = (page) => page.getByRole('dialog', { name: /hacking in progress/i })

test('the hack plays through, then waits for the visitor to continue', async ({ page, api }) => {
  await page.goto('/tattoo')
  const hack = hackDialog(page)
  await expect(hack).toBeVisible()
  await expect(hack.getByText('You are victim #42')).toBeAttached()

  const next = page.getByRole('button', { name: 'Continue' })
  await expect(next).toBeVisible({ timeout: 10_000 })
  await expect(next).toBeFocused()
  // It never clears itself
  await page.waitForTimeout(2000)
  await expect(hack).toBeVisible()

  await next.click()
  await expect(hack).toBeHidden()
  await expect(page.getByRole('link', { name: /Love interest/ })).toBeVisible()
  await expect(page.getByText('42 people have scanned this tattoo')).toBeVisible()
  expect(api.scanPosts).toBe(1)
})

test('the hologram is one animated image, so its effects stay in step', async ({ page }) => {
  await openTattoo(page)
  const holo = page.locator('.holo')
  await expect(holo.getByRole('img', { name: /spinning, as a hologram/ })).toBeVisible()
  // Copies of the animation (as backgrounds or masks) each keep their own clock and drift apart
  const copies = await holo.evaluate((root) =>
    [root, ...root.querySelectorAll('*')].filter((el) => {
      const style = getComputedStyle(el)
      return [style.backgroundImage, style.maskImage, style.webkitMaskImage].some((v) => v?.includes('url('))
    }).length,
  )
  expect(copies).toBe(0)
  await expect(holo.locator('img')).toHaveCount(1)
})

test('the hack can be skipped while it plays', async ({ page }) => {
  await page.goto('/tattoo')
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Skip hack' }).click()
  await expect(hackDialog(page)).toBeHidden()
  await expect(page.getByRole('link', { name: /Work thing/ })).toBeVisible()
})

test('the hack plays on every visit, but a visit only counts once', async ({ page, api }) => {
  await page.goto('/tattoo')
  await page.getByRole('button', { name: 'Skip hack' }).click()
  await page.reload()
  await expect(hackDialog(page)).toBeVisible()
  await page.getByRole('button', { name: 'Skip hack' }).click()
  await page.getByRole('link', { name: /Work thing/ }).click()
  // Wait for the page itself, not just the URL: the fade transition renders it a moment later
  await expect(page.getByRole('heading', { name: 'Selected work' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL('/tattoo')
  await expect(hackDialog(page)).toBeVisible()
  expect(api.scanPosts).toBe(1)
})

test('with reduced motion the hack is a still screen, ready to continue', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/tattoo')
  const hack = hackDialog(page)
  await expect(hack.getByText('ACCESS GRANTED')).toBeVisible()
  await expect(hack.getByText('Downloading bank details')).toBeVisible()
  await expect(hack.getByText('photos found')).toBeVisible()
  const next = page.getByRole('button', { name: 'Continue' })
  await expect(next).toBeFocused()
  await next.click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Work thing/ })).toBeVisible()
})

test.describe('guestbook', () => {
  const form = (page) => page.locator('.review-form')
  const sign = (page) => form(page).getByRole('button', { name: 'Sign the guestbook' })

  // Drag across the doodle pad, between two points given as fractions of its size
  async function draw(page, [x0, y0], [x1, y1]) {
    const pad = form(page).getByLabel('Doodle pad')
    await pad.scrollIntoViewIfNeeded()
    const box = await pad.boundingBox()
    await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1, { steps: 8 })
    await page.mouse.up()
  }

  test('the average includes the 5-star reviews from the old site', async ({ page }) => {
    // API: 2 ratings averaging 4.5 (9 stars) + 11 old 5-star reviews = 64 / 13 = 4.9
    await openTattoo(page)
    await expect(page.getByRole('heading', { name: 'Sign the guestbook' })).toBeVisible()
    await expect(page.getByText('4.9 from 13 ratings')).toBeVisible()
    await expect(page.getByText('This is pretty fukin cool nephew')).toBeVisible()
    await expect(page.locator('.review-list li').first().getByRole('img', { name: '5 out of 5 stars' })).toBeVisible()
  })

  test('a visitor can leave a star rating and comment', async ({ page, api }) => {
    await openTattoo(page)
    await tapStar(page, 4)
    await form(page).getByLabel('Comment (optional)').fill('Got hacked, 10/10')
    await sign(page).click()
    await expect(page.getByText("Your stars are in, and the rest will show up once I've had a look.")).toBeVisible()
    expect(api.reviewPosts[0]).toMatchObject({ rating: 4, comment: 'Got hacked, 10/10', doodle: [], website: '' })
  })

  test('a doodle can go in on its own, with no stars', async ({ page, api }) => {
    await openTattoo(page)
    await form(page).getByRole('radio', { name: 'Pink' }).click()
    await draw(page, [0.1, 0.1], [0.9, 0.9])
    await sign(page).click()
    await expect(page.getByText("Thanks! It'll show up once I've had a look.")).toBeVisible()

    const [sent] = api.reviewPosts
    expect(sent.rating).toBeNull()
    expect(sent.doodle).toHaveLength(1)
    const [{ ink, points }] = sent.doodle
    expect(ink).toBe(1)
    // On the 200 × 200 grid: from near the top left to near the bottom right
    expect(points.slice(0, 2).every((n) => n >= 15 && n <= 25)).toBe(true)
    expect(points.slice(-2).every((n) => n >= 175 && n <= 185)).toBe(true)
  })

  test('undo and clear take strokes off the pad', async ({ page }) => {
    await openTattoo(page)
    await draw(page, [0.1, 0.3], [0.9, 0.3])
    await draw(page, [0.1, 0.6], [0.9, 0.6])
    const undo = form(page).getByRole('button', { name: 'Undo' })
    await undo.click()
    await expect(undo).toBeEnabled()
    await form(page).getByRole('button', { name: 'Clear' }).click()
    await expect(undo).toBeDisabled()
  })

  test('shows doodles, and entries without stars, in the list', async ({ page, api }) => {
    api.reviews = {
      count: 2,
      average: 4.5,
      reviews: [
        { id: 'a', rating: null, name: 'Kev', comment: 'You got me', doodle: [{ ink: 1, points: [20, 20, 180, 180] }], createdAt: '2026-10-01T00:00:00Z' },
        // Saved before the rename
        { id: 'b', rating: 5, name: 'Anonymous victim', comment: '', createdAt: '2026-09-01T00:00:00Z' },
      ],
    }
    await openTattoo(page)
    const [kev, anon] = [page.locator('.review-list li').nth(0), page.locator('.review-list li').nth(1)]
    await expect(kev.getByRole('img', { name: 'Doodle by Kev' })).toBeVisible()
    await expect(kev.getByRole('img', { name: /out of 5 stars/ })).toHaveCount(0)
    await expect(kev).toContainText('You got me')
    await expect(anon.locator('strong')).toHaveText('Anonymous')
    await expect(anon.getByRole('img', { name: '5 out of 5 stars' })).toBeVisible()
  })

  test('asks for something before sending', async ({ page, api }) => {
    await openTattoo(page)
    await sign(page).click()
    await expect(page.getByText('Leave some stars, a comment or a doodle first.')).toBeVisible()
    expect(api.reviewPosts).toHaveLength(0)
  })

  test('explains when someone has already signed today', async ({ page, api }) => {
    api.reviewStatus = 429
    api.reviewBody = { error: "You've already signed today. Come back tomorrow." }
    await openTattoo(page)
    await tapStar(page, 5)
    await sign(page).click()
    await expect(page.getByText('already signed today')).toBeVisible()
  })

  test('without the database, old reviews still show and submitting explains why it failed', async ({ page, api }) => {
    api.down = true
    await openTattoo(page)
    await expect(page.getByText('Changed my life')).toBeVisible()
    await expect(page.getByText('5.0 from 11 ratings')).toBeVisible()
    await expect(page.getByText('people have scanned')).toHaveCount(0)
    await tapStar(page, 5)
    await sign(page).click()
    await expect(page.getByText("The guestbook isn't switched on yet")).toBeVisible()
  })
})
