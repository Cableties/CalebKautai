import { defineConfig, devices } from '@playwright/test'

// Browser tests run against the built site (`npm run build` first). In CI the server is started
// fresh; locally an already-running `vite preview` on port 4173 is reused.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Headless WebKit stops producing frames when too many browsers share the CPU, which makes
  // clicks time out waiting for elements to settle
  workers: process.env.CI ? 2 : 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Most visitors arrive by scanning the tattoo on a phone
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
})
