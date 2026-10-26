import { relationship } from '../../src/content.js'
import { expect, test } from './fixtures.js'

const popup = (page) => page.getByRole('dialog', { name: 'I hate to break your heart but...' })

test('the love interest page opens with the I-am-taken popup', async ({ page }) => {
  await page.goto('/tattoo-love-interest')
  await expect(popup(page)).toBeVisible()
  await expect(popup(page)).toContainText('I am currently in a loving relationship')
  await expect(popup(page)).toContainText("But I'm afraid that I'm currently not taking applications xx")
  // Only points at photos when there are some
  if (relationship.photos.length) await expect(popup(page)).toContainText('(see photos below)')
  else await expect(popup(page)).not.toContainText('see photos below')
})

for (const [how, close] of [
  ['the × button', (page) => page.getByRole('button', { name: 'Close' }).click()],
  ['the perks button', (page) => page.getByRole('button', { name: 'Show me the perks anyway' }).click()],
  ['Escape', (page) => page.keyboard.press('Escape')],
  ['tapping outside it', (page) => page.mouse.click(5, 5)],
]) {
  test(`closing with ${how} leaves the page as it was`, async ({ page }) => {
    await page.goto('/tattoo-love-interest')
    await expect(popup(page)).toBeVisible()
    await close(page)
    await expect(popup(page)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'I have a car' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit application' })).toBeEnabled()
  })
}

test('the popup takes focus, so keyboard users land in it', async ({ page }) => {
  await page.goto('/tattoo-love-interest')
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused()
})
