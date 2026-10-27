import { ROUND_MS } from '../../src/lib/bonk.js'
import { expect, openNavGroup, test } from './fixtures.js'

test('the games page lists the games, and the menu leads there', async ({ page }) => {
  await page.goto('/')
  await openNavGroup(page, 'Fun stuff')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Games' }).click()
  await expect(page.getByRole('heading', { name: 'Games', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: /Flappy Head/ }).click()
  await expect(page.getByRole('heading', { name: 'Flappy Head', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: '← All games' }).click()
  await page.getByRole('link', { name: /Bonk/ }).click()
  await expect(page.getByRole('heading', { name: 'Bonk', level: 1 })).toBeVisible()
})

test.describe('Flappy Head', () => {
  test('starts with a tap, and without flapping the head falls and splats', async ({ page, api }) => {
    api.scores['flappy-head'] = [{ initials: 'CAL', score: 23 }]
    await page.goto('/games/flappy-head')
    await expect(page.getByRole('region', { name: 'High scores' })).toContainText('CAL')
    await expect(page.getByText('Tap to start')).toBeVisible()
    await page.locator('.game-stage').click()
    await expect(page.getByText('Tap to start')).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Splat!' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Score: 0')).toBeVisible()
    // Nothing to put on the board for zero
    await expect(page.getByLabel('Your initials')).toHaveCount(0)
    await page.getByRole('button', { name: 'Play again' }).click()
    await expect(page.getByRole('heading', { name: 'Splat!' })).toBeHidden()
  })

  test('Space flaps (and starts it)', async ({ page }) => {
    await page.goto('/games/flappy-head')
    await page.keyboard.press('Space')
    await expect(page.getByText('Tap to start')).toBeHidden()
    // Keep flapping and it stays up for longer than a plain fall (which takes under a second)
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Space')
      await page.waitForTimeout(150)
    }
    await expect(page.getByRole('heading', { name: 'Splat!' })).toHaveCount(0)
  })
})

test.describe('Bonk', () => {
  test('bonking heads scores, and the score goes on the board', async ({ page, api }) => {
    await page.clock.install()
    await page.goto('/games/bonk')
    await expect(page.getByText('No scores yet. Be the first!')).toBeVisible()
    await page.getByRole('button', { name: 'Start' }).click()
    for (let i = 1; i <= 3; i++) {
      await page.clock.runFor(450)
      await page.getByRole('button', { name: 'Bonk the head!' }).click()
      await expect(page.locator('.bonk-bar')).toContainText(`Score ${i}`)
      // A hole with no head in it does nothing
      await page.getByRole('button', { name: /^Hole / }).first().click()
      await expect(page.locator('.bonk-bar')).toContainText(`Score ${i}`)
    }
    await page.clock.runFor(ROUND_MS)
    await expect(page.getByRole('heading', { name: 'Time!' })).toBeVisible()
    await expect(page.getByText('Score: 3 · New best!')).toBeVisible()

    const initials = page.getByLabel('Your initials')
    await initials.fill('c4l!x')
    await expect(initials).toHaveValue('C4L')
    await page.getByRole('button', { name: 'Save score' }).click()
    await expect(page.getByText("You're #1 on the board!")).toBeVisible()
    expect(api.scorePosts).toEqual([{ game: 'bonk', initials: 'C4L', score: 3, run: 'run-bonk' }])
    await expect(page.getByRole('region', { name: 'High scores' })).toContainText('C4L')
  })

  test('a rejected score explains itself', async ({ page, api }) => {
    api.scoreStatus = 400
    await page.clock.install()
    await page.goto('/games/bonk')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.clock.runFor(450)
    await page.getByRole('button', { name: 'Bonk the head!' }).click()
    await page.clock.runFor(ROUND_MS)
    await page.getByLabel('Your initials').fill('CAL')
    await page.getByRole('button', { name: 'Save score' }).click()
    await expect(page.getByRole('alert')).toHaveText("That score doesn't look right.")
  })

  test('without the database the games still work, just with no board', async ({ page, api }) => {
    api.down = true
    await page.clock.install()
    await page.goto('/games/bonk')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.clock.runFor(450)
    await page.getByRole('button', { name: 'Bonk the head!' }).click()
    await page.clock.runFor(ROUND_MS)
    await expect(page.getByText('Score: 1')).toBeVisible()
    await expect(page.getByLabel('Your initials')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'High scores' })).toHaveCount(0)
  })
})
