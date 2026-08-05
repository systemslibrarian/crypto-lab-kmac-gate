import { defineConfig } from '@playwright/test'

// Port 4646: checked against the committed playwright.config.ts of every
// sibling crypto-lab repo (178 of them) before choosing. Never 4173.
const PORT = 4646
const ORIGIN = `http://localhost:${PORT}/crypto-lab-kmac-gate/`

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: ORIGIN,
    colorScheme: 'dark',
  },
  webServer: {
    // BUILD, then preview. Never `preview` alone: a failed build leaves the
    // previous bundle in dist/ and the whole suite passes green against code
    // that no longer compiles.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
