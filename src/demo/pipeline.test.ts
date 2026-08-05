import { describe, expect, it } from 'vitest'
import { toHex, utf8 } from '../keccak/bytes'
import { traceSha3_256, traceShake } from './trace'
import {
  STEP_KEYS,
  changedSteps,
  invariantSteps,
  pipelineStages,
  sharesOnePermutation,
} from './pipeline'
import { DEFAULT_INPUTS, computeRun, stageCosts, type DemoInputs } from './run'

const run = (o: Partial<DemoInputs> = {}) => computeRun({ ...DEFAULT_INPUTS, ...o })

describe('the pipeline spine', () => {
  it('describes all four modes with the same six steps, in order', () => {
    const stages = pipelineStages(run())
    expect(stages).toHaveLength(4)
    for (const stage of stages) {
      expect(Object.keys(stage.values).sort()).toEqual([...STEP_KEYS].sort())
      for (const key of STEP_KEYS) expect(stage.values[key]).toBeTruthy()
    }
  })

  it('the permutation step is identical across all four modes', () => {
    // The thesis, as a test: whatever else is re-parameterised, this is not.
    for (const inputs of [
      {},
      { shakeStrength: 256 as const, cshakeStrength: 256 as const, kmacStrength: 256 as const },
      { cshakeName: '', cshakeCustom: '' },
      { kmacXof: true, kmacOutputBits: 512 },
    ]) {
      const stages = pipelineStages(run(inputs))
      expect(sharesOnePermutation(stages)).toBe(true)
      for (let i = 0; i < stages.length; i++) {
        expect(changedSteps(stages, i)).not.toContain('permutation')
      }
    }
  })

  it('the first stage has no predecessor, so nothing is marked changed', () => {
    expect(changedSteps(pipelineStages(run()), 0)).toEqual([])
  })

  it('marks a step changed only when the values really differ', () => {
    const stages = pipelineStages(run())
    for (let i = 1; i < stages.length; i++) {
      for (const key of changedSteps(stages, i)) {
        expect(stages[i].values[key]).not.toBe(stages[i - 1].values[key])
      }
      const unchanged = STEP_KEYS.filter((k) => !changedSteps(stages, i).includes(k))
      for (const key of unchanged) {
        expect(stages[i].values[key]).toBe(stages[i - 1].values[key])
      }
    }
  })

  it('SHA3 to SHAKE changes the output contract and the suffix', () => {
    const changed = changedSteps(pipelineStages(run()), 1)
    expect(changed).toContain('suffix')
    expect(changed).toContain('output')
  })

  it('SHAKE to cSHAKE changes the framing when a customization is set', () => {
    const changed = changedSteps(pipelineStages(run({ cshakeCustom: 'Invoices/v1' })), 2)
    expect(changed).toContain('framing')
    expect(changed).toContain('suffix')
  })

  it('with N and S empty, cSHAKE keeps SHAKE framing and SHAKE suffix', () => {
    const stages = pipelineStages(run({ cshakeName: '', cshakeCustom: '', shakeStrength: 128 }))
    expect(stages[2].values.framing).toContain('unframed')
    expect(stages[2].values.suffix).toBe('0x1f')
    expect(stages[1].values.suffix).toBe('0x1f')
  })

  it('KMAC always frames a key block and a length suffix', () => {
    const stages = pipelineStages(run())
    expect(stages[3].values.framing).toContain('bytepad(encode_string(K)')
    expect(stages[3].values.framing).toContain('right_encode(256)')
    expect(pipelineStages(run({ kmacXof: true }))[3].values.framing).toContain('right_encode(0)')
  })

  it('when every mode runs at the same strength, the parameters row is invariant', () => {
    const stages = pipelineStages(
      run({ shakeStrength: 256, cshakeStrength: 256, kmacStrength: 256 }),
    )
    expect(invariantSteps(stages)).toContain('params')
    expect(invariantSteps(stages)).toContain('permutation')
  })
})

describe('permutation cost is reported honestly', () => {
  it('a stage operation cost is the operation alone, not its proof runs', () => {
    const report = run()
    const costs = stageCosts(report)
    const kmac = costs.find((c) => c.label === 'KMAC')!
    // The KMAC stage computes four extra tags for the length-binding panel.
    expect(kmac.proof).toBeGreaterThan(0)
    // ...and the headline figure is the tag alone, which must match the trace.
    expect(kmac.operation).toBe(report.kmacStage.trace.permutationCalls)
    expect(kmac.operation).toBeLessThan(kmac.operation + kmac.proof)
  })

  it('the operation cost equals an independently traced run of that mode', () => {
    const report = run({ message: 'cost check', shakeBytes: 300, shakeStrength: 128 })
    expect(report.sha3.operationCalls).toBe(traceSha3_256(utf8('cost check')).permutationCalls)
    expect(report.shakeStage.operationCalls).toBe(
      traceShake(128, utf8('cost check'), 300).permutationCalls,
    )
  })

  it('SHA3 of a short message costs exactly one permutation', () => {
    expect(run({ message: 'short' }).sha3.operationCalls).toBe(1)
  })

  it('operation plus proof still accounts for every call on the shared counter', () => {
    for (const inputs of [{}, { message: 'x'.repeat(500) }, { kmacStrength: 256 as const }]) {
      const report = run(inputs)
      const total = stageCosts(report).reduce((a, c) => a + c.operation + c.proof, 0)
      expect(total).toBe(report.totalPermutationCalls)
    }
  })
})

describe('the trace carries structural padding offsets', () => {
  it('reports where the suffix really is, not where a matching byte is', () => {
    // A message containing the SHA-3 suffix byte as DATA must not confuse it.
    const msg = utf8('ab\x06cd')
    const t = traceSha3_256(msg)
    const step = t.steps[0]
    expect(toHex(msg)).toBe('6162066364')
    expect(step.suffixOffset).toBe(5)
    // A value search would have found the message's own byte at offset 2.
    expect(step.block!.findIndex((b) => b === t.suffix)).toBe(2)
    expect(step.block![step.suffixOffset!]).toBe(0x06)
  })

  it('handles messages containing every padding-like byte', () => {
    for (const [text, mode] of [
      ['\x06\x06\x06', 'sha3'],
      ['\x1f\x1f', 'sha3'],
      ['\x04\x04\x04\x04', 'sha3'],
      ['\x80\x80', 'sha3'],
      ['\x00\x00\x00\x00\x00', 'sha3'],
    ] as const) {
      void mode
      const msg = utf8(text)
      const t = traceSha3_256(msg)
      const step = t.steps[0]
      expect(step.suffixOffset, text).toBe(msg.length)
      expect(step.block![step.suffixOffset!], text).toBe(t.suffix)
    }
  })

  it('reports the pad bit at the last byte of the rate', () => {
    const t = traceSha3_256(utf8('x'))
    expect(t.steps[0].padBitOffset).toBe(t.rateBytes - 1)
    expect(t.steps[0].block![t.steps[0].padBitOffset!] & 0x80).toBe(0x80)
  })

  it('when the message fills the block to one byte short, both share a byte', () => {
    // 135 bytes into a 136-byte rate: the suffix lands in the final byte and
    // the pad bit is OR-ed into the same byte.
    const t = traceSha3_256(new Uint8Array(135))
    const step = t.steps[0]
    expect(step.suffixOffset).toBe(135)
    expect(step.padBitOffset).toBe(135)
    expect(step.block![135]).toBe(0x06 | 0x80)
  })

  it('absorb steps carry no padding offsets — only the padding step does', () => {
    const t = traceSha3_256(new Uint8Array(300))
    const absorbs = t.steps.filter((s) => s.kind === 'absorb')
    expect(absorbs.length).toBeGreaterThan(0)
    for (const step of absorbs) {
      expect(step.suffixOffset).toBeUndefined()
      expect(step.padBitOffset).toBeUndefined()
    }
    expect(t.steps[t.steps.length - 1].suffixOffset).toBeDefined()
  })
})

describe('the capacity claim the demo makes is the true one', () => {
  it('capacity lanes are zero before the permutation and non-zero after', () => {
    // This is why the copy may not say the capacity is "never touched": the
    // permutation diffuses input straight into it. The security property is
    // that it is never EMITTED.
    const t = traceSha3_256(utf8('hello'))
    const rateLanes = t.rateBytes / 8
    const before = t.steps[0].lanesBefore.slice(rateLanes)
    const after = t.steps[0].lanesAfter.slice(rateLanes)
    expect(before.every((l) => l === '0000000000000000')).toBe(true)
    expect(after.some((l) => l !== '0000000000000000')).toBe(true)
  })

  it('the emitted output never exceeds the rate of any one squeeze block', () => {
    // The output is read from the rate only; capacity bytes are never emitted.
    const t = traceSha3_256(utf8('hello'))
    expect(t.output.length).toBeLessThanOrEqual(t.rateBytes)
  })
})
