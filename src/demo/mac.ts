/**
 * The KMAC sign/verify layer the "break it yourself" exhibit drives.
 *
 * Everything here goes through the real `kmac()` — verification recomputes the
 * tag from scratch and compares. There is no shortcut path, no stored "is this
 * valid" flag, and no way for the UI to declare a verdict the primitive did not
 * produce.
 */

import { equalBytes, firstDifference, toHex } from '../keccak/bytes'
import { kmac, type KmacParams } from '../keccak/sp800-185'

export interface TagRun {
  /** The parameters the tag was computed under — a tag means nothing without them. */
  params: KmacParams
  tag: Uint8Array
  tagHex: string
}

/** Produce a tag over the given parameters. */
export function signMessage(params: KmacParams): TagRun {
  const tag = kmac(params)
  return { params, tag, tagHex: toHex(tag) }
}

export type RejectionCause =
  | 'message-differs'
  | 'key-differs'
  | 'length-differs'
  | 'customization-differs'
  | 'strength-differs'
  | 'variant-differs'
  | 'tag-differs'

export interface VerifyOutcome {
  accepted: boolean
  /** The tag recomputed by the verifier from the message it was given. */
  recomputed: Uint8Array
  recomputedHex: string
  /** The tag presented for checking. */
  presentedHex: string
  /** Byte index where presented and recomputed first diverge, or -1. */
  divergesAtByte: number
  /**
   * What actually changed between signing and verifying, when we know — the
   * exhibit tracks the original parameters, so it can name the cause instead of
   * guessing. A real verifier holding only (key, message, tag) can NOT do this:
   * it learns only "these bytes did not authenticate", never which part moved.
   */
  cause: RejectionCause | null
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return equalBytes(a, b)
}

/**
 * Verify `presentedTag` against a message under the verifier's own parameters.
 *
 * `signedUnder`, when supplied, is the exhibit's bookkeeping — it lets the page
 * report WHICH input the learner changed. It is never consulted to decide
 * accept/reject; that decision is the byte comparison alone.
 */
export function verifyMessage(
  verifierParams: KmacParams,
  presentedTag: Uint8Array,
  signedUnder?: KmacParams,
): VerifyOutcome {
  const recomputed = kmac(verifierParams)
  const accepted = equalBytes(recomputed, presentedTag)

  let cause: RejectionCause | null = null
  if (!accepted) {
    if (signedUnder) {
      if (!sameBytes(signedUnder.message, verifierParams.message)) cause = 'message-differs'
      else if (!sameBytes(signedUnder.key, verifierParams.key)) cause = 'key-differs'
      else if (signedUnder.outputBits !== verifierParams.outputBits) cause = 'length-differs'
      else if (!sameBytes(signedUnder.customization, verifierParams.customization))
        cause = 'customization-differs'
      else if (signedUnder.strength !== verifierParams.strength) cause = 'strength-differs'
      else if (signedUnder.xof !== verifierParams.xof) cause = 'variant-differs'
      else cause = 'tag-differs'
    } else {
      cause = 'tag-differs'
    }
  }

  return {
    accepted,
    recomputed,
    recomputedHex: toHex(recomputed),
    presentedHex: toHex(presentedTag),
    divergesAtByte: firstDifference(presentedTag, recomputed),
    cause,
  }
}

/** Plain-language description of a rejection cause, for the verdict line. */
export const CAUSE_TEXT: Record<RejectionCause, string> = {
  'message-differs': 'the message bytes changed after the tag was made',
  'key-differs': 'the key changed after the tag was made',
  'length-differs': 'the requested output length changed — KMAC binds L into the tag',
  'customization-differs': 'the customization string S changed',
  'strength-differs': 'the strength changed (KMAC128 vs KMAC256)',
  'variant-differs': 'the variant changed (KMAC vs KMACXOF)',
  'tag-differs': 'the presented tag does not match the one these inputs produce',
}

/**
 * What a KMAC verification actually establishes — and what it does not.
 *
 * Kept next to the verifier so the verdict text on screen cannot drift away
 * from it. Overstating this is the single most common defect in the fleet.
 */
export const VERIFY_LEARNS = [
  'the tag was produced under this exact key, over these exact message bytes, at these exact parameters',
] as const

export const VERIFY_DOES_NOT_LEARN = [
  'who computed it — anyone holding the key could have, including you',
  'when it was computed: KMAC has no timestamp, so a replayed old message and tag verify just fine',
  'that the message is true, authorised, or safe to act on',
  'anything about a message whose tag you have not checked',
] as const
