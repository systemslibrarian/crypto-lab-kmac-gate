import { describe, expect, it } from 'vitest'
import {
  bytesToState,
  deriveRhoOffsets,
  deriveRoundConstants,
  keccakF1600,
  newState,
  permutationCallCount,
  resetPermutationCallCount,
  rotl64,
  stateToBytes,
} from './keccak-f1600'
import { PUBLISHED_RHO_OFFSETS, PUBLISHED_ROUND_CONSTANTS } from './vectors'
import { toHex } from './bytes'

describe('Keccak-f[1600] internals', () => {
  it('derives the FIPS 202 round constants rather than trusting a pasted table', () => {
    const derived = Array.from(deriveRoundConstants())
    expect(derived).toEqual(PUBLISHED_ROUND_CONSTANTS)
  })

  it('derives the FIPS 202 rho offsets', () => {
    expect(deriveRhoOffsets()).toEqual(PUBLISHED_RHO_OFFSETS)
  })

  it('rotates lanes as a 64-bit circular shift', () => {
    expect(rotl64(1n, 1)).toBe(2n)
    expect(rotl64(1n << 63n, 1)).toBe(1n)
    expect(rotl64(0x0123456789abcdefn, 0)).toBe(0x0123456789abcdefn)
    expect(rotl64(0x0123456789abcdefn, 64)).toBe(0x0123456789abcdefn)
    // Rotating by n then by 64-n is the identity.
    for (const n of [1, 7, 28, 43, 62]) {
      expect(rotl64(rotl64(0xdeadbeefcafebaben, n), 64 - n)).toBe(0xdeadbeefcafebaben)
    }
  })

  it('round-trips a state through its little-endian byte layout', () => {
    const bytes = new Uint8Array(200)
    for (let i = 0; i < 200; i++) bytes[i] = (i * 7 + 1) & 0xff
    expect(toHex(stateToBytes(bytesToState(bytes)))).toBe(toHex(bytes))
  })

  it('matches the Keccak-f[1600] all-zero test state', () => {
    // Permuting the all-zero state is the standard smoke test for the round
    // function; the first lane of the result is a well-known value.
    const a = newState()
    keccakF1600(a)
    expect(a[0].toString(16).padStart(16, '0')).toBe('f1258f7940e1dde7')
    expect(a[1].toString(16).padStart(16, '0')).toBe('84d5ccf933c0478a')
    // ...and a second application gives the documented follow-on state.
    keccakF1600(a)
    expect(a[0].toString(16).padStart(16, '0')).toBe('2d5c954df96ecb3c')
  })

  it('is a permutation: distinct inputs give distinct outputs', () => {
    const a = newState()
    const b = newState()
    b[7] = 1n
    keccakF1600(a)
    keccakF1600(b)
    expect(toHex(stateToBytes(a))).not.toBe(toHex(stateToBytes(b)))
  })

  it('counts every invocation on one shared counter', () => {
    resetPermutationCallCount()
    expect(permutationCallCount()).toBe(0)
    const a = newState()
    keccakF1600(a)
    keccakF1600(a)
    expect(permutationCallCount()).toBe(2)
  })
})
