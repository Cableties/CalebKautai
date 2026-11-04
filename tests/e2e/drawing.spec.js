import { readFile } from 'node:fs/promises'
import { expect, test } from './fixtures.js'

const pad = (page) => page.getByRole('img', { name: /^Drawing pad/ })

// Drag across the paper, through points given as fractions of its size
async function draw(page, ...points) {
  const sheet = pad(page)
  await sheet.scrollIntoViewIfNeeded()
  const box = await sheet.boundingBox()
  const [x0, y0] = points[0]
  await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0)
  await page.mouse.down()
  for (const [x, y] of points.slice(1)) await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 8 })
  await page.mouse.up()
}
async function tap(page, [x, y]) {
  const sheet = pad(page)
  await sheet.scrollIntoViewIfNeeded()
  const box = await sheet.boundingBox()
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y)
}
// The colour of the drawing at a point, as [r, g, b, a] (transparent where it's bare paper)
const pixel = (page, [x, y]) =>
  page.evaluate(([x, y]) => {
    const c = document.querySelector('.drawpad-canvas')
    return [...c.getContext('2d').getImageData(Math.round(c.width * x), Math.round(c.height * y), 1, 1).data]
  }, [x, y])

test.beforeEach(async ({ page }) => {
  await page.goto('/draw')
  // Strokes before the page has come to life would go nowhere
  await page.waitForLoadState('networkidle')
})

test('draws, undoes and redoes, and keeps the drawing for next time', async ({ page }) => {
  await expect(pad(page)).toHaveAccessibleName('Drawing pad, blank')
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled()
  await page.getByRole('radio', { name: 'Red' }).click()
  await draw(page, [0.2, 0.5], [0.8, 0.5])
  await expect(pad(page)).toHaveAccessibleName('Drawing pad, 1 marks')
  expect((await pixel(page, [0.5, 0.5]))[3]).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(pad(page)).toHaveAccessibleName('Drawing pad, blank')
  await expect.poll(async () => (await pixel(page, [0.5, 0.5]))[3]).toBe(0)
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(pad(page)).toHaveAccessibleName('Drawing pad, 1 marks')
  await page.reload()
  await expect(pad(page)).toHaveAccessibleName('Drawing pad, 1 marks')
  await expect.poll(async () => (await pixel(page, [0.5, 0.5]))[3]).toBeGreaterThan(0)
})

test('the fill bucket fills inside a shape, and the picker takes its colour', async ({ page }) => {
  await page.getByRole('radio', { name: 'Thick' }).click()
  await draw(page, [0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7], [0.3, 0.3])
  await page.getByRole('radio', { name: 'Fill' }).click()
  await page.getByRole('radio', { name: 'Blue', exact: true }).click()
  // Picking a colour keeps the bucket in hand
  await expect(page.getByRole('radio', { name: 'Fill' })).toBeChecked()
  await tap(page, [0.5, 0.5])
  await expect.poll(async () => (await pixel(page, [0.5, 0.5]))[3]).toBeGreaterThan(0)
  // Outside the square stays bare
  expect((await pixel(page, [0.1, 0.1]))[3]).toBe(0)
  await page.getByRole('radio', { name: 'Red' }).click()
  await page.getByRole('radio', { name: 'Colour picker' }).click()
  await tap(page, [0.5, 0.5])
  await expect(page.getByRole('radio', { name: 'Blue', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Fill' })).toBeChecked()
})

test('clearing asks twice, and can be undone', async ({ page }) => {
  await draw(page, [0.2, 0.2], [0.6, 0.6])
  const clear = page.getByRole('button', { name: 'Clear' })
  await clear.click()
  await expect(pad(page)).toHaveAccessibleName('Drawing pad, 1 marks')
  await page.getByRole('button', { name: 'Really clear?' }).click()
  await expect(pad(page)).toHaveAccessibleName('Drawing pad, blank')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(pad(page)).toHaveAccessibleName('Drawing pad, 1 marks')
})

test('saves a PNG, with or without the paper', async ({ page }) => {
  await draw(page, [0.2, 0.2], [0.6, 0.6])
  const save = async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PNG' }).click()])
    expect(download.suggestedFilename()).toMatch(/^drawing-\d{4}-\d\d-\d\d\.png$/)
    const file = await readFile(await download.path())
    expect(file.subarray(1, 4).toString()).toBe('PNG')
    return file
  }
  const withPaper = await save()
  await page.getByLabel(/Leave the paper out/).check()
  const without = await save()
  // Bare paper compresses to next to nothing
  expect(without.length).toBeLessThan(withPaper.length)
})

test('keys switch tools and undo, and the paper and shape change', async ({ page }) => {
  await page.keyboard.press('m')
  await expect(page.getByRole('radio', { name: 'Marker' })).toBeChecked()
  await page.keyboard.press('e')
  await expect(page.getByRole('radio', { name: 'Eraser' })).toBeChecked()
  await page.keyboard.press('p')
  await draw(page, [0.2, 0.2], [0.6, 0.6])
  await page.keyboard.press('Control+z')
  await expect(pad(page)).toHaveAccessibleName('Drawing pad, blank')
  await page.getByLabel('Shape', { exact: true }).selectOption('portrait')
  const box = await pad(page).boundingBox()
  expect(box.height).toBeGreaterThan(box.width)
  await page.getByLabel('Paper', { exact: true }).selectOption('grid')
  await page.getByRole('button', { name: 'Need an idea?' }).click()
  await expect(page.getByRole('button', { name: 'Another idea' })).toBeVisible()
})
