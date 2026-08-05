import { describe, expect, it } from 'vitest'
import { toHex, utf8 } from '../keccak/bytes'
import { sha3_256, shake } from '../keccak/fips202'
import { cshake, kmac } from '../keccak/sp800-185'
import { DEFAULT_INPUTS, computeRun, stagePermutationCalls, type DemoInputs } from './run'

const run = (overrides: Partial<DemoInputs> = {}) =>
  computeRun({ ...DEFAULT_INPUTS, ...overrides })

describe('one run report drives the whole page', () => {
  it('the parts sum to the whole: stage permutation counts equal the total', () => {
    for (const inputs of [
      {},
      { message: '' },
      { message: 'x'.repeat(600) },
      { shakeBytes: 512, shakeStrength: 256 as const },
      { cshakeName: 'Widget', cshakeCustom: '' },
      { kmacXof: true, kmacOutputBits: 512, kmacStrength: 256 as const },
    ]) {
      const report = run(inputs)
      const parts = stagePermutationCalls(report)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(report.totalPermutationCalls)
      expect(report.totalPermutationCalls).toBeGreaterThan(0)
    }
  })

  it('every displayed digest is the real primitive over the real inputs', () => {
    const report = run({ message: 'independent check' })
    const msg = utf8('independent check')
    expect(toHex(report.sha3.digest)).toBe(toHex(sha3_256(msg)))
    expect(toHex(report.shakeStage.output)).toBe(
      toHex(shake(report.shakeStage.strength, msg, report.shakeStage.outputBytes)),
    )
    expect(toHex(report.cshakeStage.output)).toBe(
      toHex(
        cshake(
          report.cshakeStage.strength,
          msg,
          32,
          utf8(report.cshakeStage.name),
          utf8(report.cshakeStage.custom),
        ),
      ),
    )
    expect(toHex(report.kmacStage.tag)).toBe(toHex(kmac(report.kmacStage.params)))
  })

  it('stages 1 to 3 really do share one message', () => {
    const report = run({ message: 'shared bytes' })
    expect(toHex(report.sha3.messageBytes)).toBe(toHex(utf8('shared bytes')))
    // The SHAKE and cSHAKE outputs must be over that same message.
    expect(toHex(report.shakeStage.output)).toBe(
      toHex(shake(report.shakeStage.strength, report.sha3.messageBytes, report.shakeStage.outputBytes)),
    )
  })

  it('the four modes pad with four different domain suffixes', () => {
    const report = run({ cshakeCustom: 'Email Signature' })
    const suffixes = report.suffixes.map((s) => s.suffix)
    expect(suffixes).toEqual([0x06, 0x1f, 0x04, 0x04])
    // ...and when cSHAKE falls back to SHAKE, its reported suffix follows.
    expect(run({ cshakeName: '', cshakeCustom: '' }).suffixes[2].suffix).toBe(0x1f)
  })
})

describe('stage 2 — extendable output', () => {
  it('reports a prefix match computed from the two outputs', () => {
    for (const bytes of [16, 17, 64, 168, 169, 400]) {
      const report = run({ shakeBytes: bytes })
      expect(report.shakeStage.prefixHolds).toBe(true)
      expect(report.shakeStage.sharedWithReference).toBe(
        Math.min(16, report.shakeStage.outputBytes),
      )
      expect(toHex(report.shakeStage.output.subarray(0, 16))).toBe(
        toHex(report.shakeStage.reference.subarray(0, 16)),
      )
    }
  })

  it('two squeezes concatenate to one longer squeeze', () => {
    const report = run({ shakeBytes: 300 })
    expect(report.shakeStage.continuation.identical).toBe(true)
  })

  it('a longer request costs more permutation calls, not a fresh absorb', () => {
    const small = run({ shakeBytes: 16 })
    const large = run({ shakeBytes: 1000 })
    expect(large.shakeStage.operationCalls).toBeGreaterThan(small.shakeStage.operationCalls)
  })
})

describe('stage 3 — domain separation and the SHAKE fallback', () => {
  it('a customization string makes the output unrelated to plain SHAKE', () => {
    const report = run({ cshakeCustom: 'Email Signature' })
    expect(report.cshakeStage.fallbackActive).toBe(false)
    expect(report.cshakeStage.sharedWithPlain).toBeLessThan(4)
    expect(toHex(report.cshakeStage.output)).not.toBe(toHex(report.cshakeStage.plain))
  })

  it('a one-character change in S gives an unrelated output', () => {
    const report = run({ cshakeCustom: 'Email Signature' })
    expect(report.cshakeStage.neighbourCustom).toBe('Email Signaturf')
    expect(report.cshakeStage.sharedWithNeighbour).toBeLessThan(4)
  })

  it('empty N and S falls back to plain SHAKE, byte for byte', () => {
    const report = run({ cshakeName: '', cshakeCustom: '' })
    expect(report.cshakeStage.fallbackActive).toBe(true)
    expect(toHex(report.cshakeStage.output)).toBe(toHex(report.cshakeStage.plain))
    expect(report.cshakeStage.framedPrefix.length).toBe(0)
  })

  it('the fallback proof is computed even while a customization is set', () => {
    // So the learner can see both facts at once without clearing their input.
    const report = run({ cshakeCustom: 'Email Signature' })
    expect(report.cshakeStage.fallbackProof.identical).toBe(true)
  })

  it('the framed prefix is a whole number of rate blocks', () => {
    for (const strength of [128, 256] as const) {
      const report = run({ cshakeStrength: strength, cshakeCustom: 'S', cshakeName: 'N' })
      const rate = strength === 128 ? 168 : 136
      expect(report.cshakeStage.framedPrefix.length % rate).toBe(0)
      expect(report.cshakeStage.framedPrefix.length).toBeGreaterThan(0)
    }
  })
})

describe('stage 4 — KMAC output-length binding', () => {
  it('KMAC at two lengths is not a truncation', () => {
    const report = run()
    expect(report.kmacStage.lengthBinding.isTruncation).toBe(false)
    expect(report.kmacStage.lengthBinding.sharedBytes).toBeLessThan(4)
  })

  it('KMACXOF at two lengths IS a prefix', () => {
    const report = run()
    expect(report.kmacStage.xofBinding.isTruncation).toBe(true)
    expect(report.kmacStage.xofBinding.sharedBytes).toBe(32)
  })

  it('the framing shows a key block padded to the rate', () => {
    for (const strength of [128, 256] as const) {
      const report = run({ kmacStrength: strength })
      const rate = strength === 128 ? 168 : 136
      expect(report.kmacStage.framing.keyBlock.length % rate).toBe(0)
    }
  })

  it('the length suffix encodes L for KMAC and 0 for KMACXOF', () => {
    expect(toHex(run({ kmacXof: false, kmacOutputBits: 256 }).kmacStage.framing.lengthSuffix)).toBe(
      '010002',
    )
    expect(toHex(run({ kmacXof: true, kmacOutputBits: 256 }).kmacStage.framing.lengthSuffix)).toBe(
      '0001',
    )
  })
})

describe('the report is a function of the inputs alone', () => {
  it('recomputing with the same inputs gives the same values', () => {
    const a = run({ message: 'determinism' })
    const b = run({ message: 'determinism' })
    expect(toHex(a.sha3.digest)).toBe(toHex(b.sha3.digest))
    expect(a.totalPermutationCalls).toBe(b.totalPermutationCalls)
  })

  it('changing the shared message changes stages 1 to 3 together', () => {
    const a = run({ message: 'one' })
    const b = run({ message: 'two' })
    expect(toHex(a.sha3.digest)).not.toBe(toHex(b.sha3.digest))
    expect(toHex(a.shakeStage.output)).not.toBe(toHex(b.shakeStage.output))
    expect(toHex(a.cshakeStage.output)).not.toBe(toHex(b.cshakeStage.output))
    // ...and leaves stage 4, which owns its own message, untouched.
    expect(toHex(a.kmacStage.tag)).toBe(toHex(b.kmacStage.tag))
  })

  it('handles an empty message and a very long one', () => {
    expect(run({ message: '' }).sha3.digest.length).toBe(32)
    expect(run({ message: 'x'.repeat(5000) }).sha3.digest.length).toBe(32)
  })
})
