import { describe, expect, it } from 'vitest'
import { fromHex, toHex, utf8 } from './bytes'
import { shake } from './fips202'
import {
  bytepad,
  cshake,
  encodeString,
  kmac,
  leftEncode,
  rightEncode,
} from './sp800-185'
import { CSHAKE_VECTORS, KMAC_VECTORS, SAMPLE_KEY_HEX } from './vectors'

describe('SP 800-185 encoding functions', () => {
  it('left_encode matches the spec examples', () => {
    expect(toHex(leftEncode(0))).toBe('0100')
    expect(toHex(leftEncode(1))).toBe('0101')
    expect(toHex(leftEncode(255))).toBe('01ff')
    expect(toHex(leftEncode(256))).toBe('020100')
    expect(toHex(leftEncode(65536))).toBe('03010000')
  })

  it('right_encode is left_encode with the length byte moved to the end', () => {
    expect(toHex(rightEncode(0))).toBe('0001')
    expect(toHex(rightEncode(1))).toBe('0101')
    expect(toHex(rightEncode(256))).toBe('010002')
    expect(toHex(rightEncode(512))).toBe('020002')
  })

  it('rejects values it cannot encode exactly', () => {
    expect(() => leftEncode(-1)).toThrow()
    expect(() => leftEncode(1.5)).toThrow()
    expect(() => rightEncode(Number.MAX_VALUE)).toThrow()
  })

  it('encode_string frames a string with its length in BITS', () => {
    expect(toHex(encodeString(utf8('')))).toBe('0100')
    // "KMAC" is 4 bytes = 32 bits.
    expect(toHex(encodeString(utf8('KMAC')))).toBe('01204b4d4143')
  })

  it('encode_string is unambiguous — no two distinct strings share an encoding', () => {
    // The property that makes domain separation a parsing fact rather than a
    // convention: framing "AB" || "" differs from framing "A" || "B".
    const a = toHex(encodeString(utf8('AB'))) + toHex(encodeString(utf8('')))
    const b = toHex(encodeString(utf8('A'))) + toHex(encodeString(utf8('B')))
    expect(a).not.toBe(b)
  })

  it('bytepad pads to a whole multiple of the width', () => {
    const padded = bytepad(utf8('abc'), 8)
    expect(padded.length).toBe(8)
    expect(toHex(padded)).toBe('0108616263000000')
    expect(bytepad(new Uint8Array(20), 8).length).toBe(24)
    // Already-aligned input is not padded out to an extra block.
    expect(bytepad(new Uint8Array(6), 8).length).toBe(8)
  })

  it('bytepad output always aligns to the sponge rate', () => {
    for (const w of [136, 168]) {
      for (const n of [0, 1, 135, 136, 137, 400]) {
        expect(bytepad(new Uint8Array(n), w).length % w).toBe(0)
      }
    }
  })
})

describe('cSHAKE — SP 800-185 known-answer tests', () => {
  for (const v of CSHAKE_VECTORS) {
    it(v.name, () => {
      const out = cshake(
        v.strength,
        fromHex(v.dataHex),
        v.outputBytes,
        utf8(v.functionName),
        utf8(v.customization),
      )
      expect(toHex(out)).toBe(v.output)
    })
  }

  it('falls back to plain SHAKE when N and S are both empty — byte for byte', () => {
    // SP 800-185 §3.3 requires equality, not similarity.
    const msg = utf8('fallback')
    for (const strength of [128, 256] as const) {
      for (const n of [16, 32, 200]) {
        expect(toHex(cshake(strength, msg, n, utf8(''), utf8('')))).toBe(
          toHex(shake(strength, msg, n)),
        )
      }
    }
  })

  it('diverges from plain SHAKE as soon as either N or S is non-empty', () => {
    const msg = utf8('fallback')
    const plain = toHex(shake(128, msg, 32))
    expect(toHex(cshake(128, msg, 32, utf8(''), utf8('x')))).not.toBe(plain)
    expect(toHex(cshake(128, msg, 32, utf8('x'), utf8('')))).not.toBe(plain)
  })

  it('a one-character change in S yields an unrelated output', () => {
    const msg = utf8('domain separation')
    const a = cshake(128, msg, 32, utf8(''), utf8('Email Signature'))
    const b = cshake(128, msg, 32, utf8(''), utf8('Email Signaturf'))
    expect(toHex(a)).not.toBe(toHex(b))
    // Unrelated, not a near-miss: they should share almost no leading bytes.
    let shared = 0
    while (shared < a.length && a[shared] === b[shared]) shared++
    expect(shared).toBeLessThan(4)
  })
})

describe('KMAC — SP 800-185 known-answer tests', () => {
  for (const v of KMAC_VECTORS) {
    it(v.name, () => {
      const out = kmac({
        strength: v.strength,
        key: fromHex(v.keyHex),
        message: fromHex(v.dataHex),
        outputBits: v.outputBits,
        customization: utf8(v.customization),
        xof: v.xof,
      })
      expect(toHex(out)).toBe(v.output)
    })
  }

  const base = {
    strength: 128 as const,
    key: fromHex(SAMPLE_KEY_HEX),
    message: utf8('transfer $10 to alice'),
    outputBits: 256,
    customization: utf8(''),
    xof: false,
  }

  it('rejects a tampered message: the tag over different bytes differs', () => {
    const good = kmac(base)
    const tampered = kmac({ ...base, message: utf8('transfer $90 to alice') })
    expect(toHex(good)).not.toBe(toHex(tampered))
  })

  it('rejects a wrong key', () => {
    const wrongKey = fromHex(SAMPLE_KEY_HEX.replace(/^40/, '41'))
    expect(toHex(kmac({ ...base, key: wrongKey }))).not.toBe(toHex(kmac(base)))
  })

  it('binds the output length: KMAC at two lengths is NOT a truncation', () => {
    // right_encode(L) is absorbed, so L changes the input, not just the slice.
    const short = kmac({ ...base, outputBits: 256 })
    const long = kmac({ ...base, outputBits: 512 })
    expect(toHex(long.subarray(0, 32))).not.toBe(toHex(short))
  })

  it('KMACXOF does NOT bind the length: outputs are prefixes of one another', () => {
    // right_encode(0) is absorbed regardless of L, so the squeeze just continues.
    const short = kmac({ ...base, xof: true, outputBits: 256 })
    const long = kmac({ ...base, xof: true, outputBits: 512 })
    expect(toHex(long.subarray(0, 32))).toBe(toHex(short))
  })

  it('separates domains by customization string', () => {
    const a = kmac({ ...base, customization: utf8('invoices') })
    const b = kmac({ ...base, customization: utf8('receipts') })
    expect(toHex(a)).not.toBe(toHex(b))
  })

  it('accepts an empty key and an empty message without special-casing', () => {
    const out = kmac({ ...base, key: new Uint8Array(0), message: new Uint8Array(0) })
    expect(out.length).toBe(32)
  })

  it('accepts a key longer than the rate', () => {
    const out = kmac({ ...base, key: new Uint8Array(500).fill(0x5a) })
    expect(out.length).toBe(32)
  })

  it('rejects output lengths it cannot honestly produce', () => {
    expect(() => kmac({ ...base, outputBits: 0 })).toThrow()
    expect(() => kmac({ ...base, outputBits: -8 })).toThrow()
    expect(() => kmac({ ...base, outputBits: 12 })).toThrow(/whole-byte/)
  })
})
