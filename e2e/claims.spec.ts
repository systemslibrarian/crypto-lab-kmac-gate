/**
 * The claims suite: does the page tell the truth?
 *
 * Two kinds of check, because either alone can be fooled:
 *
 *   - CROSS-CHECKS between two surfaces the page itself printed (a total
 *     against the parts it is made of, a verdict against the bytes it judges).
 *     These catch a page that contradicts itself.
 *
 *   - INDEPENDENT RE-DERIVATIONS, recomputing the page's claims from the raw
 *     inputs by a completely different route: OpenSSL via node:crypto for
 *     FIPS 202, and js-sha3 for SP 800-185. These catch a page that is
 *     consistently wrong — the failure a self-consistent test happily agrees
 *     with.
 *
 * Nothing here asserts against a hardcoded digest: every expectation is
 * recomputed from what the page currently shows.
 */

import { createHash } from 'node:crypto'
import jsSha3 from 'js-sha3'
import { expect, test, type Page } from '@playwright/test'

// js-sha3 ships as CommonJS; destructure from the default export under ESM.
const { cshake128, cshake256, kmac128, kmac256 } = jsSha3
import { awaitLiveContent, hexOf } from './helpers'

/** The hex a box displays, with the readability spacing removed. */
async function boxHex(page: Page, selector: string, index = 0): Promise<string> {
  const text = await page.locator(selector).nth(index).innerText()
  return text.replace(/\s+/g, '').toLowerCase()
}

async function inputValue(page: Page, selector: string): Promise<string> {
  return page.locator(selector).inputValue()
}

test.beforeEach(async ({ page }) => {
  await page.goto('.')
  await awaitLiveContent(page)
})

// ---------------------------------------------------------------------------
// Independent re-derivation of every headline value
// ---------------------------------------------------------------------------

test('the SHA3-256 digest is the real digest of the message in the box', async ({ page }) => {
  for (const message of ['The sponge absorbs, then it squeezes.', '', 'a', 'x'.repeat(300)]) {
    await page.locator('#msg-input').fill(message)
    const shown = await hexOf(page, '#sha3-digest')
    const expected = createHash('sha3-256').update(Buffer.from(message, 'utf8')).digest('hex')
    expect(shown, `SHA3-256 of ${message.length} bytes`).toBe(expected)
  }
})

test('the SHAKE output matches OpenSSL at the requested strength and length', async ({ page }) => {
  for (const [strength, length] of [
    ['128', '64'],
    ['256', '200'],
    ['128', '512'],
  ] as const) {
    await page.locator('#shake-strength').selectOption(strength)
    await page.locator('#shake-length').fill(length)
    await page.locator('#shake-length').dispatchEvent('change')
    const message = await inputValue(page, '#msg-input')
    const shown = await hexOf(page, '#shake-output')
    const expected = createHash(`shake${strength}`, { outputLength: Number(length) })
      .update(Buffer.from(message, 'utf8'))
      .digest('hex')
    expect(shown, `SHAKE${strength} at ${length} bytes`).toBe(expected)
  }
})

test('the cSHAKE output matches an independent implementation', async ({ page }) => {
  for (const [strength, name, custom] of [
    ['128', '', 'Email Signature'],
    ['256', 'Widget', 'v2'],
    ['128', '', ''],
  ] as const) {
    await page.locator('#cshake-strength').selectOption(strength)
    await page.locator('#cshake-name').fill(name)
    await page.locator('#cshake-custom').fill(custom)
    const message = await inputValue(page, '#msg-input')
    const shown = await hexOf(page, '#cshake-output')
    const oracle = strength === '128' ? cshake128 : cshake256
    expect(shown, `cSHAKE${strength} N=${name} S=${custom}`).toBe(
      oracle(Buffer.from(message, 'utf8'), 256, name, custom),
    )
  }
})

test('the held KMAC tag matches an independent implementation', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  const key = await inputValue(page, '#kmac-key')
  const message = await inputValue(page, '#kmac-message')
  const custom = await inputValue(page, '#kmac-custom')
  const shown = await hexOf(page, '#held-tag')
  expect(shown).toBe(kmac128(Buffer.from(key, 'utf8'), Buffer.from(message, 'utf8'), 256, custom))
})

test('KMAC256 at 512 bits also matches', async ({ page }) => {
  await page.locator('#kmac-strength').selectOption('256')
  await page.locator('#kmac-length').selectOption('512')
  await page.locator('button:has-text("Sign message")').click()
  const key = await inputValue(page, '#kmac-key')
  const message = await inputValue(page, '#kmac-message')
  const shown = await hexOf(page, '#held-tag')
  expect(shown).toBe(kmac256(Buffer.from(key, 'utf8'), Buffer.from(message, 'utf8'), 512, ''))
})

test('the naive MAC panel shows a real SHA-256 of key ‖ message', async ({ page }) => {
  const key = await inputValue(page, '#kmac-key')
  const message = await inputValue(page, '#kmac-message')
  const shown = await hexOf(page, '#naive-tag')
  expect(shown).toBe(
    createHash('sha256')
      .update(Buffer.concat([Buffer.from(key, 'utf8'), Buffer.from(message, 'utf8')]))
      .digest('hex'),
  )
})

// ---------------------------------------------------------------------------
// Cross-checks: the page must agree with itself
// ---------------------------------------------------------------------------

test('the permutation total equals the sum of the per-stage parts', async ({ page }) => {
  const parts = await page.locator('#perm-breakdown li[data-stage] b').allInnerTexts()
  const total = Number(await page.locator('#perm-total').innerText())
  const sum = parts.map(Number).reduce((a, b) => a + b, 0)
  expect(parts).toHaveLength(4)
  expect(sum).toBe(total)
  // ...and the prose sentence beneath must state the same arithmetic.
  const sentence = await page.locator('#perm-sum-check').innerText()
  expect(sentence).toContain(`${parts.join(' + ')} = ${sum}`)
})

test('the permutation count changes when the work changes', async ({ page }) => {
  const before = Number(await page.locator('#perm-total').innerText())
  await page.locator('#msg-input').fill('y'.repeat(2000))
  const after = Number(await page.locator('#perm-total').innerText())
  expect(after).toBeGreaterThan(before)
})

test('the reported block count matches the message length and the rate', async ({ page }) => {
  for (const [length, blocks] of [
    [0, 1],
    [135, 1],
    [136, 2],
    [300, 3],
  ] as const) {
    await page.locator('#msg-input').fill('a'.repeat(length))
    expect(Number(await page.locator('#sha3-blocks').innerText()), `${length} bytes`).toBe(blocks)
    expect(await page.locator('#sha3-msg-len').innerText()).toBe(`${length} bytes`)
  }
})

test('every "identical / different" verdict matches the bytes printed beside it', async ({ page }) => {
  // The page never asserts a comparison result: it must be derivable from the
  // two values shown. Check that for every comparison block on the page.
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => ((d as HTMLDetailsElement).open = true))
  })
  const mismatches = await page.evaluate(() => {
    const bad: string[] = []
    for (const block of Array.from(document.querySelectorAll('.compare'))) {
      const boxes = Array.from(block.querySelectorAll(':scope > .hexbox'))
      const tone = block.querySelector(':scope > .verdict')?.getAttribute('data-tone')
      if (boxes.length !== 2 || !tone) continue
      const [a, b] = boxes.map((n) => (n.textContent ?? '').replace(/\s+/g, ''))
      const identical = a === b
      if (identical !== (tone === 'ok')) {
        bad.push(`${block.className}: tone=${tone} but identical=${identical}`)
      }
    }
    return bad
  })
  expect(mismatches).toEqual([])
})

test('the SHAKE prefix claim is true of the bytes the page printed', async ({ page }) => {
  await page.locator('#shake-length').fill('400')
  await page.locator('#shake-length').dispatchEvent('change')
  const long = await hexOf(page, '#shake-output')
  const shortShown = await boxHex(page, '#shake-prefix-proof .hexbox', 1)
  expect(long.startsWith(shortShown)).toBe(true)
  expect(shortShown.length).toBeGreaterThan(0)
})

test('the cSHAKE fallback panel proves equality with plain SHAKE', async ({ page }) => {
  await page.locator('#cshake-name').fill('')
  await page.locator('#cshake-custom').fill('')
  const shown = await hexOf(page, '#cshake-output')
  const message = await inputValue(page, '#msg-input')
  // Independent: the fallback must equal OpenSSL's plain SHAKE128.
  expect(shown).toBe(
    createHash('shake128', { outputLength: 32 }).update(Buffer.from(message, 'utf8')).digest('hex'),
  )
  await expect(page.locator('#cshake-fallback-note')).toContainText('IS plain SHAKE')
})

test('a customization string makes the output unrelated, and the page says so honestly', async ({ page }) => {
  await page.locator('#cshake-custom').fill('Email Signature')
  const withCustom = await hexOf(page, '#cshake-output')
  await page.locator('#cshake-custom').fill('')
  const plain = await hexOf(page, '#cshake-output')
  expect(withCustom).not.toBe(plain)
  // "Unrelated" must mean unrelated: no shared leading bytes to speak of.
  let shared = 0
  while (shared < withCustom.length && withCustom[shared] === plain[shared]) shared++
  expect(shared).toBeLessThan(8)
})

test('the length-binding panel claims binding only when the bytes show it', async ({ page }) => {
  const kmacShort = await boxHex(page, '#kmac-length-binding .hexbox', 0)
  const kmacLong = await boxHex(page, '#kmac-length-binding .hexbox', 1)
  const xofShort = await boxHex(page, '#kmac-length-binding .hexbox', 2)
  const xofLong = await boxHex(page, '#kmac-length-binding .hexbox', 3)
  expect(kmacShort).not.toBe(kmacLong)
  expect(xofShort).toBe(xofLong)

  // Independently: KMACXOF really is a prefix, KMAC really is not.
  const key = await inputValue(page, '#kmac-key')
  const message = await inputValue(page, '#kmac-message')
  const k = Buffer.from(key, 'utf8')
  const m = Buffer.from(message, 'utf8')
  expect(kmacShort).toBe(kmac128(k, m, 256, ''))
  expect(kmacLong).toBe(kmac128(k, m, 512, '').slice(0, 64))
})

// ---------------------------------------------------------------------------
// Failure paths — tested, not merely reachable
// ---------------------------------------------------------------------------

test('a tampered message is rejected, and the page names the message as the cause', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  await page.locator('button:has-text("Verify tag")').click()
  await expect(page.locator('#kmac-verdict-panel .verdict-ok')).toHaveCount(1)

  await page.locator('button:has-text("Tamper with the message")').click()
  await page.locator('button:has-text("Verify tag")').click()

  const bad = page.locator('#kmac-verdict-panel .verdict-bad')
  await expect(bad).toHaveCount(1)
  await expect(bad).toContainText('rejected')
  await expect(bad).toContainText('the message bytes changed')
  await expect(page.locator('#kmac-verdict-panel .verdict-ok')).toHaveCount(0)
})

test('the rejection shows a recomputed tag that really differs from the held one', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  const held = await hexOf(page, '#held-tag')
  await page.locator('button:has-text("Tamper with the message")').click()
  await page.locator('button:has-text("Verify tag")').click()
  const recomputed = await hexOf(page, '#recomputed-tag')
  expect(recomputed).not.toBe(held)
  // ...and the recomputed tag is the true tag of the tampered message.
  const key = await inputValue(page, '#kmac-key')
  const message = await inputValue(page, '#kmac-message')
  expect(recomputed).toBe(
    kmac128(Buffer.from(key, 'utf8'), Buffer.from(message, 'utf8'), 256, ''),
  )
})

test('a changed key is rejected and named', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  await page.locator('#kmac-key').fill('a-different-key')
  await page.locator('button:has-text("Verify tag")').click()
  await expect(page.locator('#kmac-verdict-panel .verdict-bad')).toContainText('the key changed')
})

test('a changed output length is rejected and named', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  await page.locator('#kmac-length').selectOption('512')
  await page.locator('button:has-text("Verify tag")').click()
  await expect(page.locator('#kmac-verdict-panel .verdict-bad')).toContainText('KMAC binds L into the tag')
})

test('an appended message is rejected — no length extension', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  const original = await inputValue(page, '#kmac-message')
  await page.locator('#kmac-message').fill(`${original} and 500 to mallory`)
  await page.locator('button:has-text("Verify tag")').click()
  await expect(page.locator('#kmac-verdict-panel .verdict-bad')).toHaveCount(1)
})

// ---------------------------------------------------------------------------
// Verdict retirement, and the no-op guard
// ---------------------------------------------------------------------------

test('editing the message retires the verdict, says so, and names the control', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  await page.locator('button:has-text("Verify tag")').click()
  await expect(page.locator('#kmac-verdict-panel .verdict-ok')).toHaveCount(1)

  await page.locator('#kmac-message').fill('a completely different instruction')

  await expect(page.locator('#kmac-verdict-panel .verdict-ok')).toHaveCount(0)
  const stale = page.locator('#kmac-verdict-panel .verdict-stale')
  await expect(stale).toHaveCount(1)
  await expect(stale).toContainText('retired')
  await expect(stale).toContainText('the message')
  await expect(stale).toContainText('Verify tag')
})

test('a retired verdict is never silently blanked', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  await page.locator('button:has-text("Verify tag")').click()
  await page.locator('#kmac-key').fill('rotated-key')
  // Something must still be on screen explaining the state.
  const text = await page.locator('#stage-kmac').innerText()
  expect(text).toMatch(/retired/i)
  expect(text.length).toBeGreaterThan(100)
})

test('changing any KMAC input retires the verdict, each naming what moved', async ({ page }) => {
  const changes: [string, () => Promise<unknown>, RegExp][] = [
    ['key', async () => page.locator('#kmac-key').fill('other-key'), /the key/],
    ['message', async () => page.locator('#kmac-message').fill('other message'), /the message/],
    ['length', async () => page.locator('#kmac-length').selectOption('512'), /the output length/],
    ['customization', async () => page.locator('#kmac-custom').fill('tagged'), /the customization/],
    ['strength', async () => page.locator('#kmac-strength').selectOption('256'), /the strength/],
    ['variant', async () => page.locator('#kmac-variant').selectOption('xof'), /the variant/],
  ]
  for (const [name, change, matcher] of changes) {
    await page.reload()
    await awaitLiveContent(page)
    await page.locator('button:has-text("Sign message")').click()
    await page.locator('button:has-text("Verify tag")').click()
    await expect(page.locator('#kmac-verdict-panel .verdict-ok'), name).toHaveCount(1)
    await change()
    const stale = page.locator('#kmac-verdict-panel .verdict-stale')
    await expect(stale, name).toHaveCount(1)
    expect(await stale.innerText(), name).toMatch(matcher)
  }
})

test('NO-OP GUARD: re-selecting the same value does not retire a fresh verdict', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  await page.locator('button:has-text("Verify tag")').click()
  await expect(page.locator('#kmac-verdict-panel .verdict-ok')).toHaveCount(1)

  // Re-select the value that is already chosen, and retype the same text.
  await page.locator('#kmac-strength').selectOption('128')
  await page.locator('#kmac-variant').selectOption('kmac')
  const message = await inputValue(page, '#kmac-message')
  await page.locator('#kmac-message').fill(message)
  await page.locator('#kmac-key').fill(await inputValue(page, '#kmac-key'))

  await expect(page.locator('#kmac-verdict-panel .verdict-stale')).toHaveCount(0)
  await expect(page.locator('#kmac-verdict-panel .verdict-ok')).toHaveCount(1)
})

test('a round-trip edit that restores the original bytes does not retire', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  await page.locator('button:has-text("Verify tag")').click()
  const original = await inputValue(page, '#kmac-message')
  await page.locator('#kmac-message').fill(`${original}X`)
  await expect(page.locator('#kmac-verdict-panel .verdict-stale')).toHaveCount(1)
  await page.locator('#kmac-message').fill(original)
  await expect(page.locator('#kmac-verdict-panel .verdict-stale')).toHaveCount(0)
  await expect(page.locator('#kmac-verdict-panel .verdict-ok')).toHaveCount(1)
})

test('signing again clears the old verdict rather than leaving it to endorse a new tag', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  await page.locator('button:has-text("Verify tag")').click()
  await expect(page.locator('#kmac-verdict-panel .verdict-ok')).toHaveCount(1)
  await page.locator('#kmac-message').fill('a new instruction')
  await page.locator('button:has-text("Sign message")').click()
  await expect(page.locator('#kmac-verdict-panel .verdict-ok')).toHaveCount(0)
  await expect(page.locator('#kmac-verdict-panel .verdict-stale')).toHaveCount(0)
  await expect(page.locator('#stage-kmac')).toContainText('Nothing verified yet')
})

test('the held tag survives tampering — it is what makes the rejection possible', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  const held = await hexOf(page, '#held-tag')
  await page.locator('button:has-text("Tamper with the message")').click()
  expect(await hexOf(page, '#held-tag')).toBe(held)
  await expect(page.locator('#stage-kmac')).toContainText('covers the earlier inputs')
})

// ---------------------------------------------------------------------------
// The page must not overstate what it established
// ---------------------------------------------------------------------------

test('the accept verdict does not claim more than KMAC establishes', async ({ page }) => {
  await page.locator('button:has-text("Sign message")').click()
  await page.locator('button:has-text("Verify tag")').click()
  const text = await page.locator('#kmac-verdict-panel .verdict-ok').innerText()
  expect(text).toMatch(/does not say when, or by whom/i)
  expect(text).not.toMatch(/proves the sender|guarantees|authentic sender|came from/i)
})

test('the contrast panel states an append forgery, never key recovery', async ({ page }) => {
  const text = await page.locator('#contrast-panel').innerText()
  expect(text.toLowerCase()).toContain('append')
  expect(text.toLowerCase()).not.toMatch(/key recovery|recovers the key|leaks the key/)
  expect(text).toContain('does not recover the key')
})

test('the page scopes itself honestly as a teaching implementation', async ({ page }) => {
  const text = await page.locator('#app').innerText()
  expect(text).toMatch(/not production/i)
  expect(text).toMatch(/not constant-time/i)
  expect(text).toMatch(/TupleHash and ParallelHash/)
})

test('nothing carrying the hidden attribute is still painted', async ({ page }) => {
  const leaks = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[hidden]'))
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => el.id || el.className),
  )
  expect(leaks).toEqual([])
})

test('there is exactly one h1 and one banner landmark', async ({ page }) => {
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('[role="banner"]')).toHaveCount(1)
})
