import { expect, test } from './fixtures.js'

// The approval page opened from guestbook emails. The API is faked here; api/moderate.js and its
// signatures are covered by the unit tests.
const kev = { id: 'a1', name: 'Kev', rating: 4, comment: 'Got me good', doodle: [{ ink: 2, points: [20, 20, 180, 180] }], createdAt: '2026-10-20T03:00:00Z' }
const mel = { id: 'b2', name: 'Mel', rating: null, comment: 'Hi!', doodle: [], createdAt: '2026-10-21T03:00:00Z' }

async function fakeModerationApi(page, { status = 200, body } = {}) {
  const calls = []
  await page.route('**/api/moderate**', (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      calls.push(req.postDataJSON())
      const { action } = req.postDataJSON()
      return route.fulfill({ json: { state: action === 'approve' ? 'published' : 'deleted' } })
    }
    calls.push(Object.fromEntries(new URL(req.url()).searchParams))
    return route.fulfill({ status, json: body })
  })
  return calls
}

test('a "Review it" link shows the entry, and Approve puts it up', async ({ page }) => {
  const calls = await fakeModerationApi(page, { body: { entry: kev, state: 'pending' } })
  await page.goto('/guestbook-admin?id=a1&sig=s1g')
  await expect(page.getByText('Got me good')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Doodle by Kev' })).toBeVisible()
  await expect(page.getByRole('img', { name: '4 out of 5 stars' })).toBeVisible()
  expect(calls[0]).toEqual({ id: 'a1', sig: 's1g' })

  const state = page.locator('.admin-state')
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(state).toContainText('Approved')
  expect(calls[1]).toEqual({ action: 'approve', id: 'a1', sig: 's1g' })
  // Changed your mind
  await page.getByRole('button', { name: 'Delete it after all' }).click()
  await expect(state).toHaveText('Deleted.')
})

test('the list link shows everything waiting, and each can be dealt with', async ({ page }) => {
  const calls = await fakeModerationApi(page, { body: { entries: [kev, mel] } })
  await page.goto('/guestbook-admin?key=k3y')
  await expect(page.getByText('2 waiting for approval.')).toBeVisible()
  const items = page.locator('.admin-entry')
  await expect(items).toHaveCount(2)
  await items.nth(1).getByRole('button', { name: 'Delete' }).click()
  await expect(items.nth(1).locator('.admin-state')).toHaveText('Deleted.')
  await expect(items.nth(0).getByRole('button', { name: 'Approve' })).toBeVisible()
  expect(calls.at(-1)).toEqual({ action: 'delete', id: 'b2', key: 'k3y' })
})

test('an empty list says so', async ({ page }) => {
  await fakeModerationApi(page, { body: { entries: [] } })
  await page.goto('/guestbook-admin?key=k3y')
  await expect(page.getByText('Nothing waiting. All caught up!')).toBeVisible()
})

test('a bad link explains itself, and the page stays out of search engines', async ({ page }) => {
  await fakeModerationApi(page, { status: 403, body: { error: 'That link has expired or is wrong.' } })
  await page.goto('/guestbook-admin?id=a1&sig=nope')
  await expect(page.getByRole('alert')).toHaveText('That link has expired or is wrong.')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
})

test('without a link it says where to open it from', async ({ page }) => {
  await page.goto('/guestbook-admin')
  await expect(page.getByText('Open this page from a guestbook email.')).toBeVisible()
})
