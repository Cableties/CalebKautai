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

test.describe('reviews', () => {
  test('the average includes the 5-star reviews from the old site', async ({ page }) => {
    // API: 2 ratings averaging 4.5 (9 stars) + 11 old 5-star reviews = 64 / 13 = 4.9
    await openTattoo(page)
    await expect(page.getByText('4.9 from 13 ratings')).toBeVisible()
    await expect(page.getByText('This is pretty fukin cool nephew')).toBeVisible()
    await expect(page.locator('.review-list li').first().getByRole('img', { name: '5 out of 5 stars' })).toBeVisible()
  })

  test('a visitor can leave a star rating and comment', async ({ page }) => {
    await openTattoo(page)
    const form = page.locator('.review-form')
    await tapStar(page, 4)
    await form.getByLabel('Comment (optional)').fill('Got hacked, 10/10')
    await form.getByRole('button', { name: 'Submit review' }).click()
    await expect(page.getByText("your comment will show up once I've read it")).toBeVisible()
  })

  test('asks for stars before sending', async ({ page }) => {
    await openTattoo(page)
    await page.getByRole('button', { name: 'Submit review' }).click()
    await expect(page.getByText('Pick how many stars first.')).toBeVisible()
  })

  test('explains when someone has already reviewed today', async ({ page, api }) => {
    api.reviewStatus = 429
    api.reviewBody = { error: "You've already left a review today. Come back tomorrow." }
    await openTattoo(page)
    await tapStar(page, 5)
    await page.getByRole('button', { name: 'Submit review' }).click()
    await expect(page.getByText('already left a review today')).toBeVisible()
  })

  test('without the database, old reviews still show and submitting explains why it failed', async ({ page, api }) => {
    api.down = true
    await openTattoo(page)
    await expect(page.getByText('Changed my life')).toBeVisible()
    await expect(page.getByText('5.0 from 11 ratings')).toBeVisible()
    await expect(page.getByText('people have scanned')).toHaveCount(0)
    await tapStar(page, 5)
    await page.getByRole('button', { name: 'Submit review' }).click()
    await expect(page.getByText("Reviews aren't switched on yet")).toBeVisible()
  })
})
