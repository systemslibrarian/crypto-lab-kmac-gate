import { expect, test } from '@playwright/test'

import { expectNoThemeControl } from './helpers'

/**
 * One theme, pinned, with no way to change it.
 *
 * This lab is dark. That is a fleet invariant rather than a local preference:
 * the shared header used to carry a theme toggle that persisted its choice, so
 * a single past click pinned a returning visitor to light forever, and the
 * light palettes read badly anyway. Both were removed fleet-wide. This lab was
 * built before that pass and was never swept, because it was not cloned locally
 * where the catalog's checker could see it — so it kept a live, persisting
 * toggle long after every sibling had lost one.
 *
 * The catalog's `node tools/theme-sync.js check` holds every lab to this by
 * reading their markup. This test is the half that runs in CI, where it blocks
 * the deploy — the source check only runs when somebody remembers to run it.
 *
 * The two halves catch different things and neither is redundant. This one sees
 * the RESOLVED theme, so it catches a boot script switched to light and a
 * toggle that renders. It cannot see `<html data-theme="light">` left behind by
 * a boot script that still pins dark, because the script wins before this
 * assertion runs — that mismatch costs a flash of the wrong theme on first
 * paint, and only the source check catches it.
 */
test('the page pins the dark theme and offers no way to leave it', async ({ page }) => {
  await page.goto('.')
  await expectNoThemeControl(page)
})

/**
 * The specific defect the fleet-wide removal was for.
 *
 * The old boot script read `localStorage.getItem('theme')` and honoured it, so
 * one click on the removed toggle outlived the toggle itself. The replacement
 * WRITES the literal instead of reading, which is what makes the fix retroactive
 * for visitors who still carry a stored 'light' from before this lab was swept.
 */
test('a stored light preference from the old toggle is overwritten, not honoured', async ({
  page,
}) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'light')
    } catch (e) {
      /* storage blocked; the boot script tolerates that too */
    }
  })
  await page.goto('.')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(
    await page.evaluate(() => localStorage.getItem('theme')),
    'the boot script should overwrite the stored preference, not read it',
  ).toBe('dark')
})
