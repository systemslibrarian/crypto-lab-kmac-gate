/**
 * Keccak-f[1600] — THE permutation.
 *
 * This file holds the *only* implementation of the round function in this
 * repo. SHA3-256, SHAKE128/256, cSHAKE128/256 and KMAC128/256 all reach the
 * browser through `keccakF1600` below; none of them owns a copy. That is the
 * headline claim of the demo ("one sponge, four modes"), so it is enforced by
 * a test (`architecture.test.ts`) rather than left as a comment.
 *
 * Spec: FIPS 202, §3.2 (step mappings θ, ρ, π, χ, ι) and Algorithm 5 (rc).
 *
 * Style choice: the ρ offsets and the ι round constants are DERIVED from their
 * spec definitions rather than pasted in as magic tables, so a reader can check
 * them against FIPS 202 line by line. `keccak-f1600.test.ts` then asserts the
 * derived tables equal the published ones — the derivation is checked, not
 * trusted.
 *
 * NOT constant-time, NOT side-channel hardened, NOT production code. BigInt
 * arithmetic in a JIT-compiled runtime makes no timing promises at all. This is
 * a teaching implementation whose priority is that you can read it.
 */

/** Number of lanes in the state: a 5×5 grid of 64-bit lanes = 1600 bits. */
export const LANES = 25

/** Rounds in Keccak-f[1600]: 12 + 2ℓ with ℓ = 6. */
export const ROUNDS = 24

const MASK64 = (1n << 64n) - 1n

/** A Keccak state: 25 lanes of 64 bits, indexed `x + 5y`. */
export type KeccakState = BigUint64Array

/** Allocate a zeroed state. */
export function newState(): KeccakState {
  return new BigUint64Array(LANES)
}

/** Rotate a 64-bit lane left by `n` bits. */
export function rotl64(x: bigint, n: number): bigint {
  const s = BigInt(n % 64)
  if (s === 0n) return x & MASK64
  return ((x << s) | ((x & MASK64) >> (64n - s))) & MASK64
}

/**
 * FIPS 202 Algorithm 5 — the 8-bit LFSR that generates the ι round constants.
 *
 * The spec writes R as an MSB-first bit string; here it is an integer whose
 * bit 7 is R[0]. Prepending a zero bit and truncating back to 8 bits then
 * reduces to a right shift, with the feedback taps (R[0], R[4], R[5], R[6])
 * collapsing into the constant 0x8e.
 */
export function rc(t: number): number {
  const n = ((t % 255) + 255) % 255
  if (n === 0) return 1
  let v = 0x80
  for (let i = 1; i <= n; i++) {
    const lsb = v & 1
    v = (v >> 1) ^ (lsb ? 0x8e : 0)
  }
  return (v >> 7) & 1
}

/**
 * ι round constants, derived per FIPS 202 §3.2.5: bit `2^j − 1` of RC[ir] is
 * `rc(j + 7·ir)`, for j = 0…ℓ (ℓ = 6).
 */
export function deriveRoundConstants(): BigUint64Array {
  const out = new BigUint64Array(ROUNDS)
  for (let ir = 0; ir < ROUNDS; ir++) {
    let lane = 0n
    for (let j = 0; j <= 6; j++) {
      if (rc(j + 7 * ir) === 1) lane |= 1n << BigInt((1 << j) - 1)
    }
    out[ir] = lane
  }
  return out
}

/**
 * ρ rotation offsets, derived per FIPS 202 §3.2.2: start at (x, y) = (1, 0)
 * and walk (x, y) ← (y, (2x + 3y) mod 5) for t = 0…23, taking the offset
 * (t + 1)(t + 2)/2 mod 64 at each step. Lane (0,0) is never rotated.
 */
export function deriveRhoOffsets(): number[] {
  const offsets = new Array<number>(LANES).fill(0)
  let x = 1
  let y = 0
  for (let t = 0; t < 24; t++) {
    offsets[x + 5 * y] = (((t + 1) * (t + 2)) / 2) % 64
    const nx = y
    const ny = (2 * x + 3 * y) % 5
    x = nx
    y = ny
  }
  return offsets
}

const RC = deriveRoundConstants()
const RHO = deriveRhoOffsets()

/**
 * How many times `keccakF1600` has been called since the last reset.
 *
 * The UI reports this so the "one shared permutation" claim is visible as a
 * live number rather than a promise: every mode you run on the page moves this
 * same counter.
 */
let permutationCalls = 0

/** Total permutation invocations since the last `resetPermutationCallCount()`. */
export function permutationCallCount(): number {
  return permutationCalls
}

/** Reset the shared permutation counter (the UI does this per run). */
export function resetPermutationCallCount(): void {
  permutationCalls = 0
}

/**
 * One Keccak round: θ, ρ, π, χ, ι applied in order, in place.
 *
 * Exported so tests (and curious readers) can step a single round.
 */
export function keccakRound(a: KeccakState, roundConstant: bigint): void {
  // θ — parity of each column, folded back across the state.
  const c = new BigUint64Array(5)
  for (let x = 0; x < 5; x++) {
    c[x] = a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20]
  }
  const d = new BigUint64Array(5)
  for (let x = 0; x < 5; x++) {
    d[x] = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1)
  }
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) a[x + 5 * y] ^= d[x]
  }

  // ρ (rotate each lane) and π (move it) done together into a scratch state.
  // π sends source (x, y) to destination (y, (2x + 3y) mod 5).
  const b = new BigUint64Array(LANES)
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const dest = y + 5 * ((2 * x + 3 * y) % 5)
      b[dest] = rotl64(a[x + 5 * y], RHO[x + 5 * y])
    }
  }

  // χ — the only non-linear step, applied along rows.
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      a[x + 5 * y] = b[x + 5 * y] ^ (~b[((x + 1) % 5) + 5 * y] & MASK64 & b[((x + 2) % 5) + 5 * y])
    }
  }

  // ι — break the round symmetry.
  a[0] ^= roundConstant
}

/**
 * Keccak-f[1600]: 24 rounds, in place. Every mode in this demo funnels here.
 */
export function keccakF1600(a: KeccakState): void {
  permutationCalls++
  for (let ir = 0; ir < ROUNDS; ir++) keccakRound(a, RC[ir])
}

/** Copy a state (for trace snapshots). */
export function cloneState(a: KeccakState): KeccakState {
  return new BigUint64Array(a)
}

/** Serialise a state to its 200-byte little-endian lane layout. */
export function stateToBytes(a: KeccakState): Uint8Array {
  const out = new Uint8Array(200)
  const view = new DataView(out.buffer)
  for (let i = 0; i < LANES; i++) view.setBigUint64(i * 8, a[i], true)
  return out
}

/** Load a 200-byte little-endian buffer into a state. */
export function bytesToState(bytes: Uint8Array): KeccakState {
  if (bytes.length !== 200) throw new Error('a Keccak-f[1600] state is exactly 200 bytes')
  const out = newState()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = 0; i < LANES; i++) out[i] = view.getBigUint64(i * 8, true)
  return out
}
