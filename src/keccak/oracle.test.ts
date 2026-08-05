/**
 * Cross-implementation checks.
 *
 * The KAT files prove this code agrees with the spec's published sample
 * values. This file proves it agrees with two INDEPENDENT implementations on
 * inputs nobody published an answer for:
 *
 *   - Node's `crypto` (OpenSSL) for SHA3-256 / SHAKE128 / SHAKE256;
 *   - `js-sha3` for cSHAKE128/256 and KMAC128/256.
 *
 * Both are devDependencies used only by tests — neither is imported by the app
 * bundle, which is hand-rolled all the way down to the permutation. This is
 * the check that catches a bug a self-consistent test would happily agree with.
 */

import { createHash } from 'node:crypto'
import { cshake128, cshake256, kmac128, kmac256 } from 'js-sha3'
import { describe, expect, it } from 'vitest'
import { fromHex, toHex, utf8 } from './bytes'
import { sha3_256, shake } from './fips202'
import { cshake, kmac } from './sp800-185'
import { SAMPLE_KEY_HEX } from './vectors'

/** A spread of message sizes around the 136- and 168-byte rate boundaries. */
const MESSAGE_LENGTHS = [0, 1, 55, 135, 136, 137, 167, 168, 169, 271, 272, 500]

function message(n: number): Uint8Array {
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = (i * 31 + 7) & 0xff
  return out
}

describe('agrees with OpenSSL (Node crypto) on FIPS 202', () => {
  it.each(MESSAGE_LENGTHS)('SHA3-256 of a %i-byte message', (n) => {
    const msg = message(n)
    const expected = createHash('sha3-256').update(Buffer.from(msg)).digest('hex')
    expect(toHex(sha3_256(msg))).toBe(expected)
  })

  it.each(MESSAGE_LENGTHS)('SHAKE128 of a %i-byte message at 64 bytes', (n) => {
    const msg = message(n)
    const expected = createHash('shake128', { outputLength: 64 })
      .update(Buffer.from(msg))
      .digest('hex')
    expect(toHex(shake(128, msg, 64))).toBe(expected)
  })

  it.each(MESSAGE_LENGTHS)('SHAKE256 of a %i-byte message at 64 bytes', (n) => {
    const msg = message(n)
    const expected = createHash('shake256', { outputLength: 64 })
      .update(Buffer.from(msg))
      .digest('hex')
    expect(toHex(shake(256, msg, 64))).toBe(expected)
  })

  it.each([1, 31, 32, 136, 137, 400, 1000])(
    'SHAKE256 at an unusual output length of %i bytes',
    (len) => {
      const msg = utf8('extendable output')
      const expected = createHash('shake256', { outputLength: len })
        .update(Buffer.from(msg))
        .digest('hex')
      expect(toHex(shake(256, msg, len))).toBe(expected)
    },
  )
})

describe('agrees with js-sha3 on SP 800-185', () => {
  it.each(MESSAGE_LENGTHS)('cSHAKE128 of a %i-byte message', (n) => {
    const msg = message(n)
    expect(toHex(cshake(128, msg, 32, utf8(''), utf8('Email Signature')))).toBe(
      cshake128(msg, 256, '', 'Email Signature'),
    )
  })

  it.each(MESSAGE_LENGTHS)('cSHAKE256 of a %i-byte message', (n) => {
    const msg = message(n)
    expect(toHex(cshake(256, msg, 64, utf8('Widget'), utf8('v2')))).toBe(
      cshake256(msg, 512, 'Widget', 'v2'),
    )
  })

  it.each(MESSAGE_LENGTHS)('KMAC128 over a %i-byte message', (n) => {
    const msg = message(n)
    const key = fromHex(SAMPLE_KEY_HEX)
    expect(
      toHex(
        kmac({
          strength: 128,
          key,
          message: msg,
          outputBits: 256,
          customization: utf8('My Tagged Application'),
          xof: false,
        }),
      ),
    ).toBe(kmac128(key, msg, 256, 'My Tagged Application'))
  })

  it.each(MESSAGE_LENGTHS)('KMAC256 over a %i-byte message', (n) => {
    const msg = message(n)
    const key = fromHex(SAMPLE_KEY_HEX)
    expect(
      toHex(
        kmac({
          strength: 256,
          key,
          message: msg,
          outputBits: 512,
          customization: utf8(''),
          xof: false,
        }),
      ),
    ).toBe(kmac256(key, msg, 512, ''))
  })

  it.each([8, 128, 256, 264, 512, 1088, 2048])(
    'KMAC256 binds a requested output length of %i bits',
    (bits) => {
      const key = fromHex(SAMPLE_KEY_HEX)
      const msg = utf8('length binding')
      expect(
        toHex(kmac({ strength: 256, key, message: msg, outputBits: bits, customization: utf8(''), xof: false })),
      ).toBe(kmac256(key, msg, bits, ''))
    },
  )

  it.each([0, 1, 32, 200])('KMAC128 with a %i-byte key', (keyLen) => {
    const key = new Uint8Array(keyLen).fill(0x9c)
    const msg = utf8('key framing')
    expect(
      toHex(kmac({ strength: 128, key, message: msg, outputBits: 256, customization: utf8(''), xof: false })),
    ).toBe(kmac128(key, msg, 256, ''))
  })
})
