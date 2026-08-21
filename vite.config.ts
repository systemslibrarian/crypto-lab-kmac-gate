// `defineConfig` from 'vitest/config', not 'vite': the `test` block below is
// Vitest's, and only Vitest's re-export types it. Vitest <=3 declaration-merged
// `test` onto Vite's own `UserConfig`, so importing from 'vite' happened to
// typecheck; Vitest 4 dropped that augmentation and `tsc --noEmit` fails with
// TS2769 "'test' does not exist in type 'UserConfigExport'". Both are the
// identity `config => config`, so the emitted build is unchanged.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/crypto-lab-kmac-gate/',
  test: {
    // Colocated unit tests only — keep Playwright's e2e/ specs out of Vitest.
    include: ['src/**/*.test.ts'],
  },
})
