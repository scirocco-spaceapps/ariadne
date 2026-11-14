import { defineConfig, devices } from '@playwright/test'

// E2E_MODE=demo (default): the web app replays the SYNTHETIC fixtures (?demo=1); no service needed.
// E2E_MODE=live: planner and mission-control must be running behind the web app.
// E2E_BASE_URL: test an already running web app (e.g. the deployed site) instead of starting
// `npm run dev` in ../web on port 5173.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173'
const ci = !!process.env.CI

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: ci,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    // Video and screenshots are recorded by the test itself for both browser contexts
    // (console and cuff), so they exist even when the test passes.
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --port 5173 --strictPort',
        cwd: '../web',
        url: baseURL,
        reuseExistingServer: !ci,
        timeout: 120_000,
      },
})
