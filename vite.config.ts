import { defineConfig } from 'vite'

export default defineConfig({
  base: '/crypto-lab-kmac-gate/',
  test: {
    // Colocated unit tests only — keep Playwright's e2e/ specs out of Vitest.
    include: ['src/**/*.test.ts'],
  },
})
