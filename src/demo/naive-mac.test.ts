import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { concat, toHex, utf8 } from '../keccak/bytes'
import { contrast, kmacFacts, naiveFacts, naiveSha256Mac, shortHex } from './naive-mac'

describe('the naive SHA-256(key ‖ message) MAC is really computed', () => {
  it('matches OpenSSL SHA-256 over the concatenation', async () => {
    const key = utf8('secret key')
    const msg = utf8('pay alice 100')
    const expected = createHash('sha256')
      .update(Buffer.from(concat(key, msg)))
      .digest('hex')
    expect(toHex(await naiveSha256Mac(key, msg))).toBe(expected)
  })

  it('produces 32 bytes', async () => {
    expect((await naiveSha256Mac(utf8('k'), utf8('m'))).length).toBe(32)
  })
})

describe('structural contrast — the numbers come from the parameters in use', () => {
  it('Merkle-Damgard: the digest IS the chaining state, so nothing is hidden', () => {
    const f = naiveFacts()
    expect(f.digestBits).toBe(f.internalStateBits)
    expect(f.hiddenStateBits).toBe(0)
    expect(f.resumableFromDigest).toBe(true)
  })

  it('the sponge hides its capacity at every strength', () => {
    // KMAC128 rides cSHAKE128: rate 168 bytes, capacity 32 bytes = 256 bits.
    expect(kmacFacts(128, 256).hiddenStateBits).toBe(256)
    // KMAC256 rides cSHAKE256: rate 136 bytes, capacity 64 bytes = 512 bits.
    expect(kmacFacts(256, 512).hiddenStateBits).toBe(512)
    for (const strength of [128, 256] as const) {
      expect(kmacFacts(strength, 256).resumableFromDigest).toBe(false)
      expect(kmacFacts(strength, 256).internalStateBits).toBe(1600)
    }
  })

  it('the reported digest width tracks the requested output length', () => {
    expect(kmacFacts(128, 256).digestBits).toBe(256)
    expect(kmacFacts(128, 512).digestBits).toBe(512)
  })

  it('states the weakness as an append forgery, never as key recovery', () => {
    // The brief's precision guard, enforced rather than trusted to review.
    const text = [naiveFacts().note, kmacFacts(128, 256).note].join(' ').toLowerCase()
    expect(text).toMatch(/append/)
    expect(text).not.toMatch(/key recovery|recover the key|learn the key|leaks the key/)
    expect(naiveFacts().note).toMatch(/without ever learning the key/)
  })

  it('contrast() reports both sides together', () => {
    const c = contrast(256, 512)
    expect(c.naive.resumableFromDigest).toBe(true)
    expect(c.kmac.resumableFromDigest).toBe(false)
    expect(c.kmac.hiddenStateBits).toBeGreaterThan(c.naive.hiddenStateBits)
  })

  it('shortHex truncates long tags but never lies about short ones', () => {
    const short = new Uint8Array([1, 2, 3])
    expect(shortHex(short)).toBe('010203')
    expect(shortHex(new Uint8Array(64), 8)).toMatch(/…$/)
  })
})
