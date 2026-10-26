import { friendQuiz as live } from '../../src/content.js'
import { expect, test } from './fixtures.js'

async function start(page) {
  await page.goto('/tattoo-good-friend')
  await page.getByRole('button', { name: 'Start the quiz' }).click()
}

// Win knots and crosses: with the computer's random picks pinned high, it always takes the last
// free square, so going 1-2-3 across the top wins
async function winTicTacToe(page) {
  for (const square of [1, 2, 3]) {
    await page.getByRole('gridcell', { name: `Empty square ${square}` }).click()
    await page.waitForTimeout(450)
  }
}

// A quick squiggle on the drawing canvas
async function scribble(page) {
  await page.locator('.draw-canvas').scrollIntoViewIfNeeded()
  const box = await page.locator('.draw-canvas').boundingBox()
  await page.mouse.move(box.x + 40, box.y + 40)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 40 + i * 15, box.y + 40 + (i % 2) * 30)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Done' }).click()
}

async function answerCorrectly(page, q) {
  if (q.type === 'choice') await page.getByRole('button', { name: q.answer, exact: true }).click()
  if (q.type === 'tictactoe') await winTicTacToe(page)
  if (q.type === 'draw') await scribble(page)
  if (q.type === 'map') {
    // Too fiddly to land exactly on the town in a test; the map test below covers it
    await page.getByRole('button', { name: 'Lock it in' }).click()
  }
}

test('only the questions that are ready are asked', async ({ page }) => {
  await start(page)
  await expect(page.getByText(`Question 1 of ${live.length}`)).toBeVisible()
})

test('a full run with every answer right scores every question but the map', async ({ page }) => {
  await page.addInitScript(() => (Math.random = () => 0.999))
  await start(page)
  // The map question can't be landed exactly in a test, so this run leaves it out of the perfect score
  let right = 0
  for (const q of live) {
    await expect(page.getByRole('heading', { name: q.question })).toBeVisible()
    await answerCorrectly(page, q)
    const verdict = page.getByRole('status').filter({ hasText: /Correct!|Nope\./ })
    await expect(verdict).toBeVisible()
    if (q.type !== 'map') {
      await expect(verdict).toContainText('Correct!')
      right++
    }
    await page.getByRole('button', { name: /Next question|See how you did/ }).click()
  }
  await expect(page.getByText(`${right}/${live.length}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('a wrong answer shows the right one', async ({ page }) => {
  await start(page)
  const q = live[0]
  await page.getByRole('button', { name: q.options[0], exact: true }).click()
  await expect(page.getByText('Nope.')).toBeVisible()
  await expect(page.getByText(`It's ${q.answer}.`)).toBeVisible()
  await expect(page.getByRole('button', { name: q.answer, exact: true })).toHaveClass(/right/)
})

test('the map question says how far off the pin was', async ({ page }) => {
  await start(page)
  const mapIndex = live.findIndex((q) => q.type === 'map')
  for (let i = 0; i < mapIndex; i++) {
    const q = live[i]
    if (q.type === 'tictactoe') {
      // Any finish will do here: keep playing free squares until the game ends
      for (let n = 1; n <= 9 && !(await page.getByText(/Correct!|Nope\./).count()); n++) {
        const free = page.getByRole('gridcell', { name: /Empty square/ }).first()
        if (await free.count()) await free.click()
        await page.waitForTimeout(450)
      }
    } else {
      await page.getByRole('button', { name: q.answer, exact: true }).click()
    }
    await page.getByRole('button', { name: /Next question|See how you did/ }).click()
  }
  const map = page.locator('.quiz-map-box')
  await expect(map).toBeVisible()
  // Tap the far south-west of the map, a long way from Mt Isa
  const box = await map.boundingBox()
  await page.mouse.click(box.x + 20, box.y + box.height - 20)
  await page.getByRole('button', { name: 'Lock it in' }).click()
  await expect(page.getByText(/You were [\d,]+ km off\./)).toBeVisible()
})

test('Try again starts over', async ({ page }) => {
  await page.addInitScript(() => (Math.random = () => 0.999))
  await start(page)
  for (const q of live) {
    await answerCorrectly(page, q)
    await page.getByRole('button', { name: /Next question|See how you did/ }).click()
  }
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText(`Question 1 of ${live.length}`)).toBeVisible()
})

// Answer everything up to (not including) the question of the given type
async function skipTo(page, type) {
  for (const q of live.slice(0, live.findIndex((x) => x.type === type))) {
    if (q.type === 'tictactoe') {
      for (let n = 1; n <= 9 && !(await page.getByText(/Correct!|Nope\./).count()); n++) {
        const free = page.getByRole('gridcell', { name: /Empty square/ }).first()
        if (await free.count()) await free.click()
        await page.waitForTimeout(450)
      }
    } else if (q.type === 'map') {
      await page.getByRole('button', { name: 'Lock it in' }).click()
    } else if (q.type === 'draw') {
      await scribble(page)
    } else {
      await page.getByRole('button', { name: q.answer, exact: true }).click()
    }
    await page.getByRole('button', { name: /Next question|See how you did/ }).click()
  }
}

test('after locking in, the map shows where the answer really is', async ({ page }) => {
  await start(page)
  await skipTo(page, 'map')
  await page.getByRole('button', { name: 'Lock it in' }).click()
  await expect(page.locator('.quiz-pin.answer')).toBeVisible()
})

test('drawing me always scores, and shows the drawing next to the real thing', async ({ page }) => {
  await start(page)
  await skipTo(page, 'draw')
  await scribble(page)
  await expect(page.getByText('Correct!')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Your drawing of Caleb' })).toHaveAttribute('src', /^data:image\/png/)
  await expect(page.getByRole('img', { name: 'Caleb', exact: true })).toBeVisible()
})

test('a blank drawing does not count', async ({ page }) => {
  await start(page)
  await skipTo(page, 'draw')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText("You didn't draw anything")).toBeVisible()
})

test('undo and clear work on the drawing', async ({ page }) => {
  await start(page)
  await skipTo(page, 'draw')
  await page.locator('.draw-canvas').scrollIntoViewIfNeeded()
  const box = await page.locator('.draw-canvas').boundingBox()
  await page.mouse.move(box.x + 50, box.y + 50)
  await page.mouse.down()
  await page.mouse.move(box.x + 150, box.y + 150)
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
})
