/**
 * The page's panels.
 *
 * Each render function takes the single `RunReport` for this render and
 * returns DOM. They hold no state of their own beyond view-only concerns (like
 * which trace step is showing), so nothing on screen can disagree with
 * anything else on screen.
 */

import { toHex, utf8 } from '../keccak/bytes'
import type { RunReport } from '../demo/run'
import { stageCosts } from '../demo/run'
import {
  STEP_KEYS,
  STEP_LABEL,
  changedSteps,
  pipelineStages,
  type PipelineStage,
  type StepKey,
} from '../demo/pipeline'
import { VERIFY_DOES_NOT_LEARN, VERIFY_LEARNS } from '../demo/mac'
import type { TraceResult } from '../demo/trace'
import { byteComparison, hexBox, laneGrid, markedHexBox, spongeBar } from './components'
import { el, scrollRegion } from './dom'


/**
 * The shared-core panel: one pipeline, four modes, and an honest cost.
 *
 * The table below IS the demo's thesis. Rows are the six pipeline steps every
 * mode goes through; columns are the four modes. The `Keccak-f[1600]` row is
 * identical across all four columns, and it is identical because the code has
 * only one such function — not because this table was written that way.
 */
export function renderCorePanel(report: RunReport): HTMLElement {
  const stages = pipelineStages(report)
  const costs = stageCosts(report)
  const operationTotal = costs.reduce((a, c) => a + c.operation, 0)
  const proofTotal = costs.reduce((a, c) => a + c.proof, 0)

  const table = el(
    'table',
    { class: 'facts pipeline-table', id: 'pipeline-table' },
    el('caption', {
      text: 'The same six steps every time. Only the shaded cells differ from the mode to their left; the Keccak-f[1600] row never differs at all.',
    }),
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        el('th', { scope: 'col', text: 'Pipeline step' }),
        ...stages.map((st) => el('th', { scope: 'col', text: st.mode })),
      ),
    ),
    el(
      'tbody',
      {},
      ...STEP_KEYS.map((key) =>
        el(
          'tr',
          { 'data-step': key },
          el('th', { scope: 'row', text: STEP_LABEL[key] }),
          ...stages.map((st, i) => {
            const changed = changedSteps(stages, i).includes(key)
            return el(
              'td',
              {
                class: changed ? 'cell-changed' : undefined,
                'data-changed': String(changed),
                // The raw value, free of the screen-reader prefix below, so a
                // comparison of cells reads the value and not the annotation.
                'data-value': st.values[key],
              },
              changed
                ? el('span', { class: 'sr-only', text: 'Changed from the previous mode: ' })
                : null,
              st.values[key],
            )
          }),
        ),
      ),
    ),
  )

  return el(
    'section',
    { class: 'panel', 'aria-labelledby': 'core-h' },
    el(
      'div',
      { class: 'panel-head' },
      el('span', { class: 'stage-num', text: 'THE CORE' }),
      el('h2', { id: 'core-h', text: 'One pipeline, four modes' }),
    ),
    el('p', { class: 'lede' },
      'These are four separate runs, not one running machine: each mode starts from a fresh all-zero 200-byte state. What they share is the construction and the code — every one of them reaches the same ',
      el('code', { text: 'keccakF1600' }),
      ' function through the same sponge.',
    ),
    scrollRegion('The four modes as one pipeline', 'facts-scroll', table),
    el(
      'ul',
      { class: 'kv', id: 'perm-breakdown', role: 'list' },
      ...costs.map((c) =>
        el(
          'li',
          { role: 'listitem', 'data-stage': c.label },
          `One ${c.label}: `,
          el('b', { text: String(c.operation) }),
          ' permutation calls',
        ),
      ),
    ),
    el('p', {
      class: 'hint',
      id: 'perm-sum-check',
      text:
        `Those four operations cost ${operationTotal} permutation calls between them. This page also ran ` +
        `${proofTotal} more to compute the side-by-side comparisons below — ${operationTotal} + ${proofTotal} = ` +
        `${report.totalPermutationCalls} calls this render, every one of them through that single function.`,
    }),
    el('p', { class: 'hint', id: 'perm-total-note' },
      'Total this render: ',
      el('b', { id: 'perm-total', text: String(report.totalPermutationCalls) }),
      ' — if any mode had its own copy of the permutation, it would contribute nothing to this number.',
    ),
  )
}

/**
 * The persistent spine, repeated at the top of every stage.
 *
 * Same six steps, same order, every stage — so the learner reads one machine
 * being re-parameterised rather than four unrelated exhibits. The steps that
 * changed since the previous stage are marked in text as well as colour.
 */
export function renderSpine(stages: PipelineStage[], index: number): HTMLElement {
  const changed = new Set<StepKey>(changedSteps(stages, index))
  const stage = stages[index]
  return el(
    'div',
    { class: 'spine', 'data-stage': stage.key },
    el('p', { class: 'out-label', text: `The pipeline, as ${stage.mode} parameterises it` }),
    el(
      'ol',
      { class: 'spine-steps', 'aria-label': `${stage.mode} pipeline steps` },
      ...STEP_KEYS.map((key) =>
        el(
          'li',
          {
            class: `spine-step${changed.has(key) ? ' spine-changed' : ''}${key === 'permutation' ? ' spine-shared' : ''}`,
            'data-step': key,
            'data-changed': String(changed.has(key)),
          },
          el('span', { class: 'spine-label', text: STEP_LABEL[key] }),
          el('span', { class: 'spine-value', text: stage.values[key] }),
          key === 'permutation'
            ? el('span', {
                class: 'spine-count',
                text: `called ${stage.permutationCalls}× for this run`,
              })
            : null,
          changed.has(key)
            ? el('span', { class: 'spine-tag', text: 'changed from the previous stage' })
            : key === 'permutation'
              ? el('span', { class: 'spine-tag spine-tag-shared', text: 'identical in all four stages' })
              : null,
        ),
      ),
    ),
  )
}

/** A stepper-driven view of one traced sponge run. */
export function renderTrace(
  trace: TraceResult,
  stepIndex: number,
  idPrefix: string,
): HTMLElement {
  const clamped = Math.min(Math.max(stepIndex, 0), trace.steps.length - 1)
  const step = trace.steps[clamped]
  const previous = clamped > 0 ? trace.steps[clamped - 1].lanesAfter : undefined

  // Mark the padding bytes from the offsets the sponge RECORDED, never by
  // searching the block for a byte matching the suffix value: a message
  // containing that byte as data would otherwise get one of its own bytes
  // highlighted as the domain suffix.
  const marks: { offset: number; title: string }[] = []
  if (step.block && step.kind === 'pad' && step.suffixOffset !== undefined) {
    const padBit = step.padBitOffset ?? step.block.length - 1
    if (step.suffixOffset === padBit) {
      // The message filled the block to one byte short of the rate, so the
      // suffix and the pad's final bit share a byte.
      marks.push({ offset: padBit, title: 'domain suffix and the pad10*1 final bit, in the same byte' })
    } else {
      marks.push({ offset: step.suffixOffset, title: 'domain suffix + start of pad10*1' })
      marks.push({ offset: padBit, title: 'final pad bit, 0x80' })
    }
  }

  return el(
    'div',
    { class: 'trace', id: `${idPrefix}-trace` },
    el(
      'ol',
      { class: 'steps', 'aria-label': 'Permutation steps in this run' },
      ...trace.steps.map((s, i) =>
        el('li', { 'data-current': String(i === clamped), text: s.label }),
      ),
    ),
    el('p', { class: 'out-label', text: `Step ${clamped + 1} of ${trace.steps.length} — ${step.label}` }),
    step.block
      ? marks.length > 0
        ? markedHexBox(step.block, 'Block absorbed at this step, with the padding bytes marked', marks)
        : hexBox(step.block, 'Block absorbed at this step')
      : el('p', { class: 'hint', text: 'No new input: this step only permutes the state to produce more output.' }),
    laneGrid(
      step.lanesAfter,
      trace.rateBytes,
      `Keccak state after step ${clamped + 1}: 25 lanes of 64 bits, underlined where this step changed them`,
      previous,
    ),
  )
}

/** Stage 1 — SHA3-256. */
export function renderSha3Output(report: RunReport, stepIndex: number): HTMLElement {
  const { sha3 } = report
  return el(
    'div',
    {},
    spongeBar(
      sha3.trace.rateBytes,
      sha3.trace.capacityBytes,
      `SHA3-256 splits the 1600-bit state into a ${sha3.trace.rateBytes * 8}-bit rate and a ${sha3.trace.capacityBytes * 8}-bit capacity. The 256-bit digest is the first 32 bytes of the rate once absorbing finishes. Step through the trace and watch the capacity lanes go from zero to non-zero: the permutation mixes your message into them, even though nothing writes to them directly and none of them is ever output.`,
    ),
    el(
      'ul',
      { class: 'kv', role: 'list' },
      el('li', { role: 'listitem' }, 'Message: ', el('b', { id: 'sha3-msg-len', text: `${sha3.messageBytes.length} bytes` })),
      el('li', { role: 'listitem' }, 'Blocks: ', el('b', { id: 'sha3-blocks', text: String(sha3.trace.steps.length) })),
      el('li', { role: 'listitem' }, 'This digest cost: ', el('b', { id: 'sha3-perms', text: String(sha3.operationCalls) }), ' permutation calls'),
    ),
    el('p', { class: 'out-label', text: 'SHA3-256 digest' }),
    el('div', { id: 'sha3-digest', 'data-hex': toHex(sha3.digest) }, hexBox(sha3.digest, 'SHA3-256 digest')),
    renderTrace(sha3.trace, stepIndex, 'sha3'),
  )
}

/** Stage 2 — SHAKE. */
export function renderShakeOutput(report: RunReport): HTMLElement {
  const s = report.shakeStage
  const compared = Math.min(16, s.outputBytes)
  return el(
    'div',
    {},
    spongeBar(
      s.trace.rateBytes,
      s.trace.capacityBytes,
      `SHAKE${s.strength} reads output from the ${s.trace.rateBytes * 8}-bit rate and keeps its ${s.trace.capacityBytes * 8}-bit capacity out of the output entirely. When you ask for more than the rate holds, it permutes again and keeps reading.`,
    ),
    el(
      'ul',
      { class: 'kv', role: 'list' },
      el('li', { role: 'listitem' }, 'Requested: ', el('b', { id: 'shake-len', text: `${s.outputBytes} bytes` })),
      el('li', { role: 'listitem' }, 'Squeeze permutations: ', el('b', { id: 'shake-squeezes', text: String(s.trace.steps.filter((x) => x.kind === 'squeeze').length) })),
      el('li', { role: 'listitem' }, 'This output cost: ', el('b', { id: 'shake-perms', text: String(s.operationCalls) }), ' permutation calls'),
    ),
    el('p', { class: 'out-label', text: `SHAKE${s.strength} output (${s.outputBytes} bytes)` }),
    el('div', { id: 'shake-output', 'data-hex': toHex(s.output) }, hexBox(s.output, `SHAKE${s.strength} output`)),
    el(
      'div',
      { class: 'compare', id: 'shake-prefix-proof' },
      el('h4', { text: 'Is a longer output a continuation, or a different hash?' }),
      el('p', {
        text: `Squeezing ${compared} bytes on its own, and taking the first ${compared} bytes of the ${s.outputBytes}-byte output above, are two separate runs of the primitive. Here is what each produced:`,
      }),
      byteComparison(
        `First ${compared} bytes of the ${s.outputBytes}-byte output`,
        s.output.subarray(0, compared),
        `A separate ${compared}-byte squeeze of the same message`,
        s.reference.subarray(0, compared),
        {
          equalTitle: 'Same bytes — the longer output continues the same squeeze',
          differTitle: 'Different bytes — this would mean the XOF rehashed',
          note: 'Asking for more output never changes what you already had',
        },
      ),
      el('p', {
        class: 'hint',
        id: 'shake-continuation',
        text: `Splitting the squeeze in two also matches: ${s.continuation.first.length} bytes then ${s.continuation.second.length} bytes concatenated is ${s.continuation.identical ? 'byte-for-byte identical to' : 'NOT identical to'} one ${s.continuation.oneShot.length}-byte squeeze.`,
      }),
    ),
  )
}

/** Stage 3 — cSHAKE. */
export function renderCshakeOutput(report: RunReport): HTMLElement {
  const c = report.cshakeStage
  const fallbackNote = c.fallbackActive
    ? 'N and S are both empty right now, so by SP 800-185 §3.3 this IS plain SHAKE — the two outputs below are the same bytes.'
    : 'With a customization string set, this run produced a different output from plain SHAKE of the same message.'

  return el(
    'div',
    {},
    el(
      'ul',
      { class: 'kv', role: 'list' },
      el('li', { role: 'listitem' }, 'Function name N: ', el('b', { id: 'cshake-n', text: c.name === '' ? '(empty)' : c.name })),
      el('li', { role: 'listitem' }, 'Customization S: ', el('b', { id: 'cshake-s', text: c.custom === '' ? '(empty)' : c.custom })),
      el('li', { role: 'listitem' }, 'Framed prefix: ', el('b', { id: 'cshake-prefix-len', text: `${c.framedPrefix.length} bytes` })),
      el('li', { role: 'listitem' }, 'This output cost: ', el('b', { id: 'cshake-perms', text: String(c.operationCalls) }), ' permutation calls'),
    ),
    renderCshakeRoutes(report),
    el('p', { class: 'out-label', text: `cSHAKE${c.strength} output` }),
    el('div', { id: 'cshake-output', 'data-hex': toHex(c.output) }, hexBox(c.output, `cSHAKE${c.strength} output`)),
    el('p', { class: 'hint', id: 'cshake-fallback-note', text: fallbackNote }),

    el(
      'div',
      { class: 'compare', id: 'cshake-divergence' },
      el('h4', { text: 'What one character of S does' }),
      el('p', {
        text: `The same message and the same function name, with S changed from “${c.custom || '(empty)'}” to “${c.neighbourCustom}”:`,
      }),
      byteComparison(
        `S = “${c.custom || '(empty)'}”`,
        c.output,
        `S = “${c.neighbourCustom}”`,
        c.neighbourOutput,
        {
          equalTitle: 'Identical — domain separation did nothing',
          differTitle: 'Different output in this run, from a one-character change',
          note: 'What one run shows is that these two outputs differ. The design claim is separate and stronger: cSHAKE frames N and S unambiguously, so each customization string defines its own function under the security argument of SP 800-185',
        },
      ),
    ),

    el(
      'details',
      { id: 'cshake-fallback-proof' },
      el('summary', { text: 'Proof of the empty-N, empty-S fallback' }),
      el('p', {
        text: 'SP 800-185 requires that cSHAKE with no function name and no customization string be exactly SHAKE — not merely similar. Both are computed here on every render, whatever you have typed above.',
      }),
      byteComparison(
        'cSHAKE with N and S empty',
        c.fallbackProof.cshakeEmpty,
        'plain SHAKE of the same message',
        c.fallbackProof.plain,
        {
          equalTitle: 'Identical — the fallback holds',
          differTitle: 'Different — the fallback is broken',
        },
      ),
    ),

    c.framedPrefix.length > 0
      ? el(
          'details',
          {},
          el('summary', { text: 'The bytes cSHAKE absorbs before your message' }),
          el('p', {
            text: `bytepad(encode_string(N) ‖ encode_string(S), ${c.trace.rateBytes}) — each string carries its own length, so no two (N, S) pairs can frame to the same bytes. It is padded out to a whole rate block, so your message can never sit in the same permutation input as the framing.`,
          }),
          hexBox(c.framedPrefix.subarray(0, 64), 'First 64 bytes of the framed prefix'),
        )
      : null,
  )
}


/**
 * The cSHAKE branch, drawn as two routes with the live one marked.
 *
 * SP 800-185 §3.3 is a genuine fork, not a tweak: with N and S both empty
 * cSHAKE IS SHAKE — same domain suffix, no framed prefix at all. That is easy
 * to miss when the only evidence is a hex comparison further down the panel,
 * so the branch itself is drawn, and the active side is decided by the value
 * the run actually computed.
 */
export function renderCshakeRoutes(report: RunReport): HTMLElement {
  const c = report.cshakeStage
  const active = c.fallbackActive ? 'a' : 'b'
  const rate = c.trace.rateBytes

  const route = (
    id: 'a' | 'b',
    title: string,
    condition: string,
    steps: string[],
  ): HTMLElement =>
    el(
      'li',
      {
        class: `route route-${id}${active === id ? ' route-active' : ''}`,
        'data-route': id,
        'data-active': String(active === id),
        'aria-current': active === id ? 'true' : undefined,
      },
      el(
        'p',
        { class: 'route-head' },
        el('span', { class: 'route-icon', 'aria-hidden': 'true', text: active === id ? '▶' : '·' }),
        el('span', { class: 'route-title', text: title }),
        el('span', {
          class: 'route-state',
          text: active === id ? 'ACTIVE — this is the route your inputs took' : 'not taken',
        }),
      ),
      el('p', { class: 'route-cond', text: condition }),
      el(
        'ol',
        { class: 'route-steps' },
        ...steps.map((t) => el('li', { text: t })),
      ),
    )

  return el(
    'div',
    { class: 'routes', id: 'cshake-routes' },
    el('p', { class: 'out-label', text: 'Which of the two routes your inputs take' }),
    el(
      'ul',
      { class: 'route-list', role: 'list', 'aria-label': 'The two cSHAKE routes' },
      route(
        'a',
        'Route A — cSHAKE is exactly SHAKE',
        'Taken when N and S are BOTH empty.',
        [
          'No framed prefix is absorbed at all',
          'The message is absorbed on its own',
          'Domain suffix 0x1F — SHAKE\u2019s own suffix, not cSHAKE\u2019s',
          'Result: byte-for-byte identical to plain SHAKE',
        ],
      ),
      route(
        'b',
        'Route B — cSHAKE frames a namespace',
        'Taken when either N or S is non-empty.',
        [
          'encode_string(N) \u2016 encode_string(S) frames each string with its own length',
          `bytepad(\u2026, ${rate}) pads that to a whole rate block`,
          'The framed prefix is absorbed, then the message',
          'Domain suffix 0x04 — cSHAKE\u2019s own suffix',
        ],
      ),
    ),
    el('p', {
      class: 'hint',
      id: 'cshake-route-note',
      text: `Right now: ${c.fallbackActive ? 'Route A. N and S are both empty, so there is no framed prefix and the suffix is 0x1F.' : `Route B. The framed prefix is ${c.framedPrefix.length} bytes and the suffix is 0x04.`} Clearing both fields moves the run onto the other route.`,
    }),
  )
}

/** Stage 4 — KMAC length binding sub-panels (always live, no verdict held). */
export function renderKmacLive(report: RunReport): HTMLElement {
  const k = report.kmacStage
  return el(
    'div',
    {},
    spongeBar(
      k.trace.rateBytes,
      k.trace.capacityBytes,
      `KMAC${k.params.strength} rides cSHAKE${k.params.strength}: the key is absorbed in its own padded block, then your message, then the requested output length. Two separate properties are at work. The framing (bytepad, encode_string) makes the encoding unambiguous, so no two different inputs can frame to the same bytes. Separately, the ${k.trace.capacityBytes * 8}-bit capacity is never emitted, so a tag holder cannot reconstruct the state — and it is that second property alone that removes the need for an HMAC-style outer hash.`,
    ),
    el(
      'ul',
      { class: 'kv', role: 'list' },
      el('li', { role: 'listitem' }, 'Key block: ', el('b', { id: 'kmac-keyblock', text: `${k.framing.keyBlock.length} bytes` })),
      el('li', { role: 'listitem' }, 'Length suffix: ', el('b', { id: 'kmac-suffix', text: toHex(k.framing.lengthSuffix) })),
      el('li', { role: 'listitem' }, 'This tag cost: ', el('b', { id: 'kmac-perms', text: String(k.operationCalls) }), ' permutation calls'),
    ),
    el(
      'details',
      {},
      el('summary', { text: 'What KMAC actually absorbs' }),
      el('p', {
        text: `bytepad(encode_string(K), ${k.trace.rateBytes}) ‖ message ‖ right_encode(${k.params.xof ? 0 : k.params.outputBits}) — and the whole thing goes into cSHAKE with the function name "KMAC". There is no inner and outer hash, because there is nothing to defend against by nesting.`,
      }),
      hexBox(k.framing.lengthSuffix, 'The right_encode length suffix'),
    ),
    el(
      'div',
      { class: 'compare', id: 'kmac-length-binding' },
      el('h4', { text: 'Does asking for a longer tag just give you more of the same tag?' }),
      el('p', {
        text: 'KMAC absorbs the requested output length, so changing it changes the input. KMACXOF absorbs zero instead, which un-binds it. Both are computed below over the same key and message.',
      }),
      byteComparison(
        `KMAC at ${k.lengthBinding.shortBits} bits`,
        k.lengthBinding.short,
        `KMAC at ${k.lengthBinding.longBits} bits, first ${k.lengthBinding.short.length} bytes`,
        k.lengthBinding.long.subarray(0, k.lengthBinding.short.length),
        {
          equalTitle: 'A truncation — the shorter tag is a prefix of the longer',
          differTitle: 'These two outputs differ — the shorter tag is not a prefix of the longer',
          note: `The cause is visible above: KMAC absorbs right_encode(${k.params.outputBits}), so changing the requested length changes the absorbed input rather than just the slice taken from it`,
        },
      ),
      byteComparison(
        `KMACXOF at ${k.lengthBinding.shortBits} bits`,
        k.xofBinding.short,
        `KMACXOF at ${k.lengthBinding.longBits} bits, first ${k.xofBinding.short.length} bytes`,
        k.xofBinding.long.subarray(0, k.xofBinding.short.length),
        {
          equalTitle: 'A prefix — the XOF variant just keeps squeezing',
          differTitle: 'These two outputs differ — unexpected for the XOF variant',
          note: 'KMACXOF absorbs right_encode(0) whatever length you ask for, so the longer run continues the same squeeze. Use KMACXOF to draw arbitrary key material; use KMAC when the length is part of what you are authenticating',
        },
      ),
    ),
  )
}

/** What a KMAC verification does and does not establish. */
export function renderLearnsPanel(): HTMLElement {
  return el(
    'details',
    { id: 'verify-scope' },
    el('summary', { text: 'What an accepted tag does and does not tell you' }),
    el('p', { text: 'A verification that accepts establishes exactly this:' }),
    el(
      'ul',
      { class: 'notes' },
      ...VERIFY_LEARNS.map((t) => el('li', { text: t })),
    ),
    el('p', { text: 'It does NOT establish:' }),
    el(
      'ul',
      { class: 'notes' },
      ...VERIFY_DOES_NOT_LEARN.map((t) => el('li', { text: t })),
    ),
  )
}

/** The closing contrast — one beat, not a second demo. */
export function renderContrastPanel(
  report: RunReport,
  naiveTag: Uint8Array | null,
  facts: { naive: ContrastFacts; kmac: ContrastFacts },
): HTMLElement {
  const k = report.kmacStage
  const table = el(
    'table',
    { class: 'facts' },
    el('caption', { text: 'Both columns are computed from the parameters in use above.' }),
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        el('th', { scope: 'col', text: '' }),
        el('th', { scope: 'col', text: facts.naive.name }),
        el('th', { scope: 'col', text: facts.kmac.name }),
      ),
    ),
    el(
      'tbody',
      {},
      row('Internal state', `${facts.naive.internalStateBits} bits`, `${facts.kmac.internalStateBits} bits`),
      row('Tag width', `${facts.naive.digestBits} bits`, `${facts.kmac.digestBits} bits`),
      row(
        'State still hidden from a tag holder',
        `${facts.naive.hiddenStateBits} bits`,
        `${facts.kmac.hiddenStateBits} bits`,
      ),
      row(
        'Can a tag holder resume the computation?',
        facts.naive.resumableFromDigest ? 'Yes — the tag IS the state' : 'No',
        facts.kmac.resumableFromDigest ? 'Yes' : 'No — the capacity was never output',
      ),
    ),
  )

  return el(
    'section',
    { class: 'panel', 'aria-labelledby': 'contrast-h' },
    el(
      'div',
      { class: 'panel-head' },
      el('span', { class: 'stage-num', text: 'WHY KEY IT THIS WAY' }),
      el('h2', { id: 'contrast-h', text: 'KMAC beside SHA-256(key ‖ message)' }),
    ),
    el('p', { class: 'lede' },
      'The obvious way to build a MAC from a hash is to hash the key in front of the message. With SHA-256 that construction is broken — and the reason is structural, which is why the numbers below are the whole argument.',
    ),
    naiveTag
      ? el(
          'div',
          {},
          el('p', { class: 'out-label', text: `SHA-256(key ‖ message) over the stage 4 inputs` }),
          el('div', { id: 'naive-tag', 'data-hex': toHex(naiveTag) }, hexBox(naiveTag, 'Naive MAC over the stage 4 key and message')),
          el('p', { class: 'out-label', text: `KMAC${k.params.strength} over the same key and message` }),
          el('div', { id: 'kmac-live-tag', 'data-hex': toHex(k.tag) }, hexBox(k.tag, 'KMAC tag over the stage 4 key and message')),
        )
      : el('p', { class: 'hint', text: 'Computing the comparison…' }),
    scrollRegion('Structural comparison of the two constructions', 'facts-scroll', table),
    el('p', { id: 'contrast-note', class: 'lede' }, facts.naive.note),
    el('p', { class: 'lede' }, facts.kmac.note),
    el(
      'div',
      { class: 'compare' },
      el('h4', { text: 'Scope of this panel' }),
      el(
        'p',
        {},
        'This states the contrast; it does not play it out. The append forgery against ',
        el('code', { text: 'SHA-256(key ‖ message)' }),
        ' is an interactive exhibit in ',
        el('a', { href: 'https://systemslibrarian.github.io/crypto-lab-mac-race/', text: 'crypto-lab-mac-race' }),
        ' and ',
        el('a', { href: 'https://systemslibrarian.github.io/crypto-lab-babel-hash/', text: 'crypto-lab-babel-hash' }),
        '. What that attack yields is a valid tag for a message the key holder never authorised — an append forgery. It does not recover the key, and nothing here claims it does.',
      ),
    ),
  )
}

export interface ContrastFacts {
  name: string
  internalStateBits: number
  digestBits: number
  hiddenStateBits: number
  resumableFromDigest: boolean
  note: string
}

function row(label: string, a: string, b: string): HTMLElement {
  return el(
    'tr',
    {},
    el('th', { scope: 'row', text: label }),
    el('td', { text: a }),
    el('td', { text: b }),
  )
}

/** Honest scoping — what is real, what is not, and what is deliberately absent. */
export function renderScopePanel(): HTMLElement {
  return el(
    'section',
    { class: 'panel', 'aria-labelledby': 'scope-h' },
    el(
      'div',
      { class: 'panel-head' },
      el('span', { class: 'stage-num', text: 'SCOPE' }),
      el('h2', { id: 'scope-h', text: 'What is real here, and what is not' }),
    ),
    el('p', { class: 'lede' },
      'Everything on this page is computed in your browser by the Keccak-f[1600] permutation in ',
      el('code', { text: 'src/keccak/keccak-f1600.ts' }),
      '. No value is stored, stubbed or replayed, and no network request is made. ',
      el('b', { text: 'This is a teaching implementation, not production cryptography.' }),
    ),
    el(
      'ul',
      { class: 'notes' },
      el('li', {}, el('b', { text: 'Not constant-time. ' }), 'The permutation uses BigInt arithmetic in a JIT-compiled runtime, and tag comparison is branch-free in shape only. Neither offers a timing guarantee. Use a vetted library for anything real.'),
      el('li', {}, el('b', { text: 'Verified against the specs. ' }), 'The build runs 21 known-answer tests from FIPS 202 and SP 800-185, plus cross-checks against two independent implementations. A failing KAT blocks the deploy.'),
      el('li', {}, el('b', { text: 'Keys are session-only. ' }), 'The key you type lives in a text box and in memory. Nothing is persisted or transmitted.'),
    ),
    el('h3', { text: 'Deliberately not built here' }),
    el(
      'ul',
      { class: 'notes' },
      el('li', {}, el('b', { text: 'TupleHash and ParallelHash. ' }), 'The other two SP 800-185 functions. TupleHash authenticates a sequence of strings unambiguously; ParallelHash hashes large inputs in independent chunks. Both build on the same cSHAKE core shown above.'),
      el('li', {}, el('b', { text: 'The length-extension attack itself. ' }), 'Stated as a contrast above; played out in ',
        el('a', { href: 'https://systemslibrarian.github.io/crypto-lab-mac-race/', text: 'crypto-lab-mac-race' }), ' and ',
        el('a', { href: 'https://systemslibrarian.github.io/crypto-lab-babel-hash/', text: 'crypto-lab-babel-hash' }), '.'),
      el('li', {}, el('b', { text: 'HMAC. ' }), 'The construction KMAC makes unnecessary is covered in its own sibling demos.'),
      el('li', {}, el('b', { text: 'SHA-3 collision resistance. ' }), 'See ',
        el('a', { href: 'https://systemslibrarian.github.io/crypto-lab-collision-vault/', text: 'crypto-lab-collision-vault' }), '.'),
      el('li', {}, el('b', { text: 'KMAC as a KDF inside a protocol. ' }), 'KMAC is used this way in CNSA 2.0 and post-quantum key schedules, but no protocol is built here — only the primitive.'),
    ),
  )
}

/** Plain-language on-ramp. No math, no hex, before anything else. */
export function renderIntro(): HTMLElement {
  return el(
    'section',
    { class: 'panel intro', 'aria-labelledby': 'intro-h' },
    el('h2', { id: 'intro-h', text: 'What is a sponge?' }),
    el('p', {},
      'A sponge is a fixed-size block of memory — here 200 bytes — plus one scrambling function that stirs it. You feed data in by mixing it into the first part of that memory and stirring; you read results out of that same first part, stirring again whenever you need more.',
    ),
    el('p', {},
      'The trick is what happens to the rest of that memory, called the ',
      el('b', { text: 'capacity' }),
      '. Your input is never mixed into it directly, and none of it is ever handed back to you — but the stirring spreads your input through it all the same, so it does not sit there empty. What matters is the half you never see: because the capacity is never given out, nobody holding the output can work out the machine\u2019s full contents, and so nobody can pick up stirring where you left off.',
    ),
    el('p', {},
      'That one design choice is why the four functions below — a hash, a variable-length hash, a domain-separated hash, and a keyed message authentication code — are the same machine wearing different labels, and why keying it takes no extra scaffolding. Work through the stages in order; each adds exactly one idea to the one before.',
    ),
  )
}

/** Concatenate helper used by the tamper control. */
export function tamperMessage(current: string): string {
  const bytes = utf8(current)
  if (bytes.length === 0) return 'x'
  // Flip the case of the first letter, or append a digit if there is none —
  // a visible edit the learner can see in the box, not a hidden byte twiddle.
  const chars = [...current]
  const index = chars.findIndex((c) => /[a-zA-Z]/.test(c))
  if (index === -1) return current + '9'
  const c = chars[index]
  chars[index] = c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()
  return chars.join('')
}
