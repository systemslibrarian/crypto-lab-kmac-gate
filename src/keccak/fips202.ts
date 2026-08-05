/**
 * FIPS 202 modes: SHA3-256 and SHAKE128/256.
 *
 * Both are the same `Sponge`; they differ only in rate and domain suffix.
 *   SHA3-256 : capacity 512 bits → rate 136 bytes, suffix 0x06, fixed 32-byte output
 *   SHAKE128 : capacity 256 bits → rate 168 bytes, suffix 0x1f, arbitrary output
 *   SHAKE256 : capacity 512 bits → rate 136 bytes, suffix 0x1f, arbitrary output
 *
 * The suffix bytes encode the mode's domain-separation bits followed by the
 * leading 1 of pad10*1: SHA-3 appends bits `01`, the XOFs append `1111`.
 */

import { Sponge, type SpongeObserver } from './sponge'

/** Which security strength a mode is parameterised at. */
export type Strength = 128 | 256

/** Domain-separation suffix bytes (mode bits + the pad's leading 1). */
export const SUFFIX = {
  /** SHA-3 fixed-length hashes: bits `01`. */
  sha3: 0x06,
  /** SHAKE / RawSHAKE XOFs: bits `1111`. */
  shake: 0x1f,
  /** cSHAKE (and therefore KMAC): bits `00`. */
  cshake: 0x04,
} as const

/** Rate in bytes for a given capacity in bits. */
export function rateBytesForCapacity(capacityBits: number): number {
  return (1600 - capacityBits) / 8
}

/** SHAKE rate: 168 bytes at 128-bit strength, 136 at 256-bit. */
export function shakeRate(strength: Strength): number {
  return strength === 128 ? 168 : 136
}

/** SHA3-256: 136-byte rate, 512-bit capacity, 32-byte digest. */
export function sha3_256(message: Uint8Array, observer?: SpongeObserver): Uint8Array {
  const sponge = new Sponge(rateBytesForCapacity(512), observer)
  sponge.absorb(message)
  sponge.finalize(SUFFIX.sha3)
  return sponge.squeeze(32)
}

/** SHAKE128 / SHAKE256 with an arbitrary output length in bytes. */
export function shake(
  strength: Strength,
  message: Uint8Array,
  outputBytes: number,
  observer?: SpongeObserver,
): Uint8Array {
  const sponge = new Sponge(shakeRate(strength), observer)
  sponge.absorb(message)
  sponge.finalize(SUFFIX.shake)
  return sponge.squeeze(outputBytes)
}

export const shake128 = (message: Uint8Array, outputBytes: number, observer?: SpongeObserver) =>
  shake(128, message, outputBytes, observer)

export const shake256 = (message: Uint8Array, outputBytes: number, observer?: SpongeObserver) =>
  shake(256, message, outputBytes, observer)

/**
 * Squeeze a SHAKE in two goes and return both halves, to demonstrate that the
 * second call CONTINUES the squeeze rather than rehashing: the concatenation
 * is bit-identical to a single squeeze of the combined length. The demo runs
 * this and compares, instead of telling you it is so.
 */
export function shakeContinuation(
  strength: Strength,
  message: Uint8Array,
  firstBytes: number,
  secondBytes: number,
): { first: Uint8Array; second: Uint8Array; oneShot: Uint8Array } {
  const sponge = new Sponge(shakeRate(strength))
  sponge.absorb(message)
  sponge.finalize(SUFFIX.shake)
  const first = sponge.squeeze(firstBytes)
  const second = sponge.squeeze(secondBytes)
  const oneShot = shake(strength, message, firstBytes + secondBytes)
  return { first, second, oneShot }
}
