import { PRESETS } from '../../src/pages/DecisionWheel.jsx'
import { expect, test } from './fixtures.js'

// Read from the page's own presets, so the tests follow whatever options they hold
const [yesNo, food, bookClub] = ['Yes / No', 'Food', 'Book club'].map((name) => PRESETS.find((p) => p.name === name))
const foodNames = food.options.map((o) => o.label)
const pct = (weight, options) => `${Math.round((weight / options.reduce((t, o) => t + o.weight, 0)) * 100)}%`

const stage = (page) => page.getByRole('dialog')
const options = (page) => page.locator('.wheel-options li')

test.beforeEach(async ({ page }) => {
  // The short spin, so tests don't wait six seconds each time
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/decision-wheel')
})

const preset = (page, name) => page.getByRole('group', { name: 'Presets' }).getByRole('button', { name }).click()

test('starts as a 50/50 yes or no', async ({ page }) => {
  expect(PRESETS[0]).toBe(yesNo)
  await expect(page.getByLabel('What are we deciding?')).toHaveValue(yesNo.question)
  await expect(options(page)).toHaveCount(2)
  await expect(options(page).nth(0).getByRole('textbox')).toHaveValue('Yes')
  await expect(options(page).nth(1).getByRole('textbox')).toHaveValue('No')
  await expect(options(page).nth(0).locator('.wheel-chance')).toHaveText('50%')
})

test('the presets swap the question and options', async ({ page }) => {
  await preset(page, 'Food')
  await expect(page.getByLabel('What are we deciding?')).toHaveValue(food.question)
  await expect(options(page)).toHaveCount(food.options.length)
  await preset(page, 'Book club')
  await expect(page.getByLabel('What are we deciding?')).toHaveValue(bookClub.question)
  await expect(options(page)).toHaveCount(5)
  // Five blank spots to fill in, and no spinning until at least two have a title
  for (let n = 1; n <= 5; n++) {
    await expect(options(page).nth(n - 1).getByRole('textbox')).toHaveAttribute('placeholder', `Book ${n}`)
  }
  await expect(page.getByRole('button', { name: 'SPIN' })).toBeDisabled()
  await options(page).nth(0).getByRole('textbox').fill('Dune')
  await options(page).nth(1).getByRole('textbox').fill('Circe')
  await expect(page.getByRole('button', { name: 'SPIN' })).toBeEnabled()
  // Only the named books are on the wheel, so each has an even chance
  await expect(options(page).nth(0).locator('.wheel-chance')).toHaveText('50%')
  await preset(page, 'Yes / No')
  await expect(options(page)).toHaveCount(2)
})

test('weighting an option changes its chance', async ({ page }) => {
  await preset(page, 'Yes / No')
  await expect(options(page).first().locator('.wheel-chance')).toHaveText('50%')
  await options(page).first().getByRole('button', { name: 'More likely' }).click()
  await options(page).first().getByRole('button', { name: 'More likely' }).click()
  // Yes at weight 3, No at 1: 75 / 25
  await expect(options(page).first().locator('.wheel-chance')).toHaveText('75%')
  await expect(options(page).nth(1).locator('.wheel-chance')).toHaveText('25%')
  // And the Food preset's own weighting shows through
  await preset(page, 'Food')
  for (const [i, o] of food.options.entries()) {
    await expect(options(page).nth(i).locator('.wheel-chance')).toHaveText(pct(o.weight, food.options))
  }
})

test('options can be added and removed, and the wheel needs at least two', async ({ page }) => {
  await preset(page, 'Food')
  await page.getByRole('button', { name: '+ Add an option' }).click()
  await options(page).last().getByRole('textbox').fill('Dumplings')
  await expect(options(page)).toHaveCount(food.options.length + 1)
  for (const name of foodNames) {
    await page.getByRole('button', { name: `Remove ${name}` }).click()
  }
  await expect(page.getByRole('button', { name: 'SPIN' })).toBeDisabled()
  await expect(page.getByText('Add at least two options to spin.')).toBeVisible()
})

test('spinning takes over the screen and lands on a winner', async ({ page }) => {
  await preset(page, 'Food')
  await page.getByRole('button', { name: 'SPIN' }).click()
  await expect(stage(page)).toBeVisible()
  await expect(stage(page).getByRole('heading', { name: food.question })).toBeVisible()
  const winner = stage(page).locator('.wheel-winner')
  await expect(winner).toBeVisible({ timeout: 5000 })
  expect(foodNames).toContain(await winner.textContent())
  // The stage really fills the screen
  const box = await stage(page).boundingBox()
  const view = page.viewportSize()
  expect(Math.round(box.width)).toBe(view.width)
  expect(Math.round(box.height)).toBe(view.height)
})

test('the wheel lands on the slice it announces', async ({ page }) => {
  await preset(page, 'Food')
  await page.getByRole('button', { name: 'SPIN' }).click()
  const winner = await stage(page).locator('.wheel-winner').textContent({ timeout: 5000 })
  // Ask the page which slice sits under the pointer at the top of the wheel
  const under = await page.evaluate(() => {
    const svg = document.querySelector('.wheel-stage .wheel')
    const box = svg.getBoundingClientRect()
    // The circle is the biggest that fits the SVG's box, centred; its rim is 10/220 in from the edge
    const size = Math.min(box.width, box.height)
    const top = box.top + (box.height - size) / 2 + (size * 10) / 220
    const x = box.left + box.width / 2
    const y = top + size * 0.05 // just inside the rim, under the pointer
    const slice = document.elementsFromPoint(x, y).find((el) => el.matches('.wheel-stage path, .wheel-stage circle:not(.wheel-rim):not(.wheel-hub)'))
    return slice?.parentElement.querySelector('text')?.textContent
  })
  expect(under).toBe(winner)
})

test('"Remove it & spin again" knocks the winner off the wheel', async ({ page }) => {
  await preset(page, 'Food')
  await page.getByRole('button', { name: 'SPIN' }).click()
  const first = await stage(page).locator('.wheel-winner').textContent({ timeout: 5000 })
  await page.getByRole('button', { name: 'Remove it & spin again' }).click()
  await expect(stage(page).locator('.wheel-winner')).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Edit options' }).click()
  await expect(options(page)).toHaveCount(food.options.length - 1)
  await expect(page.getByRole('button', { name: `Remove ${first}` })).toHaveCount(0)
})

test('Escape closes the wheel and goes back to the options', async ({ page }) => {
  await page.getByRole('button', { name: 'SPIN' }).click()
  await expect(stage(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(stage(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'SPIN' })).toBeVisible()
})

test('the question and options are remembered for next time', async ({ page }) => {
  await page.getByLabel('What are we deciding?').fill('Movie night')
  await options(page).first().getByRole('textbox').fill('Shrek')
  await page.reload()
  await expect(page.getByLabel('What are we deciding?')).toHaveValue('Movie night')
  await expect(options(page).first().getByRole('textbox')).toHaveValue('Shrek')
})

test('"Start over" clears the wheel completely', async ({ page }) => {
  await preset(page, 'Food')
  await page.getByRole('button', { name: 'Start over' }).click()
  await expect(page.getByLabel('What are we deciding?')).toHaveValue('')
  await expect(options(page)).toHaveCount(2)
  for (const box of await options(page).getByRole('textbox').all()) await expect(box).toHaveValue('')
  await expect(page.getByRole('button', { name: 'SPIN' })).toBeDisabled()
})

for (const size of [{ width: 1280, height: 560 }, { width: 1440, height: 900 }, { width: 390, height: 664 }]) {
  test(`at ${size.width}×${size.height} the question, wheel and result don't overlap`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.getByRole('group', { name: 'Presets' }).getByRole('button', { name: 'Food' }).click()
    await page.getByRole('button', { name: 'SPIN' }).click()
    await expect(page.locator('.wheel-winner')).toBeVisible({ timeout: 5000 })
    const box = (sel) => page.locator(sel).boundingBox()
    const [question, pointer, wheel, result, close] = await Promise.all(
      ['.wheel-stage-question', '.wheel-pointer', '.wheel-stage .wheel', '.wheel-result', '.wheel-close'].map(box),
    )
    expect(question.y + question.height, 'question above the pointer').toBeLessThanOrEqual(pointer.y + 1)
    // The circle itself (not just its box): the biggest that fits, centred, rim 10/220 in from the edge
    const diameter = Math.min(wheel.width, wheel.height)
    const circleTop = wheel.y + (wheel.height - diameter) / 2 + (diameter * 10) / 220
    expect(pointer.y + pointer.height, 'pointer reaches the wheel').toBeGreaterThan(circleTop + 4)
    expect(pointer.y + pointer.height, 'pointer only just dips into it').toBeLessThan(circleTop + 30)
    expect(wheel.y + wheel.height, 'wheel above the result').toBeLessThanOrEqual(result.y + 1)
    expect(result.y + result.height, 'result on screen').toBeLessThanOrEqual(size.height + 1)
    expect(wheel.x >= 0 && wheel.x + wheel.width <= size.width, 'wheel within the width').toBe(true)
    // The close button isn't on top of the question
    expect(close.x >= question.x + question.width - 56 || close.y + close.height <= question.y + 4).toBe(true)
  })
}
