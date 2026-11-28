/**
 * The closing contrast: KMAC beside the naive `SHA-256(key ‖ message)` MAC.
 *
 * SCOPE — read this before extending. This module computes the naive MAC for
 * real (WebCrypto SHA-256) and reports the STRUCTURAL difference between the
 * two constructions. It does not implement the length-extension forgery, and
 * it should not: the playable exploit lives in crypto-lab-mac-race and
 * crypto-lab-babel-hash, which this demo links to instead.
 *
 * PRECISION — the weakness in `SHA-256(key ‖ message)` is an APPEND forgery:
 * an attacker holding one valid (message, tag) pair can produce a valid tag for
 * `message ‖ padding ‖ suffix` of their choosing, WITHOUT the key. It is not
 * key recovery. The key stays secret; what fails is the claim that only the
 * key holder can produce a valid tag.
 */

import type { Strength } from '../keccak/fips202'
import { concat, toHex } from '../keccak/bytes'
import { shakeRate } from '../keccak/fips202'

/** Real SHA-256 over `key ‖ message`, via WebCrypto. */
export async function naiveSha256Mac(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const input = concat(key, message)
  const digest = await crypto.subtle.digest('SHA-256', input as unknown as BufferSource)
  return new Uint8Array(digest)
}

export interface ConstructionFacts {
  name: string
  /** Bits of internal state the construction carries between blocks. */
  internalStateBits: number
  /** Bits the tag/digest exposes. */
  digestBits: number
  /**
   * State bits outside the portion directly emitted in a squeeze state.
   * For Merkle–Damgård this is zero: the digest IS the chaining state.
   */
  hiddenStateBits: number
  /** Can a tag holder resume the computation and append to the message? */
  resumableFromDigest: boolean
  note: string
}

/**
 * Facts about `SHA-256(key ‖ message)`.
 *
 * SHA-256 is Merkle–Damgård: the 256-bit chaining value after the final block
 * is emitted verbatim as the digest. So the digest is a complete snapshot of
 * the machine, and anyone holding it can keep going from exactly where the key
 * holder stopped.
 */
export function naiveFacts(): ConstructionFacts {
  return {
    name: 'SHA-256(key ‖ message)',
    internalStateBits: 256,
    digestBits: 256,
    hiddenStateBits: 0,
    resumableFromDigest: true,
    note: 'The digest is the whole chaining state, so a tag holder can append to the message and produce a valid tag for the longer message without ever learning the key.',
  }
}

/**
 * Facts about KMAC at a given strength and output length.
 *
 * Each output block reads from the rate of one state. A permutation separates
 * successive blocks. Capacity is not directly emitted by a squeeze.
 */
export function kmacFacts(strength: Strength, outputBits: number): ConstructionFacts {
  const rateBytes = shakeRate(strength)
  const capacityBits = (200 - rateBytes) * 8
  return {
    name: `KMAC${strength}`,
    internalStateBits: 1600,
    digestBits: outputBits,
    hiddenStateBits: capacityBits,
    resumableFromDigest: false,
    note: `Each squeeze state supplies up to ${rateBytes} output bytes from its rate. Longer tags draw from successive states, with a permutation between blocks. The ${capacityBits}-bit capacity is never output directly. This count describes the state layout. Authentication strength also depends on the key and tag length.`,
  }
}

/** Both sides, computed from the parameters actually in use on the page. */
export function contrast(
  strength: Strength,
  outputBits: number,
): { naive: ConstructionFacts; kmac: ConstructionFacts } {
  return { naive: naiveFacts(), kmac: kmacFacts(strength, outputBits) }
}

/** Format a tag for side-by-side display. */
export function shortHex(bytes: Uint8Array, keep = 16): string {
  const hex = toHex(bytes)
  return hex.length <= keep * 2 ? hex : `${hex.slice(0, keep * 2)}…`
}
