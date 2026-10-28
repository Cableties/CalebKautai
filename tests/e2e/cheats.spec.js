import { CHEATS } from '../../src/components/Cheats.jsx'
import { expect, openNav, openNavGroup, test } from './fixtures.js'

const html = (page) => page.locator('html')
const cheatSwitch = (page, name) => page.getByRole('switch', { name, exact: true })
const toggleCheat = (page, name) => cheatSwitch(page, name).click()

async function openCheats(page) {
  await page.goto('/')
  await openNavGroup(page, 'Fun stuff')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Cheat codes' }).click()
  await expect(page.getByRole('heading', { name: 'Cheat codes', level: 1 })).toBeVisible()
}

test('each cheat switches on and off from the cheat codes page', async ({ page }) => {
  await openCheats(page)
  for (const { name, id } of CHEATS.filter((c) => !c.hidden)) {
    const attr = `data-cheat-${id}`
    const sw = cheatSwitch(page, name)
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await expect(html(page)).toHaveAttribute(attr, '')
    await expect(page.getByText(`${name} activated`)).toBeVisible()
    await sw.click()
    await expect(html(page)).not.toHaveAttribute(attr, '')
  }
})

test('Head Mode puts the bouncing head on every page', async ({ page }) => {
  await openCheats(page)
  await expect(page.locator('.bounce-head')).toHaveCount(0)
  await toggleCheat(page, 'Head Mode')
  await expect(page.locator('.bounce-head')).toHaveCount(1)
  await openNav(page)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Work' }).click()
  await expect(page).toHaveURL('/work')
  await expect(page.locator('.bounce-head')).toHaveCount(1)
  // Only one head on the page that already had its own
  await page.goto('/tattoo-good-friend')
  await expect(page.locator('.bounce-head')).toHaveCount(1)
})

test("Amber's head bounces on the love interest page, and Amber Mode puts it on every page", async ({ page }) => {
  const amber = page.locator('.bounce-head[data-head="amber"]')
  await page.goto('/tattoo-love-interest')
  await expect(amber).toHaveCount(1)
  await expect(page.locator('.bounce-head')).toHaveCount(1)
  // Her own sheet, in taller frames
  expect(await amber.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('amber-sprites.png')
  expect(await amber.evaluate((el) => el.offsetHeight / el.offsetWidth)).toBeGreaterThan(1)

  await openCheats(page)
  await expect(amber).toHaveCount(0)
  await toggleCheat(page, 'Amber Mode')
  await expect(amber).toHaveCount(1)
  // Both heads at once
  await toggleCheat(page, 'Head Mode')
  await expect(page.locator('.bounce-head')).toHaveCount(2)
  // Still only one of Amber on the page that already had its own
  await page.goto('/tattoo-love-interest')
  await expect(amber).toHaveCount(1)
})

test('typing AMBER switches on Amber Mode', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.type('amber')
  await expect(html(page)).toHaveAttribute('data-cheat-amber', '')
  await expect(page.locator('.bounce-head[data-head="amber"]')).toHaveCount(1)
})

test.describe('both heads', () => {
  test.use({ grabbableHead: true })

  test('dragging one into the other shoves it, and puts a pixel heart over them', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('cheats', JSON.stringify(['head'])))
    // Frozen time: the heads only move when the test says, so they stay where they're measured
    await page.clock.install()
    await page.goto('/tattoo-love-interest')
    await page.keyboard.press('Escape') // the "I'm taken" popup
    await page.clock.runFor(400)
    const heart = page.locator('.bump-heart')
    const centre = async (who) => {
      const box = await page.locator(`.bounce-head[data-head="${who}"]`).boundingBox()
      return [box.x + box.width / 2, box.y + box.height / 2]
    }
    // Carry Amber's head onto Caleb's: his gets pushed out of the way
    await expect(async () => {
      const [x, y] = await centre('caleb')
      await page.mouse.move(...(await centre('amber')))
      await page.mouse.down()
      await page.mouse.move(x, y, { steps: 5 })
      await page.clock.runFor(50)
      const [x2, y2] = await centre('caleb')
      await page.mouse.up()
      expect(Math.hypot(x2 - x, y2 - y)).toBeGreaterThan(30)
      expect(await heart.count()).toBeGreaterThan(0)
    }).toPass({ timeout: 10_000 })
    await expect(heart.first()).toHaveAttribute('aria-hidden', 'true')
    expect(await heart.first().evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')
  })
})

test('Dance Mode cycles the colours', async ({ page }) => {
  await openCheats(page)
  await toggleCheat(page, 'Dance Mode')
  const colour = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pink').trim())
  const first = await colour()
  // A slow machine can drop frames, so give it a few seconds to move on
  await expect.poll(colour, { timeout: 5000 }).not.toBe(first)
})

test('Dance Mode changes the bouncing head colours along with everything else', async ({ page }) => {
  await openCheats(page)
  await toggleCheat(page, 'Head Mode')
  const filter = () => page.locator('.bounce-head').evaluate((el) => getComputedStyle(el).filter)
  expect(await filter()).not.toContain('hue-rotate')
  await toggleCheat(page, 'Dance Mode')
  await expect.poll(filter).toContain('hue-rotate')
  const first = await filter()
  await expect.poll(filter, { timeout: 5000 }).not.toBe(first)
  // Back to its own colours once Dance Mode is off
  await toggleCheat(page, 'Dance Mode')
  await expect.poll(filter).not.toContain('hue-rotate')
})

test('Australia Mode turns the site upside down, and links still work', async ({ page }) => {
  await openCheats(page)
  await toggleCheat(page, 'Australia Mode')
  await page.waitForTimeout(1000) // the flip animation
  const turned = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('root')).transform))
  expect(Math.round(turned.a)).toBe(-1)
  expect(Math.round(turned.d)).toBe(-1)
  // The header is now at the bottom of the screen, upside down, and still clickable
  const header = await page.locator('.site-header').boundingBox()
  const viewport = page.viewportSize()
  expect(header.y).toBeGreaterThan(viewport.height / 2)
  await page.getByRole('link', { name: 'Caleb Kautai, home' }).click()
  await expect(page).toHaveURL('/')
})

test('cheats last through reloads in the same session, and can all be turned off', async ({ page }) => {
  await openCheats(page)
  await toggleCheat(page, 'Dance Mode')
  await toggleCheat(page, 'Australia Mode')
  await page.reload()
  // Applied before the page's JavaScript runs, so nothing flips back and forth
  await expect(html(page)).toHaveAttribute('data-cheat-australia', '')
  await expect(cheatSwitch(page, 'Australia Mode')).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Turn everything off' }).click()
  await expect(html(page)).not.toHaveAttribute('data-cheat-australia', '')
  await expect(html(page)).not.toHaveAttribute('data-cheat-dance', '')
})

test('typing a code on the keyboard toggles its cheat', async ({ page }) => {
  test.skip(test.info().project.name === 'iphone', 'phones have no keyboard to type on')
  await page.goto('/work')
  await page.keyboard.type('gday')
  await expect(html(page)).toHaveAttribute('data-cheat-australia', '')
  await expect(page.getByText('Australia Mode activated')).toBeVisible()
  await page.keyboard.type('GDAY')
  await expect(html(page)).not.toHaveAttribute('data-cheat-australia', '')
})

test('typing in a form field does not trigger cheats', async ({ page }) => {
  test.skip(test.info().project.name === 'iphone', 'phones have no keyboard to type on')
  await page.goto('/tattoo-love-interest')
  await page.getByLabel('Position applying for').fill('')
  await page.getByLabel('Position applying for').pressSequentially('HEAD')
  await expect(html(page)).not.toHaveAttribute('data-cheat-head', '')
})

test('Big Head Mode turns photos into bobbleheads and doubles the bouncing head', async ({ page }) => {
  await openCheats(page)
  await toggleCheat(page, 'Head Mode')
  const width = () => page.locator('.bounce-head').evaluate((el) => el.getBoundingClientRect().width)
  const normal = await width()
  await toggleCheat(page, 'Big Head Mode')
  await expect.poll(width).toBeCloseTo(normal * 2, 0)
  await page.goto('/about')
  const portrait = page.locator('.portrait')
  await expect.poll(() => portrait.evaluate((el) => getComputedStyle(el).scale)).toBe('1.45')
  expect(await portrait.evaluate((el) => getComputedStyle(el).animationName)).toBe('bobble')
})

test('8-bit Mode uses the pixel font and pixelates photos', async ({ page }) => {
  await openCheats(page)
  await toggleCheat(page, '8-bit Mode')
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Press Start 2P')
  await expect(page.locator('#cheat-pixelate')).toBeAttached()
  await expect(page.locator('link[href*="Press+Start+2P"]')).toBeAttached()
  await page.goto('/about')
  expect(await page.locator('.portrait').evaluate((el) => getComputedStyle(el).filter)).toContain('cheat-pixelate')
})

test('Matrix Mode goes green with code raining behind the page', async ({ page }) => {
  await openCheats(page)
  await toggleCheat(page, 'Matrix Mode')
  await expect(page.locator('canvas.matrix-rain')).toBeAttached()
  expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe('rgb(77, 255, 136)')
  await toggleCheat(page, 'Matrix Mode')
  await expect(page.locator('canvas.matrix-rain')).toHaveCount(0)
})

test('Gravity Mode knocks things off the page instead of following links, and tidies up when off', async ({ page }) => {
  await openCheats(page)
  await toggleCheat(page, 'Gravity Mode')
  await page.goto('/work')
  const heading = page.locator('.project').first().getByRole('heading')
  await heading.scrollIntoViewIfNeeded()
  const before = (await heading.boundingBox()).y
  await heading.click()
  await page.waitForTimeout(1500)
  // The heading fell; tapping a link inside the page doesn't navigate either
  expect((await heading.boundingBox()).y).toBeGreaterThan(before + 50)
  await page.getByRole('link', { name: 'More on GitHub' }).click()
  await expect(page).toHaveURL('/work')
  // The header still works, to get back to the switches
  await openNavGroup(page, 'Fun stuff')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Cheat codes' }).click()
  await toggleCheat(page, 'Gravity Mode')
  await page.goto('/work')
  await page.getByRole('link', { name: 'More on GitHub' }).click({ trial: true })
})

test('Gravity Mode switched off puts fallen things back', async ({ page }) => {
  await page.goto('/cheat-codes')
  await toggleCheat(page, 'Gravity Mode')
  const lede = page.locator('.lede')
  const before = (await lede.boundingBox()).y
  await lede.click()
  await page.waitForTimeout(1500)
  expect((await lede.boundingBox()).y).toBeGreaterThan(before + 50)
  await toggleCheat(page, 'Gravity Mode')
  expect(Math.round((await lede.boundingBox()).y)).toBe(Math.round(before))
})

test('Comic Sans Mode', async ({ page }) => {
  await openCheats(page)
  await toggleCheat(page, 'Comic Sans Mode')
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Comic')
})

test('Head Trail drops little heads behind the cursor', async ({ page }) => {
  test.skip(test.info().project.name === 'iphone', 'checked with a mouse')
  await openCheats(page)
  await toggleCheat(page, 'Head Trail')
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(100 + i * 30, 300)
    await page.waitForTimeout(60)
  }
  expect(await page.locator('.head-trail').count()).toBeGreaterThan(2)
})

test('Night Vision tints the whole site, and the player stays pinned to the screen', async ({ page }) => {
  await page.goto('/aliens')
  await page.getByRole('button', { name: "Play Mika's interview" }).click()
  await page.evaluate(() => document.documentElement.setAttribute('data-cheat-night', ''))
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).filter)).toContain('sepia')
  const player = page.getByRole('region', { name: 'Podcast player' })
  const box = await player.boundingBox()
  expect(box.y + box.height).toBeGreaterThan(page.viewportSize().height - 40)
})

test('the Konami code replays the hack anywhere', async ({ page }) => {
  test.skip(test.info().project.name === 'iphone', 'phones use the Run button')
  await page.goto('/work')
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
    await page.keyboard.press(key)
  }
  const hack = page.getByRole('dialog', { name: /hacking in progress/i })
  await expect(hack).toBeVisible()
  await expect(hack.getByText('CHEATER DETECTED')).toBeAttached()
  await page.getByRole('button', { name: 'Skip hack' }).click()
  await expect(hack).toBeHidden()
  await expect(page).toHaveURL('/work')
})

test('the Konami code has a Run button for phones', async ({ page }) => {
  await page.goto('/cheat-codes')
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByRole('dialog', { name: /hacking in progress/i })).toBeVisible()
})

test('Easy Mode is a secret: not on the cheat codes page, but EZPZ switches it on', async ({ page }) => {
  await openCheats(page)
  await expect(cheatSwitch(page, 'Easy Mode')).toHaveCount(0)
  test.skip(test.info().project.name === 'iphone', 'phones have no keyboard to type on')
  await page.keyboard.type('ezpz')
  await expect(html(page)).toHaveAttribute('data-cheat-easy', '')
  await expect(page.getByRole('status')).toContainText('Easy Mode activated')
})

test('on a phone, four quick taps on the Games heading switch Easy Mode on and off', async ({ page }) => {
  await page.goto('/games')
  const heading = page.getByRole('heading', { name: 'Games', level: 1 })
  for (let i = 0; i < 4; i++) await heading.click()
  await expect(html(page)).toHaveAttribute('data-cheat-easy', '')
  await page.getByRole('link', { name: /Bonk/ }).click()
  await expect(page.getByText('Easy mode', { exact: true })).toBeVisible()
  await page.goBack()
  for (let i = 0; i < 4; i++) await page.getByRole('heading', { name: 'Games', level: 1 }).click()
  await expect(html(page)).not.toHaveAttribute('data-cheat-easy', '')
})

test('typing BIGHEAD switches on Big Head Mode only, not Head Mode too', async ({ page }) => {
  test.skip(test.info().project.name === 'iphone', 'phones have no keyboard to type on')
  await page.goto('/work')
  await page.keyboard.type('bighead')
  await expect(html(page)).toHaveAttribute('data-cheat-bighead', '')
  await expect(html(page)).not.toHaveAttribute('data-cheat-head', '')
})

test('switching Amber Mode on and off three times makes Amber the games’ player, and again brings Caleb back', async ({ page }) => {
  const flipSix = async () => {
    for (let i = 0; i < 6; i++) await toggleCheat(page, 'Amber Mode')
  }
  await openCheats(page)
  await flipSix()
  await expect(page.getByRole('status')).toContainText('Amber unlocked')
  await expect(cheatSwitch(page, 'Amber Mode')).toHaveAttribute('aria-checked', 'false')
  // Remembered past the session's cheats
  await page.goto('/games/bonk')
  await expect(page.locator('.bonk-head').first()).toHaveCSS('background-image', /amber-sprites/)
  await openCheats(page)
  await flipSix()
  await expect(page.getByRole('status')).toContainText('Caleb’s back')
  await page.goto('/games/bonk')
  await expect(page.locator('.bonk-head').first()).toHaveCSS('background-image', /bounce-sprites/)
})
