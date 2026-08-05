/**
 * SP 800-185: cSHAKE, KMAC and the four encoding functions they are built from.
 *
 * Nothing new happens to the permutation here. cSHAKE is SHAKE with a framed
 * prefix absorbed first and a different domain suffix; KMAC is cSHAKE with the
 * function name "KMAC", the key framed into that prefix, and the requested
 * output length appended to the message. The security of both rests entirely
 * on the sponge underneath — which is the point.
 */

import { concat, utf8 } from './bytes'
import { SUFFIX, shake, shakeRate, type Strength } from './fips202'
import { Sponge, type SpongeObserver } from './sponge'

/** Bytes of a non-negative integer, big-endian, minimal length (0 → one byte). */
function bigEndianBytes(x: number): Uint8Array {
  if (!Number.isInteger(x) || x < 0) throw new Error('encodings take non-negative integers')
  if (!Number.isSafeInteger(x)) throw new Error('value too large to encode exactly')
  if (x === 0) return Uint8Array.of(0)
  const out: number[] = []
  let v = x
  while (v > 0) {
    out.unshift(v % 256)
    v = Math.floor(v / 256)
  }
  return Uint8Array.from(out)
}

/**
 * `left_encode(x)` — the byte count, then the big-endian bytes.
 * Used where a parser reads forwards (the start of a framed field).
 */
export function leftEncode(x: number): Uint8Array {
  const b = bigEndianBytes(x)
  return concat(Uint8Array.of(b.length), b)
}

/**
 * `right_encode(x)` — the big-endian bytes, then the byte count.
 * Used where a parser reads backwards, e.g. the output length KMAC appends to
 * the end of the message.
 */
export function rightEncode(x: number): Uint8Array {
  const b = bigEndianBytes(x)
  return concat(b, Uint8Array.of(b.length))
}

/**
 * `encode_string(S)` — `left_encode(|S| in BITS) || S`.
 *
 * The length is in bits, not bytes. Framing each string with its own length is
 * what makes the encoding unambiguous: no two different (N, S) pairs can
 * produce the same absorbed bytes, so "domain separation" is a parsing
 * property, not a convention.
 */
export function encodeString(s: Uint8Array): Uint8Array {
  return concat(leftEncode(s.length * 8), s)
}

/**
 * `bytepad(X, w)` — `left_encode(w) || X`, zero-padded up to a multiple of w.
 *
 * Padding the framed prefix out to a whole number of rate blocks means the
 * key/customization prefix and the message can never share a permutation
 * input block, so the message cannot reach into the prefix's framing.
 */
export function bytepad(x: Uint8Array, w: number): Uint8Array {
  if (!Number.isInteger(w) || w <= 0) throw new Error('bytepad width must be a positive integer')
  const prefixed = concat(leftEncode(w), x)
  const padded = new Uint8Array(Math.ceil(prefixed.length / w) * w)
  padded.set(prefixed)
  return padded
}

/**
 * cSHAKE128 / cSHAKE256.
 *
 * With BOTH N and S empty, SP 800-185 §3.3 requires cSHAKE to be *exactly*
 * plain SHAKE — not merely similar. That is a real fallback in the code below,
 * not a special case bolted on: with no framing to absorb there is nothing to
 * separate, and the suffix reverts to SHAKE's 0x1f. The demo shows the
 * byte-level equality this produces.
 */
export function cshake(
  strength: Strength,
  message: Uint8Array,
  outputBytes: number,
  functionName: Uint8Array,
  customization: Uint8Array,
  observer?: SpongeObserver,
): Uint8Array {
  if (functionName.length === 0 && customization.length === 0) {
    return shake(strength, message, outputBytes, observer)
  }
  const rate = shakeRate(strength)
  const sponge = new Sponge(rate, observer)
  sponge.absorb(bytepad(concat(encodeString(functionName), encodeString(customization)), rate))
  sponge.absorb(message)
  sponge.finalize(SUFFIX.cshake)
  return sponge.squeeze(outputBytes)
}

/** The framed prefix cSHAKE absorbs before the message — shown in the UI. */
export function cshakePrefix(
  strength: Strength,
  functionName: Uint8Array,
  customization: Uint8Array,
): Uint8Array {
  const rate = shakeRate(strength)
  return bytepad(concat(encodeString(functionName), encodeString(customization)), rate)
}

/** SP 800-185 fixes the cSHAKE function name for KMAC as the ASCII string "KMAC". */
export const KMAC_FUNCTION_NAME = utf8('KMAC')

export interface KmacParams {
  strength: Strength
  key: Uint8Array
  message: Uint8Array
  /** Requested output length in BITS (`L`). */
  outputBits: number
  customization: Uint8Array
  /**
   * XOF variant. KMAC appends `right_encode(L)`, binding the output to the
   * requested length. KMACXOF appends `right_encode(0)`, which un-binds it so
   * outputs at different lengths are prefixes of one another.
   */
  xof: boolean
}

/**
 * KMAC128 / KMAC256 / KMACXOF128 / KMACXOF256 (SP 800-185 §4).
 *
 * newX = bytepad(encode_string(K), rate) || X || right_encode(L or 0)
 * tag  = cSHAKE(newX, L, "KMAC", S)
 *
 * Note what is NOT here: no inner/outer hash, no ipad/opad, no second pass.
 * HMAC needs that nesting because a Merkle–Damgård digest *is* the compression
 * state, so H(K‖M) can be resumed by anyone holding it. A sponge's digest is a
 * slice of the rate while the capacity stays hidden, so keying it is just
 * absorbing the key first.
 */
export function kmac(params: KmacParams, observer?: SpongeObserver): Uint8Array {
  const { strength, key, message, outputBits, customization, xof } = params
  if (!Number.isInteger(outputBits) || outputBits <= 0) {
    throw new Error('KMAC output length must be a positive whole number of bits')
  }
  if (outputBits % 8 !== 0) {
    throw new Error('this demo only produces whole-byte KMAC outputs')
  }
  const rate = shakeRate(strength)
  const newX = concat(
    bytepad(encodeString(key), rate),
    message,
    rightEncode(xof ? 0 : outputBits),
  )
  return cshake(strength, newX, outputBits / 8, KMAC_FUNCTION_NAME, customization, observer)
}

/** The exact bytes KMAC absorbs, so the UI can show the framing rather than describe it. */
export function kmacAbsorbedInput(params: KmacParams): {
  keyBlock: Uint8Array
  message: Uint8Array
  lengthSuffix: Uint8Array
} {
  const rate = shakeRate(params.strength)
  return {
    keyBlock: bytepad(encodeString(params.key), rate),
    message: params.message,
    lengthSuffix: rightEncode(params.xof ? 0 : params.outputBits),
  }
}
