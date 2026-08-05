import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { awaitLiveContent, settleMotion, toLightTheme } from './helpers'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function prepare(page: Page): Promise<void> {
  await settleMotion(page)
  await awaitLiveContent(page)
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => ((d as HTMLDetailsElement).open = true))
  })
}

async function scan(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
    })),
    `axe violations in state: ${label}`,
  ).toEqual([])
}

/**
 * Put the page into each of its post-interaction states.
 *
 * An unscanned state is an ungated state, and result panels, error states and
 * failed verdicts are exactly where contrast and live-region defects hide.
 */
const STATES = {
  /** First paint, untouched. */
  async initial(_page: Page): Promise<void> {},

  /** Multi-block message, stepped into the middle of the trace. */
  async stepped(page: Page): Promise<void> {
    await page.locator('#msg-input').fill('S'.repeat(400))
    await page.locator('button:has-text("Next block ▶")').click()
    await page.locator('button:has-text("Next block ▶")').click()
    await page.locator('#shake-length').fill('400')
    await page.locator('#shake-length').dispatchEvent('change')
  },

  /** cSHAKE driven into its empty-N/S fallback state. */
  async fallback(page: Page): Promise<void> {
    await page.locator('#cshake-custom').fill('')
    await page.locator('#cshake-name').fill('')
  },

  /** A tag signed and accepted. */
  async accepted(page: Page): Promise<void> {
    await page.locator('button:has-text("Compute tag")').click()
    await page.locator('button:has-text("Verify tag")').click()
    await expect(page.locator('#kmac-verdict-panel .verdict-ok')).toHaveCount(1)
  },

  /** A verdict retired by an edit — the stale state. */
  async retired(page: Page): Promise<void> {
    await STATES.accepted(page)
    await page.locator('button:has-text("Tamper with the message")').click()
    await expect(page.locator('#kmac-verdict-panel .verdict-stale')).toHaveCount(1)
  },

  /** A tag rejected — the failure path. */
  async rejected(page: Page): Promise<void> {
    await STATES.retired(page)
    await page.locator('button:has-text("Verify tag")').click()
    await expect(page.locator('#kmac-verdict-panel .verdict-bad')).toHaveCount(1)
  },
}

for (const theme of ['dark', 'light'] as const) {
  for (const [name, drive] of Object.entries(STATES)) {
    test(`no WCAG A/AA violations — ${theme} theme, ${name} state`, async ({ page }) => {
      await page.goto('.')
      if (theme === 'light') await toLightTheme(page)
      await awaitLiveContent(page)
      await drive(page)
      await prepare(page)
      await scan(page, `${theme}/${name}`)
    })
  }
}

test('nothing carrying the hidden attribute is still painted', async ({ page }) => {
  await page.goto('.')
  await awaitLiveContent(page)
  const leaks = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[hidden]'))
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => el.id || el.className),
  )
  expect(leaks).toEqual([])
})

/**
 * Arithmetic contrast sweep.
 *
 * axe is not a complete contrast oracle: it under-reports nodes and drops
 * anything drawn over a gradient into `incomplete`, where a violations-only
 * assertion never sees it. So measure every text-bearing element directly,
 * against the surface it is ACTUALLY drawn on — compositing back through
 * ancestors when a background is transparent or semi-transparent.
 */
async function measureContrast(page: Page): Promise<{ selector: string; ratio: number; required: number; text: string }[]> {
  return page.evaluate(() => {
    // Resolve ANY CSS colour syntax to 8-bit RGBA by asking the browser to
    // paint it. A regex over getComputedStyle is not enough: Chromium returns
    // `color-mix()` results as `color(srgb 0.62 0.57 0.82)`, whose 0–1 floats
    // a naive parser reads as near-black — which manufactured four contrast
    // "failures" on the top bar that measured 6.4:1 in reality.
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const cache = new Map<string, [number, number, number, number]>()
    const parse = (c: string): [number, number, number, number] => {
      const hit = cache.get(c)
      if (hit) return hit
      ctx.clearRect(0, 0, 1, 1)
      ctx.globalCompositeOperation = 'copy'
      ctx.fillStyle = c
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      const out: [number, number, number, number] = [r, g, b, a / 255]
      cache.set(c, out)
      return out
    }
    const lum = (r: number, g: number, b: number): number => {
      const f = (v: number): number => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const over = (
      fg: [number, number, number, number],
      bg: [number, number, number],
    ): [number, number, number] => [
      fg[0] * fg[3] + bg[0] * (1 - fg[3]),
      fg[1] * fg[3] + bg[1] * (1 - fg[3]),
      fg[2] * fg[3] + bg[2] * (1 - fg[3]),
    ]

    /** Effective background: composite every ancestor layer down to the root. */
    const backgroundOf = (el: Element): [number, number, number] => {
      const layers: [number, number, number, number][] = []
      let node: Element | null = el
      while (node) {
        const style = getComputedStyle(node)
        const c = parse(style.backgroundColor)
        if (c[3] > 0) layers.push(c)
        if (c[3] === 1) break
        node = node.parentElement
      }
      let result: [number, number, number] = [255, 255, 255]
      for (let i = layers.length - 1; i >= 0; i--) result = over(layers[i], result)
      return result
    }

    const path = (el: Element): string => {
      const parts: string[] = []
      let node: Element | null = el
      while (node && parts.length < 4) {
        let part = node.tagName.toLowerCase()
        if (node.id) part += `#${node.id}`
        else if (typeof node.className === 'string' && node.className)
          part += `.${node.className.trim().split(/\s+/).join('.')}`
        parts.unshift(part)
        node = node.parentElement
      }
      return parts.join(' > ')
    }

    const results: { selector: string; ratio: number; required: number; text: string }[] = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (el.closest('.sr-only') || el.classList.contains('sr-only')) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (Number(style.opacity) === 0) continue
      // Only elements with their own visible text.
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim()
      if (!ownText) continue

      const fg = parse(style.color)
      if (fg[3] === 0) continue
      const bg = backgroundOf(el)
      const composited = over(fg, bg)
      const l1 = lum(...composited)
      const l2 = lum(...bg)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

      const size = parseFloat(style.fontSize)
      const weight = Number(style.fontWeight) || 400
      const large = size >= 24 || (size >= 18.66 && weight >= 700)
      results.push({
        selector: path(el),
        ratio: Math.round(ratio * 100) / 100,
        required: large ? 3 : 4.5,
        text: ownText.slice(0, 40),
      })
    }
    return results
  })
}

for (const theme of ['dark', 'light'] as const) {
  test(`measured contrast meets AA on the real surfaces — ${theme} theme`, async ({ page }) => {
    await page.goto('.')
    if (theme === 'light') await toLightTheme(page)
    await awaitLiveContent(page)
    // Drive to the busiest state so tinted verdict panels are measured too.
    await STATES.rejected(page)
    await page.evaluate(() => {
      document.querySelectorAll('details').forEach((d) => ((d as HTMLDetailsElement).open = true))
    })
    const measured = await measureContrast(page)
    expect(measured.length, 'the sweep should find text to measure').toBeGreaterThan(50)
    const failures = measured.filter((m) => m.ratio < m.required)
    expect(failures, `contrast failures in ${theme} theme`).toEqual([])
  })
}

test('the theme toggle actually repaints the page, not just the attribute', async ({ page }) => {
  await page.goto('.')
  await awaitLiveContent(page)
  const darkBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
  await toLightTheme(page)
  const lightBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
  expect(lightBg).not.toBe(darkBg)
})

test('every scrollable region is keyboard reachable and named', async ({ page }) => {
  await page.goto('.')
  await awaitLiveContent(page)
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => ((d as HTMLDetailsElement).open = true))
  })
  const unreachable = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => {
        const style = getComputedStyle(el)
        const scrolls =
          (style.overflowX === 'auto' || style.overflowX === 'scroll' ||
            style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
        if (!scrolls) return false
        const focusable = el.tabIndex >= 0
        const named = !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))
        return !(focusable && named)
      })
      .map((el) => el.id || el.className),
  )
  expect(unreachable).toEqual([])
})
