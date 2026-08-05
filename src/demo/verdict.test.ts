import { describe, expect, it } from 'vitest'
import { utf8 } from '../keccak/bytes'
import type { KmacParams } from '../keccak/sp800-185'
import { computeTag, verifyMessage } from './mac'
import { changedFields, paramsEqual, staleness, tagDrift, type VerdictRecord } from './verdict'

const params = (over: Partial<KmacParams> = {}): KmacParams => ({
  strength: 128,
  key: utf8('shared-key-2026'),
  message: utf8('transfer 100 to alice'),
  outputBits: 256,
  customization: utf8(''),
  xof: false,
  ...over,
})

const record = (p: KmacParams): VerdictRecord => {
  const { tag } = computeTag(p)
  return { params: p, presentedTag: tag, outcome: verifyMessage(p, tag, p) }
}

describe('changedFields', () => {
  it('finds nothing between equal parameter sets built separately', () => {
    expect(changedFields(params(), params())).toEqual([])
    expect(paramsEqual(params(), params())).toBe(true)
  })

  it('compares key and message BY VALUE, not by reference', () => {
    // Two distinct Uint8Arrays holding the same bytes are the same key.
    const a = params({ key: utf8('k') })
    const b = params({ key: utf8('k') })
    expect(a.key).not.toBe(b.key)
    expect(paramsEqual(a, b)).toBe(true)
  })

  it('names each field that moved', () => {
    expect(changedFields(params(), params({ message: utf8('other') }))).toEqual(['message'])
    expect(changedFields(params(), params({ key: utf8('other') }))).toEqual(['key'])
    expect(changedFields(params(), params({ outputBits: 512 }))).toEqual(['outputBits'])
    expect(changedFields(params(), params({ customization: utf8('c') }))).toEqual(['customization'])
    expect(changedFields(params(), params({ strength: 256 }))).toEqual(['strength'])
    expect(changedFields(params(), params({ xof: true }))).toEqual(['variant'])
  })

  it('reports several at once', () => {
    expect(changedFields(params(), params({ message: utf8('m'), strength: 256 }))).toEqual([
      'message',
      'strength',
    ])
  })
})

describe('verdict retirement', () => {
  it('a verdict about the current inputs is not stale', () => {
    const p = params()
    expect(staleness(record(p), p).stale).toBe(false)
  })

  it('retires when the message changes, and names the message', () => {
    const p = params()
    const s = staleness(record(p), params({ message: utf8('tampered') }))
    expect(s.stale).toBe(true)
    expect(s.changed).toEqual(['message'])
    expect(s.message).toMatch(/the message/)
  })

  it('the retirement notice names the control that regenerates it', () => {
    const s = staleness(record(params()), params({ key: utf8('other') }))
    expect(s.message).toMatch(/Verify tag/)
    expect(s.message).not.toBe('')
  })

  it('lists several changed inputs in one sentence', () => {
    const s = staleness(record(params()), params({ message: utf8('m'), outputBits: 512 }))
    expect(s.message).toMatch(/the message and the output length/)
  })

  // --- the no-op guard ----------------------------------------------------

  it('re-selecting the SAME value does not retire a fresh verdict', () => {
    const p = params()
    const held = record(p)
    // A change event fires, but the value is identical — rebuild the params
    // exactly as the UI would after that event.
    const afterNoOpSelect = params({ strength: 128 })
    expect(staleness(held, afterNoOpSelect).stale).toBe(false)
  })

  it('typing a character and deleting it again does not retire', () => {
    const p = params()
    const held = record(p)
    const afterRoundTrip = params({ message: utf8('transfer 100 to alice') })
    expect(staleness(held, afterRoundTrip).stale).toBe(false)
  })

  it('with no verdict held there is nothing to retire', () => {
    const s = staleness(null, params())
    expect(s.stale).toBe(false)
    expect(s.message).toBe('')
  })
})

describe('tag drift', () => {
  it('a tag over the current message has not drifted', () => {
    const p = params()
    expect(tagDrift({ params: p, tag: computeTag(p).tag }, p).drifted).toBe(false)
  })

  it('after tampering the tag is flagged as covering different bytes', () => {
    const p = params()
    const signed = { params: p, tag: computeTag(p).tag }
    const drift = tagDrift(signed, params({ message: utf8('transfer 900 to mallory') }))
    expect(drift.drifted).toBe(true)
    expect(drift.changed).toEqual(['message'])
  })

  it('a drifted tag is still a real tag — it is kept, not discarded', () => {
    // The tamper exhibit depends on this: the old tag must survive the edit,
    // because verifying it against the new message is the whole lesson.
    const p = params()
    const signed = { params: p, tag: computeTag(p).tag }
    const tampered = params({ message: utf8('transfer 900 to mallory') })
    expect(tagDrift(signed, tampered).drifted).toBe(true)
    const outcome = verifyMessage(tampered, signed.tag, signed.params)
    expect(outcome.accepted).toBe(false)
    expect(outcome.cause).toBe('message-differs')
  })
})
