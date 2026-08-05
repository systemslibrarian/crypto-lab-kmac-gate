/**
 * The sponge construction over Keccak-f[1600].
 *
 * Every mode in this demo is this one class with three knobs:
 *   - the RATE (how many bytes of the 200-byte state the outside world touches),
 *   - the DOMAIN SUFFIX (the padding bits that separate one mode from another),
 *   - how many bytes you squeeze out.
 *
 * The capacity — the 200 − rate bytes at the top of the state — is never
 * written by input and never read as output. That single fact is why a keyed
 * sponge needs no HMAC wrapper: an attacker who holds the whole digest still
 * does not hold the state, so there is nothing to resume from.
 *
 * Squeezing is INCREMENTAL: `squeeze(16)` twice returns exactly the same bytes
 * as `squeeze(32)` once. That is the literal meaning of "longer output is a
 * continuation of the same squeeze, not a rehash", and the demo shows it by
 * doing precisely that rather than asserting it.
 */

import {
  cloneState,
  keccakF1600,
  newState,
  stateToBytes,
  type KeccakState,
} from './keccak-f1600'

/** A snapshot of one permutation call, for the on-screen trace. */
export interface SpongeEvent {
  /** Which phase drove this permutation. */
  kind: 'absorb' | 'pad' | 'squeeze'
  /** 0-based index within that phase. */
  index: number
  /** The rate-sized block XORed in (absorb/pad only). */
  block?: Uint8Array
  /** State after the block was XORed in but before the permutation. */
  stateBefore: KeccakState
  /** State after the permutation. */
  stateAfter: KeccakState
}

export type SpongeObserver = (event: SpongeEvent) => void

/** Keccak sponge with a byte-aligned rate. */
export class Sponge {
  /** Rate in bytes; capacity is 200 − rateBytes. */
  readonly rateBytes: number

  private state: KeccakState = newState()
  private block: Uint8Array
  private blockLen = 0
  private squeezing = false
  private squeezeOffset = 0
  private absorbCount = 0
  private squeezeCount = 0
  private readonly observer?: SpongeObserver

  constructor(rateBytes: number, observer?: SpongeObserver) {
    if (!Number.isInteger(rateBytes) || rateBytes <= 0 || rateBytes >= 200) {
      throw new Error(`rate must be between 1 and 199 bytes, got ${rateBytes}`)
    }
    // Every FIPS 202 / SP 800-185 rate is a whole number of 64-bit lanes
    // (168 = 21 lanes, 136 = 17 lanes). Requiring it keeps the XOR below to a
    // single lane-aligned loop instead of a partial-lane branch no mode here
    // could ever reach.
    if (rateBytes % 8 !== 0) throw new Error(`rate must be a whole number of 64-bit lanes, got ${rateBytes}`)
    this.rateBytes = rateBytes
    this.block = new Uint8Array(rateBytes)
    this.observer = observer
  }

  /** Capacity in bytes — the part of the state the outside never touches. */
  get capacityBytes(): number {
    return 200 - this.rateBytes
  }

  /** Absorb input. May be called repeatedly; blocks are buffered. */
  absorb(data: Uint8Array): this {
    if (this.squeezing) throw new Error('cannot absorb after squeezing has started')
    for (let i = 0; i < data.length; i++) {
      this.block[this.blockLen++] = data[i]
      if (this.blockLen === this.rateBytes) this.permuteBlock('absorb')
    }
    return this
  }

  /**
   * Apply the domain suffix and pad10*1, then permute. After this the sponge
   * is in the squeezing phase and can no longer absorb.
   *
   * `suffix` carries the mode's domain-separation bits already positioned as a
   * byte with the pad's leading 1: 0x06 for SHA-3, 0x1f for SHAKE, 0x04 for
   * cSHAKE (and therefore KMAC).
   */
  finalize(suffix: number): this {
    if (this.squeezing) throw new Error('already finalized')
    this.block[this.blockLen] = suffix
    for (let i = this.blockLen + 1; i < this.rateBytes; i++) this.block[i] = 0
    // pad10*1: the trailing 1 bit lands in the top bit of the last rate byte.
    this.block[this.rateBytes - 1] |= 0x80
    this.blockLen = this.rateBytes
    this.permuteBlock('pad')
    this.squeezing = true
    this.squeezeOffset = 0
    return this
  }

  /**
   * Squeeze `length` bytes. Calling this several times continues the same
   * squeeze; it does not restart anything.
   */
  squeeze(length: number): Uint8Array {
    if (!this.squeezing) throw new Error('finalize() before squeezing')
    if (length < 0) throw new Error('output length must not be negative')
    const out = new Uint8Array(length)
    let produced = 0
    while (produced < length) {
      if (this.squeezeOffset === this.rateBytes) {
        const before = cloneState(this.state)
        keccakF1600(this.state)
        this.squeezeOffset = 0
        this.observer?.({
          kind: 'squeeze',
          index: this.squeezeCount++,
          stateBefore: before,
          stateAfter: cloneState(this.state),
        })
      }
      const available = this.rateBytes - this.squeezeOffset
      const take = Math.min(available, length - produced)
      const rate = stateToBytes(this.state).subarray(this.squeezeOffset, this.squeezeOffset + take)
      out.set(rate, produced)
      produced += take
      this.squeezeOffset += take
    }
    return out
  }

  /** A copy of the current state, for the trace view. */
  snapshot(): KeccakState {
    return cloneState(this.state)
  }

  /** Number of rate-sized blocks absorbed so far (excluding the padding block). */
  get blocksAbsorbed(): number {
    return this.absorbCount
  }

  private permuteBlock(kind: 'absorb' | 'pad'): void {
    const block = this.block.slice()
    // XOR the block into the rate portion of the state, lane by lane.
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength)
    const rateLanes = this.rateBytes / 8
    for (let i = 0; i < rateLanes; i++) {
      this.state[i] ^= view.getBigUint64(i * 8, true)
    }
    const before = cloneState(this.state)
    keccakF1600(this.state)
    this.observer?.({
      kind,
      index: kind === 'absorb' ? this.absorbCount++ : 0,
      block,
      stateBefore: before,
      stateAfter: cloneState(this.state),
    })
    this.block.fill(0)
    this.blockLen = 0
  }
}
