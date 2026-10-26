import { expect, openNav, test } from './fixtures.js'

// Whether audio actually plays depends on the test browser's codecs, so these tests check the
// player's controls and that it survives navigation, not the sound itself.
test('an episode keeps its player while moving between pages', async ({ page }) => {
  await page.goto('/aliens')
  await page.getByRole('button', { name: "Play Mika's interview" }).click()

  const player = page.getByRole('region', { name: 'Podcast player' })
  await expect(player).toBeVisible()
  await expect(player.getByText('Mika suspects Matt D')).toBeVisible()
  const src = await page.locator('audio').getAttribute('src')
  expect(src).toBe('/audio/mika.m4a')

  await openNav(page)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'About' }).click()
  await expect(page).toHaveURL('/about')
  await expect(player).toBeVisible()
  await expect(page.locator('audio')).toHaveAttribute('src', '/audio/mika.m4a')

  await player.getByRole('button', { name: 'Close player' }).click()
  await expect(player).toBeHidden()
})

test('choosing another episode switches the player to it', async ({ page }) => {
  await page.goto('/aliens')
  await page.getByRole('button', { name: "Play Mika's interview" }).click()
  await page.getByRole('button', { name: "Play Jacob's interview" }).click()
  await expect(page.getByRole('region', { name: 'Podcast player' }).getByText('Jacob suspects Tony')).toBeVisible()
  await expect(page.locator('audio')).toHaveAttribute('src', '/audio/jacob.m4a')
})

test('every interview links to an audio file that exists', async ({ page, request }) => {
  await page.goto('/aliens')
  const count = await page.locator('.interview-play').count()
  expect(count).toBe(18)
  const { interviews } = await import('../../src/content.js')
  for (const { audio } of interviews) {
    const res = await request.head(audio)
    expect(res.status(), audio).toBe(200)
  }
})
