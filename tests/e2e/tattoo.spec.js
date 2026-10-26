import { expect, tapStar, test } from './fixtures.js'

test('the hack plays, counts the scan, and can be skipped', async ({ page, api }) => {
  await page.goto('/tattoo')
  const hack = page.getByRole('dialog', { name: /hacking in progress/i })
  await expect(hack).toBeVisible()
  await expect(hack.getByText('You are victim #42')).toBeAttached()
  await page.getByRole('button', { name: 'Skip hack' }).click()
  await expect(hack).toBeHidden()
  await expect(page.getByRole('link', { name: /Work thing/ })).toBeVisible()
  await expect(page.getByText('42 people have scanned this tattoo')).toBeVisible()
  expect(api.scanPosts).toBe(1)
})

test('the hack clears itself after a few seconds', async ({ page }) => {
  await page.goto('/tattoo')
  await expect(page.getByRole('dialog', { name: /hacking in progress/i })).toBeHidden({ timeout: 10_000 })
  await expect(page.getByRole('link', { name: /Love interest/ })).toBeVisible()
})

test('coming back in the same visit skips the hack and does not count again', async ({ page, api }) => {
  await page.goto('/tattoo')
  await page.getByRole('button', { name: 'Skip hack' }).click()
  await page.reload()
  await expect(page.getByRole('link', { name: /A good friend/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(api.scanPosts).toBe(1)
})

test('no hack for people who ask for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/tattoo')
  await expect(page.getByRole('link', { name: /Work thing/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test.describe('reviews', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('tattoo-hack-seen', '1'))
  })

  test('the average includes the 5-star reviews from the old site', async ({ page }) => {
    // API: 2 ratings averaging 4.5 (9 stars) + 11 old 5-star reviews = 64 / 13 = 4.9
    await page.goto('/tattoo')
    await expect(page.getByText('4.9 from 13 ratings')).toBeVisible()
    await expect(page.getByText('This is pretty fukin cool nephew')).toBeVisible()
    await expect(page.locator('.review-list li').first().getByRole('img', { name: '5 out of 5 stars' })).toBeVisible()
  })

  test('a visitor can leave a star rating and comment', async ({ page }) => {
    await page.goto('/tattoo')
    const form = page.locator('.review-form')
    await tapStar(page, 4)
    await form.getByLabel('Comment (optional)').fill('Got hacked, 10/10')
    await form.getByRole('button', { name: 'Submit review' }).click()
    await expect(page.getByText("your comment will show up once I've read it")).toBeVisible()
  })

  test('asks for stars before sending', async ({ page }) => {
    await page.goto('/tattoo')
    await page.getByRole('button', { name: 'Submit review' }).click()
    await expect(page.getByText('Pick how many stars first.')).toBeVisible()
  })

  test('explains when someone has already reviewed today', async ({ page, api }) => {
    api.reviewStatus = 429
    api.reviewBody = { error: "You've already left a review today. Come back tomorrow." }
    await page.goto('/tattoo')
    await tapStar(page, 5)
    await page.getByRole('button', { name: 'Submit review' }).click()
    await expect(page.getByText('already left a review today')).toBeVisible()
  })

  test('without the database, old reviews still show and submitting explains why it failed', async ({ page, api }) => {
    api.down = true
    await page.goto('/tattoo')
    await expect(page.getByText('Changed my life')).toBeVisible()
    await expect(page.getByText('5.0 from 11 ratings')).toBeVisible()
    await expect(page.getByText('people have scanned')).toHaveCount(0)
    await tapStar(page, 5)
    await page.getByRole('button', { name: 'Submit review' }).click()
    await expect(page.getByText("Reviews aren't switched on yet")).toBeVisible()
  })
})
