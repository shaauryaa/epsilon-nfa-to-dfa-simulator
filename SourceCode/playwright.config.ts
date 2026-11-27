import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests against the production build served by `vite preview`.
 *
 * - `npm run e2e` runs the `e2e` project (headless, Chromium).
 * - `npm run screenshots` runs the `screenshots` project, which saves the
 *   report figures to ../Screenshots.
 */
const PORT = 4174

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}/epsilon-nfa-to-dfa-simulator/`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1366, height: 768 },
  },
  projects: [
    { name: 'e2e', testDir: './e2e', testMatch: /.*\.spec\.ts/ },
    {
      name: 'screenshots',
      testDir: './e2e',
      testMatch: /screenshots\.ts/,
      fullyParallel: false,
      use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --bypass-lock`,
    url: `http://localhost:${PORT}/epsilon-nfa-to-dfa-simulator/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
