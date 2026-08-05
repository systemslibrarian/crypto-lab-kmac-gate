/**
 * Turning a sponge run into something you can step through on screen.
 *
 * The trace is not a re-enactment: it is collected from the real run by the
 * sponge's observer hook, so every state shown is the state that actually
 * produced the digest below it.
 */

import { toHex } from '../keccak/bytes'
import { sha3_256, shake, shakeRate, type Strength } from '../keccak/fips202'
import { permutationCallCount, stateToBytes, type KeccakState } from '../keccak/keccak-f1600'
import type { SpongeEvent } from '../keccak/sponge'
import { cshake, kmac, type KmacParams } from '../keccak/sp800-185'

export interface TraceStep {
  kind: SpongeEvent['kind']
  /** Human label, e.g. "Absorb block 2" or "Pad + absorb final block". */
  label: string
  /** The rate-sized block XORed in, if this step absorbed one. */
  block?: Uint8Array
  /** Structural offset of the domain suffix in `block` (padding step only). */
  suffixOffset?: number
  /** Structural offset of the pad10*1 final bit (padding step only). */
  padBitOffset?: number
  /** The 25 lanes after the permutation, as 16-hex-digit strings. */
  lanesAfter: string[]
  /** The 25 lanes before the permutation (after the XOR), for comparison. */
  lanesBefore: string[]
}

export interface TraceResult {
  steps: TraceStep[]
  output: Uint8Array
  rateBytes: number
  capacityBytes: number
  /** Permutation calls this run made — read off the ONE shared counter. */
  permutationCalls: number
  /** Domain suffix byte this mode padded with. */
  suffix: number
}

function lanes(state: KeccakState): string[] {
  return Array.from(state, (lane) => lane.toString(16).padStart(16, '0'))
}

function label(event: SpongeEvent): string {
  if (event.kind === 'absorb') return `Absorb block ${event.index + 1}`
  if (event.kind === 'pad') return 'Pad + absorb final block'
  return `Squeeze block ${event.index + 2}`
}

/** Run `fn` with a collecting observer and package the result. */
function collect(
  rateBytes: number,
  suffix: number,
  fn: (observe: (e: SpongeEvent) => void) => Uint8Array,
): TraceResult {
  const steps: TraceStep[] = []
  // Measure this run as a DELTA on the one shared counter rather than
  // resetting it, so several traced runs can be added up on the page and the
  // parts genuinely sum to the whole.
  const before = permutationCallCount()
  const output = fn((event) => {
    steps.push({
      kind: event.kind,
      label: label(event),
      block: event.block,
      suffixOffset: event.suffixOffset,
      padBitOffset: event.padBitOffset,
      lanesBefore: lanes(event.stateBefore),
      lanesAfter: lanes(event.stateAfter),
    })
  })
  return {
    steps,
    output,
    rateBytes,
    capacityBytes: 200 - rateBytes,
    permutationCalls: permutationCallCount() - before,
    suffix,
  }
}

export function traceSha3_256(message: Uint8Array): TraceResult {
  return collect(136, 0x06, (observe) => sha3_256(message, observe))
}

export function traceShake(
  strength: Strength,
  message: Uint8Array,
  outputBytes: number,
): TraceResult {
  return collect(shakeRate(strength), 0x1f, (observe) =>
    shake(strength, message, outputBytes, observe),
  )
}

export function traceCshake(
  strength: Strength,
  message: Uint8Array,
  outputBytes: number,
  functionName: Uint8Array,
  customization: Uint8Array,
): TraceResult {
  const empty = functionName.length === 0 && customization.length === 0
  return collect(shakeRate(strength), empty ? 0x1f : 0x04, (observe) =>
    cshake(strength, message, outputBytes, functionName, customization, observe),
  )
}

export function traceKmac(params: KmacParams): TraceResult {
  return collect(shakeRate(params.strength), 0x04, (observe) => kmac(params, observe))
}

/** The rate bytes of a state — what the squeeze can reach. */
export function rateSlice(state: KeccakState, rateBytes: number): string {
  return toHex(stateToBytes(state).subarray(0, rateBytes))
}
