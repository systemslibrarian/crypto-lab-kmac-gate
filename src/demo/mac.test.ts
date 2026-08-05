import { describe, expect, it } from 'vitest'
import { fromHex, toHex, utf8 } from '../keccak/bytes'
import { kmac, type KmacParams } from '../keccak/sp800-185'
import { SAMPLE_KEY_HEX } from '../keccak/vectors'
import { CAUSE_TEXT, computeTag, verifyMessage } from './mac'

const base = (): KmacParams => ({
  strength: 128,
  key: fromHex(SAMPLE_KEY_HEX),
  message: utf8('pay alice 100'),
  outputBits: 256,
  customization: utf8(''),
  xof: false,
})

describe('KMAC sign / verify', () => {
  it('accepts an untouched message', () => {
    const params = base()
    const { tag } = computeTag(params)
    const outcome = verifyMessage(params, tag, params)
    expect(outcome.accepted).toBe(true)
    expect(outcome.cause).toBeNull()
    expect(outcome.divergesAtByte).toBe(-1)
  })

  it('the tag it produces is the real KMAC of the inputs', () => {
    const params = base()
    expect(computeTag(params).tagHex).toBe(toHex(kmac(params)))
  })

  // --- failure paths: each is TESTED, not merely reachable -----------------

  it('rejects a tampered message and names the message as the cause', () => {
    const signed = base()
    const { tag } = computeTag(signed)
    const tampered = { ...signed, message: utf8('pay alice 900') }
    const outcome = verifyMessage(tampered, tag, signed)
    expect(outcome.accepted).toBe(false)
    expect(outcome.cause).toBe('message-differs')
    expect(CAUSE_TEXT[outcome.cause!]).toMatch(/message/)
  })

  it('rejects a single flipped bit in the message', () => {
    const signed = base()
    const { tag } = computeTag(signed)
    const flipped = new Uint8Array(signed.message)
    flipped[0] ^= 0x01
    expect(verifyMessage({ ...signed, message: flipped }, tag, signed).accepted).toBe(false)
  })

  it('rejects a truncated message', () => {
    const signed = base()
    const { tag } = computeTag(signed)
    const shorter = signed.message.subarray(0, signed.message.length - 1)
    expect(verifyMessage({ ...signed, message: shorter }, tag, signed).accepted).toBe(false)
  })

  it('rejects an APPENDED message — the sponge has no length extension', () => {
    // The property the closing contrast panel is about, verified against the
    // real primitive: holding a valid tag does not let you tag a longer message.
    const signed = base()
    const { tag } = computeTag(signed)
    const appended = { ...signed, message: utf8('pay alice 100 and bob 500') }
    expect(verifyMessage(appended, tag, signed).accepted).toBe(false)
  })

  it('rejects a wrong key and names the key', () => {
    const signed = base()
    const { tag } = computeTag(signed)
    const wrong = { ...signed, key: fromHex(SAMPLE_KEY_HEX.replace(/^40/, '41')) }
    const outcome = verifyMessage(wrong, tag, signed)
    expect(outcome.accepted).toBe(false)
    expect(outcome.cause).toBe('key-differs')
  })

  it('rejects a changed output length and names the length', () => {
    const signed = base()
    const { tag } = computeTag(signed)
    const outcome = verifyMessage({ ...signed, outputBits: 512 }, tag, signed)
    expect(outcome.accepted).toBe(false)
    expect(outcome.cause).toBe('length-differs')
  })

  it('rejects a changed customization string and names it', () => {
    const signed = base()
    const { tag } = computeTag(signed)
    const outcome = verifyMessage({ ...signed, customization: utf8('other') }, tag, signed)
    expect(outcome.accepted).toBe(false)
    expect(outcome.cause).toBe('customization-differs')
  })

  it('rejects a changed strength and variant', () => {
    const signed = base()
    const { tag } = computeTag(signed)
    expect(verifyMessage({ ...signed, strength: 256 }, tag, signed).cause).toBe('strength-differs')
    expect(verifyMessage({ ...signed, xof: true }, tag, signed).cause).toBe('variant-differs')
  })

  it('rejects a doctored tag when every input is unchanged', () => {
    const signed = base()
    const { tag } = computeTag(signed)
    const doctored = new Uint8Array(tag)
    doctored[31] ^= 0xff
    const outcome = verifyMessage(signed, doctored, signed)
    expect(outcome.accepted).toBe(false)
    expect(outcome.cause).toBe('tag-differs')
    expect(outcome.divergesAtByte).toBe(31)
  })

  it('rejects a tag of the wrong length outright', () => {
    const signed = base()
    const { tag } = computeTag(signed)
    expect(verifyMessage(signed, tag.subarray(0, 31), signed).accepted).toBe(false)
  })

  it('the verifier decides on bytes alone, not on the bookkeeping', () => {
    // Lying about what was signed must not turn a bad tag good, nor a good tag
    // bad: `signedUnder` only labels the cause, it never gates acceptance.
    const signed = base()
    const { tag } = computeTag(signed)
    const lie = { ...signed, message: utf8('a completely different claim') }
    expect(verifyMessage(signed, tag, lie).accepted).toBe(true)
    const tampered = { ...signed, message: utf8('tampered') }
    expect(verifyMessage(tampered, tag, tampered).accepted).toBe(false)
  })

  it('reports where the tags diverge', () => {
    const signed = base()
    const { tag } = computeTag(signed)
    const outcome = verifyMessage({ ...signed, message: utf8('x') }, tag, signed)
    expect(outcome.divergesAtByte).toBeGreaterThanOrEqual(0)
    expect(outcome.recomputedHex).not.toBe(outcome.presentedHex)
  })
})
