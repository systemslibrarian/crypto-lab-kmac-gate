/**
 * The pipeline spine — the demo's thesis as data.
 *
 * All four modes are the same six-step pipeline:
 *
 *   parameters -> framed input -> absorb into RATE -> Keccak-f[1600]
 *              -> squeeze from RATE -> output contract
 *
 * Only some of those steps differ between modes, and the permutation step
 * never does. Modelling that as data (rather than four hand-written panels)
 * means the page can show, per stage, exactly which steps changed from the
 * previous stage — and can never claim a step changed when it did not, because
 * the highlight is computed by comparing these values.
 */

import { toHex } from '../keccak/bytes'
import type { RunReport } from './run'

/** The six steps, in pipeline order. `permutation` is the shared one. */
export const STEP_KEYS = [
  'params',
  'framing',
  'absorb',
  'suffix',
  'permutation',
  'output',
] as const

export type StepKey = (typeof STEP_KEYS)[number]

export const STEP_LABEL: Record<StepKey, string> = {
  params: 'Sponge parameters',
  framing: 'Framed input',
  absorb: 'Absorb into rate',
  suffix: 'Domain suffix',
  permutation: 'Keccak-f[1600]',
  output: 'Squeeze / output contract',
}

export interface PipelineStage {
  key: string
  /** The mode as named on screen, e.g. "KMAC128". */
  mode: string
  values: Record<StepKey, string>
  /**
   * How many times this mode called the permutation.
   *
   * Deliberately NOT folded into `values.permutation`: that string has to be
   * genuinely identical across all four stages for the "never differs" claim
   * to be true, and a per-mode count inside it would quietly make the claim
   * false. The count is shown next to the step, not as the step.
   */
  permutationCalls: number
}

function blocksPhrase(n: number): string {
  return `${n} block${n === 1 ? '' : 's'} XORed in`
}

export function pipelineStages(report: RunReport): PipelineStage[] {
  const { sha3, shakeStage: sh, cshakeStage: cs, kmacStage: km } = report

  const sha3Rate = sha3.trace.rateBytes
  const shRate = sh.trace.rateBytes
  const csRate = cs.trace.rateBytes
  const kmRate = km.trace.rateBytes

  const params = (rate: number): string => `rate ${rate} B / capacity ${200 - rate} B`
  const suffix = (s: number): string => `0x${s.toString(16).padStart(2, '0')}`
  // One constant string, shared by every stage — see PipelineStage.permutationCalls.
  const permutation = 'the same keccakF1600 function'

  return [
    {
      key: 'sha3',
      mode: 'SHA3-256',
      values: {
        params: params(sha3Rate),
        framing: 'the message, unframed',
        absorb: blocksPhrase(sha3.trace.steps.filter((s) => s.kind !== 'squeeze').length),
        suffix: suffix(sha3.trace.suffix),
        permutation,
        output: 'fixed 32 bytes',
      },
      permutationCalls: sha3.operationCalls,
    },
    {
      key: 'shake',
      mode: `SHAKE${sh.strength}`,
      values: {
        params: params(shRate),
        framing: 'the message, unframed',
        absorb: blocksPhrase(sh.trace.steps.filter((s) => s.kind !== 'squeeze').length),
        suffix: suffix(sh.trace.suffix),
        permutation,
        output: `${sh.outputBytes} bytes, extendable`,
      },
      permutationCalls: sh.operationCalls,
    },
    {
      key: 'cshake',
      mode: `cSHAKE${cs.strength}`,
      values: {
        params: params(csRate),
        framing: cs.fallbackActive
          ? 'the message, unframed (N and S empty)'
          : `bytepad(encode_string(N) ‖ encode_string(S), ${csRate}) ‖ message`,
        absorb: blocksPhrase(cs.trace.steps.filter((s) => s.kind !== 'squeeze').length),
        suffix: suffix(cs.trace.suffix),
        permutation,
        output: '32 bytes, extendable',
      },
      permutationCalls: cs.operationCalls,
    },
    {
      key: 'kmac',
      mode: `KMAC${km.params.strength}`,
      values: {
        params: params(kmRate),
        framing: `bytepad(encode_string(K), ${kmRate}) ‖ message ‖ right_encode(${km.params.xof ? 0 : km.params.outputBits})`,
        absorb: blocksPhrase(km.trace.steps.filter((s) => s.kind !== 'squeeze').length),
        suffix: suffix(km.trace.suffix),
        permutation,
        output: km.params.xof
          ? `${km.params.outputBits / 8} bytes, extendable stream`
          : `${km.params.outputBits / 8} bytes, length bound into the input`,
      },
      permutationCalls: km.operationCalls,
    },
  ]
}

/**
 * Which steps differ from the previous stage. Computed by comparison, never
 * asserted — a stage cannot claim a delta it does not have.
 *
 * The first stage has no predecessor, so nothing is marked as changed.
 */
export function changedSteps(stages: PipelineStage[], index: number): StepKey[] {
  if (index <= 0) return []
  const prev = stages[index - 1]
  const cur = stages[index]
  return STEP_KEYS.filter((k) => prev.values[k] !== cur.values[k])
}

/**
 * The steps that are identical across ALL four stages.
 *
 * The permutation step is worded so that it always lands here, which is the
 * whole point of the exhibit: whatever else differs, that row does not.
 */
export function invariantSteps(stages: PipelineStage[]): StepKey[] {
  return STEP_KEYS.filter((k) => stages.every((s) => s.values[k] === stages[0].values[k]))
}

/** Does every stage route through a permutation step naming the same function? */
export function sharesOnePermutation(stages: PipelineStage[]): boolean {
  return (
    stages.every((s) => s.values.permutation.includes('the same keccakF1600')) &&
    new Set(stages.map((s) => s.values.permutation)).size === 1
  )
}

/** Byte-level detail of the framed prefix, for the inspect layer. */
export function framingBytes(report: RunReport): { label: string; hex: string }[] {
  const out: { label: string; hex: string }[] = []
  const cs = report.cshakeStage
  if (cs.framedPrefix.length > 0) {
    out.push({
      label: `cSHAKE framed prefix (${cs.framedPrefix.length} bytes)`,
      hex: toHex(cs.framedPrefix.subarray(0, 32)),
    })
  }
  const km = report.kmacStage
  out.push({
    label: `KMAC key block (${km.framing.keyBlock.length} bytes)`,
    hex: toHex(km.framing.keyBlock.subarray(0, 32)),
  })
  out.push({ label: 'KMAC length suffix', hex: toHex(km.framing.lengthSuffix) })
  return out
}
