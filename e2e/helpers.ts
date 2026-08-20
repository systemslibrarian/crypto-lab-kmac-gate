import { expect, type Page } from '@playwright/test'

/**
 * Settle motion through the page's OWN prefers-reduced-motion block, and prove
 * it landed. `test.use({ reducedMotion })` silently does nothing on Playwright
 * 1.61.x — a suite relying on it runs with every transition live while reading
 * as if it had settled them.
 *
 * We never inject `transition: none` / `animation: none`: doing so makes the
 * suite structurally incapable of seeing a transition defect.
 */
export async function settleMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation did not reach the page',
  ).toBe(true)
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running'),
  )
}

/**
 * Wait for what the scan is supposed to check.
 *
 * The page paints its four stages synchronously but the contrast panel waits
 * on a WebCrypto digest, so a scan that races it would check a container that
 * is still empty and pass having checked nothing.
 */
export async function awaitLiveContent(page: Page): Promise<void> {
  await expect(page.locator('body[data-ready="true"]')).toHaveCount(1, { timeout: 60_000 })
  await expect(page.locator('#sha3-digest')).toHaveCount(1)
  await expect(page.locator('#naive-tag')).toHaveCount(1)
  // Every stage has rendered its output.
  await expect(page.locator('.stage-out')).toHaveCount(7)
}

/** Read the hex a panel published, so tests compare values the PAGE printed. */
export async function hexOf(page: Page, selector: string): Promise<string> {
  const value = await page.locator(selector).getAttribute('data-hex')
  expect(value, `${selector} should publish a data-hex value`).toBeTruthy()
  return value as string
}

export async function setValue(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).fill(value)
  await page.locator(selector).dispatchEvent('change')
}

/**
 * Assert the theme contract: dark, pinned, with no way to leave it.
 *
 * This helper used to click `#cl-theme-toggle` and assert the page reached
 * light. The fleet removed that toggle — it persisted its choice, so one past
 * click pinned a returning visitor to light forever — so the assertion is
 * inverted rather than dropped: what was "the toggle works" is now "there is
 * no toggle, and the theme it used to change is fixed".
 *
 * A lab's own legacy toggle may still sit in the DOM (an inline rule in the
 * page hides it so the lab's theme JS keeps resolving), so what is asserted is
 * that no theme control is VISIBLE, not that none exists.
 */
export async function expectNoThemeControl(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('#cl-theme-toggle')).toHaveCount(0)
  await expect(
    page.locator(
      '#theme-toggle:visible, #themeToggle:visible, .theme-toggle:visible,' +
        ' .theme-toggle-btn:visible, [data-theme-toggle]:visible',
    ),
  ).toHaveCount(0)
}
