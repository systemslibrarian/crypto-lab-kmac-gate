import { describe, expect, it } from 'vitest'
import { concat, fromHex, toHex, utf8 } from '../keccak/bytes'
import { sha3_256, shake } from '../keccak/fips202'
import { kmac } from '../keccak/sp800-185'
import { SAMPLE_KEY_HEX } from '../keccak/vectors'
import { traceCshake, traceKmac, traceSha3_256, traceShake } from './trace'

describe('the on-screen trace is collected from the real run', () => {
  it('SHA3-256: the traced output equals the primitive output', () => {
    const msg = utf8('hello sponge')
    expect(toHex(traceSha3_256(msg).output)).toBe(toHex(sha3_256(msg)))
  })

  it('KMAC: the traced output equals the primitive output', () => {
    const params = {
      strength: 128 as const,
      key: fromHex(SAMPLE_KEY_HEX),
      message: utf8('trace me'),
      outputBits: 256,
      customization: utf8('app'),
      xof: false,
    }
    expect(toHex(traceKmac(params).output)).toBe(toHex(kmac(params)))
  })

  it('a short message is one padded block, and the pad step is labelled as such', () => {
    const t = traceSha3_256(utf8('short'))
    expect(t.steps).toHaveLength(1)
    expect(t.steps[0].kind).toBe('pad')
    expect(t.permutationCalls).toBe(1)
  })

  it('the block count follows the rate, and permutation calls follow the blocks', () => {
    // SHA3-256 rate is 136 bytes. 136 bytes of input needs a whole extra
    // padding block, because pad10*1 always adds at least one byte.
    for (const [len, expectedSteps] of [
      [0, 1],
      [135, 1],
      [136, 2],
      [271, 2],
      [272, 3],
    ] as const) {
      const t = traceSha3_256(new Uint8Array(len))
      expect(t.steps, `${len} bytes`).toHaveLength(expectedSteps)
      expect(t.permutationCalls, `${len} bytes`).toBe(expectedSteps)
    }
  })

  it('the padded block carries the mode suffix and the pad10*1 final bit', () => {
    const t = traceSha3_256(utf8('abc'))
    const block = t.steps[0].block!
    expect(block.length).toBe(136)
    expect(toHex(block.subarray(0, 3))).toBe(toHex(utf8('abc')))
    expect(block[3]).toBe(0x06) // SHA-3 domain suffix + pad start
    expect(block[135]).toBe(0x80) // pad10*1 trailing 1 bit
  })

  it('each mode pads with its own domain suffix — same message, different framing', () => {
    const msg = utf8('abc')
    expect(traceSha3_256(msg).suffix).toBe(0x06)
    expect(traceShake(128, msg, 32).suffix).toBe(0x1f)
    expect(traceCshake(128, msg, 32, utf8(''), utf8('S')).suffix).toBe(0x04)
    // cSHAKE with empty N and S IS SHAKE, and its suffix says so.
    expect(traceCshake(128, msg, 32, utf8(''), utf8('')).suffix).toBe(0x1f)
  })

  it('extra squeeze blocks appear as squeeze steps, not new absorbs', () => {
    const t = traceShake(128, utf8('xof'), 400) // rate 168 → 3 squeeze blocks
    const absorbs = t.steps.filter((s) => s.kind !== 'squeeze')
    const squeezes = t.steps.filter((s) => s.kind === 'squeeze')
    expect(absorbs).toHaveLength(1)
    expect(squeezes).toHaveLength(2)
    expect(t.permutationCalls).toBe(3)
  })

  it('the rate/capacity split is reported per mode', () => {
    expect(traceSha3_256(utf8('x')).rateBytes).toBe(136)
    expect(traceSha3_256(utf8('x')).capacityBytes).toBe(64)
    expect(traceShake(128, utf8('x'), 32).rateBytes).toBe(168)
    expect(traceShake(128, utf8('x'), 32).capacityBytes).toBe(32)
  })

  it('every step records 25 lanes of 16 hex digits, before and after', () => {
    for (const step of traceShake(256, utf8('lanes'), 300).steps) {
      expect(step.lanesBefore).toHaveLength(25)
      expect(step.lanesAfter).toHaveLength(25)
      for (const lane of step.lanesAfter) expect(lane).toMatch(/^[0-9a-f]{16}$/)
    }
  })

  it('the permutation actually changed the state at every step', () => {
    for (const step of traceSha3_256(new Uint8Array(300)).steps) {
      expect(step.lanesAfter.join()).not.toBe(step.lanesBefore.join())
    }
  })

  it('the digest is the leading bytes of the final state rate', () => {
    // What "squeeze" means, checked rather than described.
    const t = traceSha3_256(utf8('squeeze'))
    const finalLanes = t.steps[t.steps.length - 1].lanesAfter
    // Lane i, little-endian, is bytes 8i…8i+7 of the state.
    const laneBytes = (hex: string): Uint8Array =>
      fromHex(hex).reverse()
    const first32 = concat(...finalLanes.slice(0, 4).map(laneBytes))
    expect(toHex(t.output)).toBe(toHex(first32))
  })

  it('the reported permutation count is the shared counter, not a tally of steps', () => {
    // A mode whose steps were miscounted would still have to match the counter.
    const t = traceShake(256, new Uint8Array(500), 500)
    expect(t.permutationCalls).toBe(t.steps.length)
  })

  it('SHAKE traced at two lengths shares its leading output bytes', () => {
    const msg = utf8('continuation')
    const short = traceShake(128, msg, 32)
    const long = traceShake(128, msg, 256)
    expect(toHex(long.output.subarray(0, 32))).toBe(toHex(short.output))
    expect(toHex(short.output)).toBe(toHex(shake(128, msg, 32)))
  })
})
