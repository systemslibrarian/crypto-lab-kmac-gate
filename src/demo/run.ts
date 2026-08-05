/**
 * ONE computation per render, for the whole page.
 *
 * Every number, digest and verdict the page displays comes out of a single
 * `computeRun()` call over the current inputs. Panels are pure renderers of
 * that report. This is structural, not stylistic: it is what makes it
 * impossible for two panels to describe different runs, and it means no value
 * on screen can outlive the inputs that produced it — a new render replaces
 * the whole report.
 *
 * The one exception is the KMAC sign/verify exhibit, which deliberately holds
 * a tag made at a moment in the past. That is the point of it, and its verdict
 * carries explicit retirement handling instead (see `verdict.ts`).
 */

import { sharedPrefixLength, utf8, equalBytes } from '../keccak/bytes'
import { shake, shakeContinuation, shakeRate, type Strength } from '../keccak/fips202'
import { permutationCallCount, resetPermutationCallCount } from '../keccak/keccak-f1600'
import { cshake, cshakePrefix, kmac, kmacAbsorbedInput, type KmacParams } from '../keccak/sp800-185'
import { traceCshake, traceKmac, traceSha3_256, traceShake, type TraceResult } from './trace'

export interface DemoInputs {
  /** Shared by stages 1–3: the same message, framed four different ways. */
  message: string
  shakeStrength: Strength
  shakeBytes: number
  cshakeStrength: Strength
  cshakeName: string
  cshakeCustom: string
  kmacKey: string
  kmacMessage: string
  kmacStrength: Strength
  kmacOutputBits: number
  kmacXof: boolean
  kmacCustom: string
}

export const DEFAULT_INPUTS: DemoInputs = {
  message: 'The sponge absorbs, then it squeezes.',
  shakeStrength: 128,
  shakeBytes: 64,
  cshakeStrength: 128,
  cshakeName: '',
  cshakeCustom: 'Email Signature',
  kmacKey: 'shared-key-2026',
  kmacMessage: 'transfer 100 to alice',
  kmacStrength: 128,
  kmacOutputBits: 256,
  kmacXof: false,
  kmacCustom: '',
}

/** How many bytes the SHAKE prefix proof compares. */
export const PREFIX_PROOF_BYTES = 16

export interface Sha3Report {
  trace: TraceResult
  digest: Uint8Array
  messageBytes: Uint8Array
  permutationCalls: number
}

export interface ShakeReport {
  strength: Strength
  outputBytes: number
  trace: TraceResult
  output: Uint8Array
  /** A separate, shorter squeeze of the same message, to compare against. */
  reference: Uint8Array
  /** Leading bytes the long and short outputs share (computed, not assumed). */
  sharedWithReference: number
  prefixHolds: boolean
  /** Squeezing in two goes vs one go — the continuation proof. */
  continuation: { first: Uint8Array; second: Uint8Array; oneShot: Uint8Array; identical: boolean }
  permutationCalls: number
}

export interface CshakeReport {
  strength: Strength
  name: string
  custom: string
  /** cSHAKE under the learner's N and S. */
  output: Uint8Array
  /** Plain SHAKE of the same message at the same strength and length. */
  plain: Uint8Array
  /** True when N and S are both empty, so the spec's SHAKE fallback applies. */
  fallbackActive: boolean
  sharedWithPlain: number
  /** The always-computed fallback proof: cSHAKE with empty N,S vs plain SHAKE. */
  fallbackProof: { cshakeEmpty: Uint8Array; plain: Uint8Array; identical: boolean }
  /** Changing only S: the same message under a neighbouring customization. */
  neighbourCustom: string
  neighbourOutput: Uint8Array
  sharedWithNeighbour: number
  /** The framed prefix cSHAKE absorbs before the message. */
  framedPrefix: Uint8Array
  trace: TraceResult
  permutationCalls: number
}

export interface KmacReport {
  params: KmacParams
  /** The tag the CURRENT inputs produce. Not a verdict — just a computed value. */
  tag: Uint8Array
  trace: TraceResult
  framing: { keyBlock: Uint8Array; message: Uint8Array; lengthSuffix: Uint8Array }
  /** Output-length binding: KMAC at two lengths is not a truncation. */
  lengthBinding: {
    shortBits: number
    longBits: number
    short: Uint8Array
    long: Uint8Array
    sharedBytes: number
    isTruncation: boolean
  }
  /** The same comparison for KMACXOF, where the prefix property DOES hold. */
  xofBinding: {
    short: Uint8Array
    long: Uint8Array
    sharedBytes: number
    isTruncation: boolean
  }
  permutationCalls: number
}

export interface RunReport {
  inputs: DemoInputs
  sha3: Sha3Report
  shakeStage: ShakeReport
  cshakeStage: CshakeReport
  kmacStage: KmacReport
  /** Permutation calls made by this render, on the one shared counter. */
  totalPermutationCalls: number
  /** The domain suffix each mode padded with, for the separation strip. */
  suffixes: { mode: string; suffix: number; rateBytes: number }[]
}

function neighbourOf(s: string): string {
  // A minimal edit to the customization string, so "unrelated output" is shown
  // for a one-character change rather than a wholesale replacement.
  if (s.length === 0) return 'x'
  const last = s[s.length - 1]
  const swapped = last === 'z' ? 'y' : String.fromCharCode(last.charCodeAt(0) + 1)
  return s.slice(0, -1) + swapped
}

export function computeRun(inputs: DemoInputs): RunReport {
  resetPermutationCallCount()
  const message = utf8(inputs.message)

  // --- Stage 1: SHA3-256 --------------------------------------------------
  const sha3Start = permutationCallCount()
  const sha3Trace = traceSha3_256(message)
  const sha3: Sha3Report = {
    trace: sha3Trace,
    digest: sha3Trace.output,
    messageBytes: message,
    permutationCalls: permutationCallCount() - sha3Start,
  }

  // --- Stage 2: SHAKE -----------------------------------------------------
  const shakeStart = permutationCallCount()
  const shakeTrace = traceShake(inputs.shakeStrength, message, inputs.shakeBytes)
  const reference = shake(inputs.shakeStrength, message, PREFIX_PROOF_BYTES)
  const shared = sharedPrefixLength(shakeTrace.output, reference)
  const cont = shakeContinuation(
    inputs.shakeStrength,
    message,
    PREFIX_PROOF_BYTES,
    Math.max(PREFIX_PROOF_BYTES, inputs.shakeBytes - PREFIX_PROOF_BYTES),
  )
  const shakeStage: ShakeReport = {
    strength: inputs.shakeStrength,
    outputBytes: inputs.shakeBytes,
    trace: shakeTrace,
    output: shakeTrace.output,
    reference,
    sharedWithReference: shared,
    prefixHolds: shared >= Math.min(PREFIX_PROOF_BYTES, inputs.shakeBytes),
    continuation: {
      ...cont,
      identical: equalBytes(
        new Uint8Array([...cont.first, ...cont.second]),
        cont.oneShot,
      ),
    },
    permutationCalls: permutationCallCount() - shakeStart,
  }

  // --- Stage 3: cSHAKE ----------------------------------------------------
  const cshakeStart = permutationCallCount()
  const outBytes = 32
  const name = utf8(inputs.cshakeName)
  const custom = utf8(inputs.cshakeCustom)
  const fallbackActive = name.length === 0 && custom.length === 0
  const cshakeTrace = traceCshake(inputs.cshakeStrength, message, outBytes, name, custom)
  const plain = shake(inputs.cshakeStrength, message, outBytes)
  const neighbourCustom = neighbourOf(inputs.cshakeCustom)
  const neighbourOutput = cshake(
    inputs.cshakeStrength,
    message,
    outBytes,
    name,
    utf8(neighbourCustom),
  )
  const cshakeEmpty = cshake(inputs.cshakeStrength, message, outBytes, utf8(''), utf8(''))
  const cshakeStage: CshakeReport = {
    strength: inputs.cshakeStrength,
    name: inputs.cshakeName,
    custom: inputs.cshakeCustom,
    output: cshakeTrace.output,
    plain,
    fallbackActive,
    sharedWithPlain: sharedPrefixLength(cshakeTrace.output, plain),
    fallbackProof: {
      cshakeEmpty,
      plain,
      identical: equalBytes(cshakeEmpty, plain),
    },
    neighbourCustom,
    neighbourOutput,
    sharedWithNeighbour: sharedPrefixLength(cshakeTrace.output, neighbourOutput),
    framedPrefix: fallbackActive
      ? new Uint8Array(0)
      : cshakePrefix(inputs.cshakeStrength, name, custom),
    trace: cshakeTrace,
    permutationCalls: permutationCallCount() - cshakeStart,
  }

  // --- Stage 4: KMAC ------------------------------------------------------
  const kmacStart = permutationCallCount()
  const params: KmacParams = {
    strength: inputs.kmacStrength,
    key: utf8(inputs.kmacKey),
    message: utf8(inputs.kmacMessage),
    outputBits: inputs.kmacOutputBits,
    customization: utf8(inputs.kmacCustom),
    xof: inputs.kmacXof,
  }
  const kmacTrace = traceKmac(params)
  const shortBits = 256
  const longBits = 512
  const shortTag = kmac({ ...params, xof: false, outputBits: shortBits })
  const longTag = kmac({ ...params, xof: false, outputBits: longBits })
  const xofShort = kmac({ ...params, xof: true, outputBits: shortBits })
  const xofLong = kmac({ ...params, xof: true, outputBits: longBits })
  const lengthShared = sharedPrefixLength(shortTag, longTag)
  const xofShared = sharedPrefixLength(xofShort, xofLong)
  const kmacStage: KmacReport = {
    params,
    tag: kmacTrace.output,
    trace: kmacTrace,
    framing: kmacAbsorbedInput(params),
    lengthBinding: {
      shortBits,
      longBits,
      short: shortTag,
      long: longTag,
      sharedBytes: lengthShared,
      isTruncation: lengthShared >= shortTag.length,
    },
    xofBinding: {
      short: xofShort,
      long: xofLong,
      sharedBytes: xofShared,
      isTruncation: xofShared >= xofShort.length,
    },
    permutationCalls: permutationCallCount() - kmacStart,
  }

  return {
    inputs,
    sha3,
    shakeStage,
    cshakeStage,
    kmacStage,
    totalPermutationCalls: permutationCallCount(),
    suffixes: [
      { mode: 'SHA3-256', suffix: sha3Trace.suffix, rateBytes: 136 },
      {
        mode: `SHAKE${inputs.shakeStrength}`,
        suffix: shakeTrace.suffix,
        rateBytes: shakeRate(inputs.shakeStrength),
      },
      {
        mode: `cSHAKE${inputs.cshakeStrength}`,
        suffix: cshakeTrace.suffix,
        rateBytes: shakeRate(inputs.cshakeStrength),
      },
      {
        mode: `KMAC${inputs.kmacStrength}`,
        suffix: kmacTrace.suffix,
        rateBytes: shakeRate(inputs.kmacStrength),
      },
    ],
  }
}

/** The per-stage permutation counts, which must sum to the reported total. */
export function stagePermutationCalls(report: RunReport): number[] {
  return [
    report.sha3.permutationCalls,
    report.shakeStage.permutationCalls,
    report.cshakeStage.permutationCalls,
    report.kmacStage.permutationCalls,
  ]
}
