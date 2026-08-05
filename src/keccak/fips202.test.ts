import { describe, expect, it } from 'vitest'
import { concat, toHex, utf8 } from './bytes'
import { sha3_256, shake, shakeContinuation } from './fips202'
import { SHA3_256_VECTORS, SHAKE_VECTORS } from './vectors'

describe('SHA3-256 — FIPS 202 known-answer tests', () => {
  for (const v of SHA3_256_VECTORS) {
    it(`hashes ${v.message === '' ? 'the empty message' : `"${v.message.slice(0, 24)}${v.message.length > 24 ? '…' : ''}"`}`, () => {
      expect(toHex(sha3_256(utf8(v.message)))).toBe(v.digest)
    })
  }

  it('produces exactly 32 bytes', () => {
    expect(sha3_256(utf8('anything')).length).toBe(32)
  })

  it('is sensitive to a single-bit change', () => {
    const a = sha3_256(utf8('the quick brown fox'))
    const b = sha3_256(utf8('the quick brown foy'))
    expect(toHex(a)).not.toBe(toHex(b))
  })

  it('handles input that straddles the 136-byte rate boundary', () => {
    // Exercises the multi-block absorb path: 135, 136 and 137 bytes.
    const seen = new Set<string>()
    for (const n of [135, 136, 137, 272]) {
      const msg = new Uint8Array(n).fill(0xab)
      const d = toHex(sha3_256(msg))
      expect(d).toHaveLength(64)
      seen.add(d)
    }
    expect(seen.size).toBe(4)
  })
})

describe('SHAKE — FIPS 202 known-answer tests', () => {
  for (const v of SHAKE_VECTORS) {
    it(`SHAKE${v.strength} of ${v.message === '' ? 'the empty message' : `"${v.message}"`} at ${v.outputBytes} bytes`, () => {
      expect(toHex(shake(v.strength, utf8(v.message), v.outputBytes))).toBe(v.output)
    })
  }

  it('longer output EXTENDS shorter output — it does not rehash', () => {
    // The headline claim of stage 2, checked at the byte level.
    const msg = utf8('sponge')
    const short = shake(128, msg, 16)
    const long = shake(128, msg, 512)
    expect(toHex(long.subarray(0, 16))).toBe(toHex(short))
  })

  it('squeezing twice equals squeezing once for the combined length', () => {
    const { first, second, oneShot } = shakeContinuation(256, utf8('sponge'), 37, 91)
    expect(toHex(concat(first, second))).toBe(toHex(oneShot))
    expect(first.length + second.length).toBe(oneShot.length)
  })

  it('crosses the squeeze rate boundary correctly', () => {
    // SHAKE128 rate is 168 bytes, so 400 bytes needs three squeeze blocks.
    const msg = utf8('rate boundary')
    const long = shake(128, msg, 400)
    expect(long.length).toBe(400)
    expect(toHex(long.subarray(0, 168))).toBe(toHex(shake(128, msg, 168)))
    expect(toHex(long.subarray(0, 336))).toBe(toHex(shake(128, msg, 336)))
  })

  it('SHAKE128 and SHAKE256 of the same message differ', () => {
    const msg = utf8('same input, different capacity')
    expect(toHex(shake(128, msg, 32))).not.toBe(toHex(shake(256, msg, 32)))
  })

  it('a zero-length squeeze is empty, not an error', () => {
    expect(shake(128, utf8('x'), 0).length).toBe(0)
  })
})
