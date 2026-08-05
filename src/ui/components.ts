/**
 * Shared display components: hex views, verdicts, comparisons and the sponge
 * rate/capacity diagram.
 *
 * House rule enforced here: a verdict is icon + word + colour, never colour
 * alone, and a comparison always shows both values plus the computed result of
 * comparing them — never a claim that they match.
 */

import { sharedPrefixLength, toHex } from '../keccak/bytes'
import { el, scrollRegion, svgEl } from './dom'

/** Group hex into byte pairs with spaces every 4 bytes for readability. */
export function groupHex(bytes: Uint8Array, groupBytes = 4): string {
  const hex = toHex(bytes)
  const out: string[] = []
  for (let i = 0; i < hex.length; i += groupBytes * 2) out.push(hex.slice(i, i + groupBytes * 2))
  return out.join(' ')
}

export function hexBox(bytes: Uint8Array, label: string): HTMLElement {
  return scrollRegion(
    label,
    'hexbox',
    el('span', { text: groupHex(bytes) || '(empty)' }),
  )
}

/**
 * A hex view of a block with specific byte offsets marked. Used to make the
 * padding visible: the mode suffix and the pad10*1 final bit are bytes you can
 * point at, not a rule you have to take on faith.
 */
export function markedHexBox(
  bytes: Uint8Array,
  label: string,
  marks: { offset: number; title: string }[],
): HTMLElement {
  const marked = new Map(marks.map((m) => [m.offset, m.title]))
  const parts: (HTMLElement | string)[] = []
  let run = ''
  for (let i = 0; i < bytes.length; i++) {
    const hex = bytes[i].toString(16).padStart(2, '0')
    const mark = marked.get(i)
    if (mark) {
      if (run) {
        parts.push(run)
        run = ''
      }
      parts.push(el('mark', {}, hex, el('span', { class: 'sr-only', text: ` (${mark})` })))
      parts.push(' ')
    } else {
      run += `${hex} `
    }
  }
  if (run) parts.push(run)
  return scrollRegion(label, 'hexbox scroll', ...parts)
}

export type VerdictTone = 'ok' | 'bad' | 'stale' | 'info'

const TONE_ICON: Record<VerdictTone, string> = {
  ok: '✓',
  bad: '✗',
  stale: '⟳',
  info: 'ℹ',
}

const TONE_WORD: Record<VerdictTone, string> = {
  ok: 'Accepted',
  bad: 'Rejected',
  stale: 'Retired',
  info: 'Note',
}

/**
 * Build a verdict block. `title` should already state the outcome in words —
 * the tone word is a fallback for the icon, not the whole message.
 */
export function verdict(
  tone: VerdictTone,
  title: string,
  detail: string | HTMLElement,
): HTMLElement {
  return el(
    'div',
    { class: `verdict verdict-${tone}`, 'data-tone': tone },
    el('span', { class: 'verdict-icon', 'aria-hidden': 'true', text: TONE_ICON[tone] }),
    el(
      'div',
      { class: 'verdict-body' },
      el('p', { class: 'verdict-title' }, el('span', { class: 'sr-only', text: `${TONE_WORD[tone]}: ` }), title),
      typeof detail === 'string' ? el('p', { class: 'verdict-detail', text: detail }) : detail,
    ),
  )
}

/**
 * Compare two byte strings on screen: show both, and show the computed result
 * of comparing them. The "identical / differ" line is derived from the bytes,
 * never asserted alongside them.
 */
export function byteComparison(
  aLabel: string,
  a: Uint8Array,
  bLabel: string,
  b: Uint8Array,
  opts: { equalTitle: string; differTitle: string; note?: string } = {
    equalTitle: 'Identical',
    differTitle: 'Different',
  },
): HTMLElement {
  const shared = sharedPrefixLength(a, b)
  const identical = a.length === b.length && shared === a.length
  const width = Math.min(a.length, b.length)
  return el(
    'div',
    { class: 'compare' },
    el('p', { class: 'out-label', text: aLabel }),
    hexBox(a, aLabel),
    el('p', { class: 'out-label', text: bLabel }),
    hexBox(b, bLabel),
    verdict(
      identical ? 'ok' : 'info',
      identical ? opts.equalTitle : opts.differTitle,
      `${identical ? 'All' : shared} of ${width} leading bytes match` +
        (identical ? '' : ` — they diverge at byte ${shared}`) +
        (opts.note ? `. ${opts.note}` : '.'),
    ),
  )
}

/**
 * The rate/capacity split, drawn to scale.
 *
 * This is the picture the whole demo turns on, so the wording has to be exact.
 * Input is XORed only into the rate and output is read only from the rate —
 * but the capacity does NOT stay inert. The first permutation diffuses the
 * absorbed input across all 25 lanes, capacity included; you can watch those
 * lanes go from zero to non-zero in the trace below.
 *
 * The security property is narrower and stronger than "untouched": the
 * capacity is never EMITTED. That is what makes the state unrecoverable from
 * the output, and it is what defeats length extension.
 *
 * Both regions are labelled in text as well as colour, and the capacity
 * carries a hatch pattern so the split survives greyscale.
 */
export function spongeBar(rateBytes: number, capacityBytes: number, caption: string): HTMLElement {
  const total = rateBytes + capacityBytes
  const width = 600
  const height = 54
  const rateWidth = Math.round((rateBytes / total) * width)
  const titleId = `sponge-title-${rateBytes}-${capacityBytes}`

  const svg = svgEl(
    'svg',
    {
      class: 'sponge-bar',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-labelledby': titleId,
      preserveAspectRatio: 'none',
    },
    svgEl('title', { id: titleId }, `The 200-byte Keccak state: ${rateBytes} bytes of rate that input and output read and write directly, then ${capacityBytes} bytes of capacity that are never written directly and never emitted — though the permutation does diffuse input into them.`),
    svgEl('defs', {},
      svgEl('pattern', { id: `hatch-${rateBytes}`, width: '8', height: '8', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
        svgEl('rect', { width: '8', height: '8', fill: 'var(--inset)' }),
        svgEl('line', { x1: '0', y1: '0', x2: '0', y2: '8', stroke: 'var(--text-muted)', 'stroke-width': '2' }),
      ),
    ),
    svgEl('rect', {
      x: 0, y: 8, width: rateWidth, height: height - 16,
      fill: 'var(--accent)', stroke: 'var(--border)',
    }),
    svgEl('rect', {
      x: rateWidth, y: 8, width: width - rateWidth, height: height - 16,
      fill: `url(#hatch-${rateBytes})`, stroke: 'var(--border)',
    }),
  )

  return el(
    'div',
    {},
    svg,
    el(
      'ul',
      { class: 'sponge-legend' },
      el('li', {},
        el('span', { class: 'swatch swatch-rate', 'aria-hidden': 'true' }),
        `Rate — ${rateBytes} bytes (${rateBytes * 8} bits): the only part input is XORed into, and the only part output is read from`,
      ),
      el('li', {},
        el('span', { class: 'swatch swatch-capacity', 'aria-hidden': 'true' }),
        `Capacity — ${capacityBytes} bytes (${capacityBytes * 8} bits): never written directly and never emitted — but the permutation does mix input into it, so it is not left at zero`,
      ),
    ),
    el('p', { class: 'hint', text: caption }),
  )
}

/**
 * The 5×5 lane grid of a Keccak state, as a real table.
 *
 * Lanes belonging to the rate are marked as such in text (the `scope`d header
 * plus a per-cell label), not by colour alone.
 */
export function laneGrid(
  lanes: string[],
  rateBytes: number,
  caption: string,
  previous?: string[],
): HTMLElement {
  const rateLanes = rateBytes / 8
  const head = el(
    'tr',
    {},
    el('th', { scope: 'col', text: '' }),
    ...[0, 1, 2, 3, 4].map((x) => el('th', { scope: 'col', text: `x=${x}` })),
  )
  const rows = [0, 1, 2, 3, 4].map((y) =>
    el(
      'tr',
      {},
      el('th', { scope: 'row', text: `y=${y}` }),
      ...[0, 1, 2, 3, 4].map((x) => {
        const index = x + 5 * y
        const isRate = index < rateLanes
        const changed = previous ? previous[index] !== lanes[index] : false
        return el(
          'td',
          {
            class: `${isRate ? 'lane-rate' : 'lane-capacity'}${changed ? ' lane-changed' : ''}`,
            'data-lane': String(index),
          },
          el('span', { class: 'sr-only', text: `Lane ${index}, ${isRate ? 'rate' : 'capacity'}: ` }),
          lanes[index],
        )
      }),
    ),
  )
  return scrollRegion(
    caption,
    'lane-scroll',
    el(
      'table',
      { class: 'lane-grid' },
      el('caption', { text: caption }),
      el('thead', {}, head),
      el('tbody', {}, ...rows),
    ),
  )
}
