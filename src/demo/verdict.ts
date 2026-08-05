/**
 * Verdict lifetime for the KMAC exhibit.
 *
 * A verdict here is a claim about a specific set of inputs. The moment any of
 * those inputs changes, the claim stops being about what is on screen, so it
 * must RETIRE — say plainly that it is stale, say which input moved, and name
 * the control that produces a fresh one. It is never silently blanked: an
 * empty panel reads as "nothing happened", which is a different and false
 * message.
 *
 * Staleness is decided by comparing the CURRENT inputs against the inputs the
 * verdict was computed under — not by listening for change events. That
 * distinction matters: re-selecting the same value, or typing a character and
 * deleting it again, fires events but leaves the inputs identical, and must
 * NOT retire a verdict that is still perfectly true.
 */

import { equalBytes } from '../keccak/bytes'
import type { KmacParams } from '../keccak/sp800-185'
import type { VerifyOutcome } from './mac'

export type ParamField = 'key' | 'message' | 'outputBits' | 'customization' | 'strength' | 'variant'

export const FIELD_LABEL: Record<ParamField, string> = {
  key: 'the key',
  message: 'the message',
  outputBits: 'the output length',
  customization: 'the customization string',
  strength: 'the strength',
  variant: 'the variant',
}

/** Which parameter fields differ between two parameter sets. */
export function changedFields(a: KmacParams, b: KmacParams): ParamField[] {
  const changed: ParamField[] = []
  if (!equalBytes(a.key, b.key)) changed.push('key')
  if (!equalBytes(a.message, b.message)) changed.push('message')
  if (a.outputBits !== b.outputBits) changed.push('outputBits')
  if (!equalBytes(a.customization, b.customization)) changed.push('customization')
  if (a.strength !== b.strength) changed.push('strength')
  if (a.xof !== b.xof) changed.push('variant')
  return changed
}

export function paramsEqual(a: KmacParams, b: KmacParams): boolean {
  return changedFields(a, b).length === 0
}

/** A tag, together with the exact parameters it was produced under. */
export interface SignedArtifact {
  params: KmacParams
  tag: Uint8Array
}

/** A verification result, together with the parameters it judged. */
export interface VerdictRecord {
  /** The parameters the verifier used. */
  params: KmacParams
  /** The tag that was presented. */
  presentedTag: Uint8Array
  outcome: VerifyOutcome
}

export interface Staleness {
  stale: boolean
  changed: ParamField[]
  /** Sentence naming what moved and how to get a current verdict. */
  message: string
}

/**
 * Is `record` still a statement about `current`?
 *
 * `controlName` is the button that regenerates the verdict — retiring without
 * naming it leaves the learner stuck.
 */
export function staleness(
  record: VerdictRecord | null,
  current: KmacParams,
  controlName = 'Verify tag',
): Staleness {
  if (!record) return { stale: false, changed: [], message: '' }
  const changed = changedFields(record.params, current)
  if (changed.length === 0) return { stale: false, changed: [], message: '' }
  const names = changed.map((f) => FIELD_LABEL[f])
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return {
    stale: true,
    changed,
    message: `This verdict was computed before ${list} changed, so it no longer describes what is on screen. Press “${controlName}” to check the current inputs.`,
  }
}

/**
 * Does the held tag still correspond to the inputs on screen?
 *
 * Unlike the verdict, a stale tag is not a defect — a tag over the message as
 * it stood when the tag was made is exactly what makes tampering detectable. The UI
 * says so rather than hiding or refreshing it.
 */
export function tagDrift(
  signed: SignedArtifact | null,
  current: KmacParams,
): { drifted: boolean; changed: ParamField[] } {
  if (!signed) return { drifted: false, changed: [] }
  const changed = changedFields(signed.params, current)
  return { drifted: changed.length > 0, changed }
}
