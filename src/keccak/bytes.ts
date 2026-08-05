/**
 * Byte helpers shared by every mode in this demo.
 *
 * Nothing here is cryptographic — it is encoding plumbing kept in one place so
 * the primitive files stay readable.
 */

/** UTF-8 encode a string. */
export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

/** Lowercase hex of a byte string. */
export function toHex(b: Uint8Array): string {
  let out = ''
  for (const x of b) out += x.toString(16).padStart(2, '0')
  return out
}

/** Parse lowercase/uppercase hex (whitespace tolerated) into bytes. */
export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '')
  if (clean.length % 2 !== 0) throw new Error('hex string must have an even number of digits')
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('hex string contains a non-hex digit')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Concatenate byte strings. */
export function concat(...parts: Uint8Array[]): Uint8Array {
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

/**
 * Branch-free byte-string equality, written in the shape a real MAC verifier
 * uses: accumulate the XOR of every byte pair and test the accumulator once,
 * so the loop does not return early on the first mismatching byte.
 *
 * HONESTY NOTE: this is the correct *shape*, not a constant-time guarantee.
 * JavaScript engines are free to optimise, and a JIT, the GC, or the array
 * bounds checks can all reintroduce data-dependent timing. A production
 * verifier belongs in a language where you can pin that down. This demo never
 * claims a timing property; it claims only that the comparison is total.
 */
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** Index of the first differing byte, or -1 when the strings are equal. */
export function firstDifference(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}

/** How many of the leading bytes two strings share. */
export function sharedPrefixLength(a: Uint8Array, b: Uint8Array): number {
  const d = firstDifference(a, b)
  return d === -1 ? a.length : d
}
