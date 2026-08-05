/**
 * Page assembly and event wiring.
 *
 * Controls are built once and never replaced, so typing never loses focus;
 * only the output containers are re-rendered. Every re-render recomputes the
 * whole page from one `computeRun()`, which is what keeps the panels from
 * drifting apart.
 */

import { toHex } from '../keccak/bytes'
import type { Strength } from '../keccak/fips202'
import type { KmacParams } from '../keccak/sp800-185'
import { CAUSE_TEXT, computeTag, verifyMessage } from '../demo/mac'
import { contrast, naiveSha256Mac } from '../demo/naive-mac'
import { DEFAULT_INPUTS, computeRun, type DemoInputs, type RunReport } from '../demo/run'
import { staleness, tagDrift, type SignedArtifact, type VerdictRecord } from '../demo/verdict'
import { hexBox, verdict } from './components'
import { el, field, liveRegion, replace, select } from './dom'
import { pipelineStages } from '../demo/pipeline'
import {
  renderContrastPanel,
  renderCorePanel,
  renderSpine,
  renderCshakeOutput,
  renderIntro,
  renderKmacLive,
  renderLearnsPanel,
  renderScopePanel,
  renderSha3Output,
  renderShakeOutput,
  tamperMessage,
} from './panels'

interface AppState {
  inputs: DemoInputs
  sha3Step: number
  signed: SignedArtifact | null
  held: VerdictRecord | null
}

export function mount(root: HTMLElement): void {
  const state: AppState = {
    inputs: { ...DEFAULT_INPUTS },
    sha3Step: 0,
    signed: null,
    held: null,
  }

  // --- hero ---------------------------------------------------------------
  const hero = el(
    'header',
    { class: 'cl-hero' },
    el(
      'div',
      { class: 'cl-hero-main' },
      el('h1', { class: 'cl-hero-title', text: 'KMAC Gate' }),
      el('p', { class: 'cl-hero-sub', text: 'Keyed Keccak · SP 800-185 / FIPS 202' }),
      el('p', {
        class: 'cl-hero-desc',
        text: 'Runs SHA3-256, SHAKE, cSHAKE and KMAC on one hand-written Keccak-f[1600] permutation, so you can watch a hash, an extendable output, a domain-separated output and a keyed tag come out of the same machine.',
      }),
    ),
    el(
      'aside',
      { class: 'cl-hero-why', 'aria-label': 'Why it matters' },
      el('span', { class: 'cl-hero-why-label', text: 'WHY IT MATTERS' }),
      el('p', {
        class: 'cl-hero-why-text',
        text: 'Keying a hash the obvious way — hashing the key in front of the message — is broken for SHA-256, and HMAC exists to work around it. Keccak needs no such wrapper, and seeing why turns a rule you memorise into a structure you can point at.',
      }),
    ),
  )

  // --- output containers --------------------------------------------------
  const coreOut = el('div', { id: 'core-out' })
  const sha3Out = liveRegion('stage-out')
  const shakeOut = liveRegion('stage-out')
  const cshakeOut = liveRegion('stage-out')
  const kmacLiveOut = liveRegion('stage-out')
  const kmacTagOut = liveRegion('stage-out')
  kmacTagOut.id = 'kmac-tag-panel'
  const kmacVerdictOut = liveRegion('stage-out')
  kmacVerdictOut.id = 'kmac-verdict-panel'
  const contrastOut = liveRegion('stage-out')

  // --- stage 1 controls ---------------------------------------------------
  const messageInput = el('textarea', {
    rows: '3',
    spellcheck: 'false',
  }) as HTMLTextAreaElement
  messageInput.value = state.inputs.message

  const stepPrev = el('button', { type: 'button', text: '◀ Previous block' })
  const stepNext = el('button', { type: 'button', text: 'Next block ▶' })
  const stepFirst = el('button', { type: 'button', text: '⏮ First' })

  const stage1 = section(
    'STAGE 1',
    'sha3',
    'SHA3-256 — absorb, then squeeze',
    'Type anything. The message is padded to whole 136-byte blocks, each block is XORed into the rate and the state is permuted; the digest is read straight back out of the rate. Step through the blocks to watch the state fill up.',
    el(
      'div',
      { class: 'controls' },
      field(
        'msg-input',
        'Message (shared by stages 1, 2 and 3)',
        messageInput,
        'The same bytes go into all three modes below — only the framing differs.',
        'field-wide',
      ),
    ),
    el('div', { class: 'button-row' }, stepFirst, stepPrev, stepNext),
    sha3Out,
  )

  // --- stage 2 controls ---------------------------------------------------
  const shakeStrengthSelect = select(
    [
      { value: '128', label: 'SHAKE128 — rate 168 B' },
      { value: '256', label: 'SHAKE256 — rate 136 B' },
    ],
    String(state.inputs.shakeStrength),
  )
  const shakeLengthInput = el('input', {
    type: 'range',
    min: '16',
    max: '512',
    step: '1',
  }) as HTMLInputElement
  shakeLengthInput.value = String(state.inputs.shakeBytes)
  const shakeLengthOut = el('output', { id: 'shake-length-readout', for: 'shake-length' })
  shakeLengthOut.textContent = `${state.inputs.shakeBytes} bytes`

  const stage2 = section(
    'STAGE 2',
    'shake',
    'SHAKE — the same absorb, an endless squeeze',
    'A hash gives you a fixed number of bytes. An extendable-output function lets you ask for any number. Drag the slider and watch what happens to the bytes you already had.',
    el(
      'div',
      { class: 'controls' },
      field('shake-strength', 'Variant', shakeStrengthSelect),
      field(
        'shake-length',
        'Output length',
        shakeLengthInput,
        'Ask for more, and the sponge permutes again rather than starting over.',
      ),
      el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Requested' }), shakeLengthOut),
    ),
    shakeOut,
  )

  // --- stage 3 controls ---------------------------------------------------
  const cshakeStrengthSelect = select(
    [
      { value: '128', label: 'cSHAKE128' },
      { value: '256', label: 'cSHAKE256' },
    ],
    String(state.inputs.cshakeStrength),
  )
  const cshakeNameInput = el('input', { type: 'text', spellcheck: 'false' }) as HTMLInputElement
  cshakeNameInput.value = state.inputs.cshakeName
  const cshakeCustomInput = el('input', { type: 'text', spellcheck: 'false' }) as HTMLInputElement
  cshakeCustomInput.value = state.inputs.cshakeCustom

  const stage3 = section(
    'STAGE 3',
    'cshake',
    'cSHAKE — the same squeeze, in its own namespace',
    'Two systems using SHAKE for different jobs would produce interchangeable output, and a value meant for one could be replayed into the other. cSHAKE fixes that by absorbing a framed label first. Edit the customization string and watch the output change completely — then clear both fields and watch the run fall back onto the plain SHAKE route.',
    el(
      'div',
      { class: 'controls' },
      field('cshake-strength', 'Variant', cshakeStrengthSelect),
      field(
        'cshake-name',
        'Function name N',
        cshakeNameInput,
        'Reserved for names NIST assigns, like “KMAC”. Usually empty.',
      ),
      field(
        'cshake-custom',
        'Customization string S',
        cshakeCustomInput,
        'Yours to choose. Clear both to see the SHAKE fallback.',
      ),
    ),
    cshakeOut,
  )

  // --- stage 4 controls ---------------------------------------------------
  const keyInput = el('input', { type: 'text', spellcheck: 'false' }) as HTMLInputElement
  keyInput.value = state.inputs.kmacKey
  const kmacMessageInput = el('textarea', { rows: '2', spellcheck: 'false' }) as HTMLTextAreaElement
  kmacMessageInput.value = state.inputs.kmacMessage
  const kmacStrengthSelect = select(
    [
      { value: '128', label: 'KMAC128' },
      { value: '256', label: 'KMAC256' },
    ],
    String(state.inputs.kmacStrength),
  )
  const kmacVariantSelect = select(
    [
      { value: 'kmac', label: 'KMAC — length bound' },
      { value: 'xof', label: 'KMACXOF — length free' },
    ],
    state.inputs.kmacXof ? 'xof' : 'kmac',
  )
  const kmacLengthSelect = select(
    [
      { value: '256', label: '256 bits (32 bytes)' },
      { value: '512', label: '512 bits (64 bytes)' },
    ],
    String(state.inputs.kmacOutputBits),
  )
  const kmacCustomInput = el('input', { type: 'text', spellcheck: 'false' }) as HTMLInputElement
  kmacCustomInput.value = state.inputs.kmacCustom

  const signBtn = el('button', { type: 'button', class: 'primary', text: 'Compute tag' })
  const verifyBtn = el('button', { type: 'button', text: 'Verify tag' })
  const tamperBtn = el('button', { type: 'button', text: 'Tamper with the message' })
  const resetBtn = el('button', { type: 'button', text: 'Clear tag' })

  const stage4 = section(
    'STAGE 4',
    'kmac',
    'KMAC — key the sponge, then try to break it',
    'Frame a key into the sponge ahead of the message and the same machine becomes a message authentication code. Compute a tag, verify it, then change one character and verify again — the rejection you get is the real primitive refusing, not a warning banner. Note this is a MAC, not a signature: the same secret key both makes and checks the tag, so anyone holding it could have produced what you are checking.',
    el(
      'div',
      { class: 'controls' },
      field('kmac-key', 'Key (UTF-8 text)', keyInput, 'Session-only: never stored, never sent.'),
      field('kmac-strength', 'Strength', kmacStrengthSelect),
      field('kmac-variant', 'Variant', kmacVariantSelect),
      field('kmac-length', 'Output length L', kmacLengthSelect),
      field('kmac-custom', 'Customization S', kmacCustomInput, 'Optional domain label.'),
      field('kmac-message', 'Message to authenticate', kmacMessageInput, undefined, 'field-wide'),
    ),
    el('div', { class: 'button-row' }, signBtn, verifyBtn, tamperBtn, resetBtn),
    kmacTagOut,
    kmacVerdictOut,
    renderLearnsPanel(),
    kmacLiveOut,
  )

  // --- assemble -----------------------------------------------------------
  // The four stages are presented as ONE pipeline, re-parameterised four
  // times, rather than four independent exhibits — the same claim the shared
  // permutation counter makes in numbers, made in layout.
  const connector = (from: string, to: string): HTMLElement =>
    el(
      'p',
      { class: 'stage-connector', 'data-from': from, 'data-to': to },
      el('span', { class: 'connector-rule', 'aria-hidden': 'true' }),
      el('span', {
        class: 'connector-text',
        text: `Same sponge, same permutation — re-parameterised from ${from} to ${to}`,
      }),
    )

  const pipeline = el(
    'section',
    { class: 'pipeline-wrap', id: 'pipeline', 'aria-labelledby': 'pipeline-h' },
    el('h2', { id: 'pipeline-h', class: 'pipeline-h', text: 'The pipeline, four times over' }),
    el('p', { class: 'lede' },
      'Each stage below is a fresh run of the same sponge over the same permutation. Watch the spine at the top of each one: the steps that change are marked, and the Keccak-f[1600] step never does.',
    ),
    stage1,
    connector('SHA3-256', 'SHAKE'),
    stage2,
    connector('SHAKE', 'cSHAKE'),
    stage3,
    connector('cSHAKE', 'KMAC'),
    stage4,
  )

  replace(
    root,
    hero,
    renderIntro(),
    el('div', { id: 'core-panel' }, coreOut),
    pipeline,
    el('div', { id: 'contrast-panel' }, contrastOut),
    renderScopePanel(),
  )

  // --- rendering ----------------------------------------------------------
  let report: RunReport = computeRun(state.inputs)

  function currentParams(): KmacParams {
    return report.kmacStage.params
  }

  function renderTagPanel(): void {
    if (!state.signed) {
      replace(
        kmacTagOut,
        verdict(
          'info',
          'No tag yet',
          'Press “Compute tag” to run KMAC over the key and message above.',
        ),
      )
      return
    }
    const drift = tagDrift(state.signed, currentParams())
    replace(
      kmacTagOut,
      el('p', { class: 'out-label', text: 'Tag held' }),
      el(
        'div',
        { id: 'held-tag', 'data-hex': toHex(state.signed.tag) },
        hexBox(state.signed.tag, 'The tag currently held'),
      ),
      drift.drifted
        ? verdict(
            'info',
            'This tag covers the earlier inputs, not what is on screen now',
            `It was computed before ${drift.changed.join(', ')} changed. That is deliberate — keeping it is what lets you check the changed message against it. Press “Verify tag” to do that, or “Compute tag” to authenticate the current inputs.`,
          )
        : el('p', {
            class: 'hint',
            id: 'tag-fresh-note',
            text: 'This tag was computed over exactly the inputs currently on screen.',
          }),
    )
  }

  function renderVerdictPanel(): void {
    if (!state.held) {
      replace(
        kmacVerdictOut,
        verdict(
          'info',
          'Nothing verified yet',
          'Press “Verify tag” to recompute the tag from the message on screen and compare it against the tag held above.',
        ),
      )
      return
    }
    const stale = staleness(state.held, currentParams())
    if (stale.stale) {
      replace(
        kmacVerdictOut,
        verdict('stale', 'Verdict retired — inputs changed since it was computed', stale.message),
      )
      return
    }
    const outcome = state.held.outcome
    if (outcome.accepted) {
      replace(
        kmacVerdictOut,
        verdict(
          'ok',
          'Tag accepted — recomputed tag matches, byte for byte',
          'The verifier recomputed KMAC over the message on screen under the key on screen and got exactly the held tag. That means these bytes were authenticated by someone holding this key. Because that key is shared, it does not identify who — you hold it too — and it does not say when, so a replayed old message and tag would also verify.',
        ),
        el('p', { class: 'out-label', text: 'Recomputed by the verifier' }),
        el(
          'div',
          { id: 'recomputed-tag', 'data-hex': outcome.recomputedHex },
          hexBox(outcome.recomputed, 'Tag recomputed by the verifier'),
        ),
      )
      return
    }
    replace(
      kmacVerdictOut,
      verdict(
        'bad',
        'Tag rejected — the recomputed tag does not match',
        `The verifier recomputed the tag from what is on screen and got different bytes, diverging at byte ${outcome.divergesAtByte}. Cause: ${outcome.cause ? CAUSE_TEXT[outcome.cause] : 'unknown'}.`,
      ),
      el('p', { class: 'out-label', text: 'Recomputed by the verifier' }),
      el(
        'div',
        { id: 'recomputed-tag', 'data-hex': outcome.recomputedHex },
        hexBox(outcome.recomputed, 'Tag recomputed by the verifier'),
      ),
      el('p', {
        class: 'hint',
        id: 'reject-note',
        text: 'A real verifier holding only the key, the message and the tag learns exactly this much: these bytes did not authenticate. It cannot tell which part was changed — the exhibit can only name the cause because it remembers what you signed.',
      }),
    )
  }

  /**
   * The contrast panel is the page's one asynchronous value (WebCrypto
   * SHA-256). A slow digest must never be painted beside a newer KMAC report:
   * that would put two different runs on one screen and let a tag outlive the
   * inputs that produced it.
   *
   * A monotonically increasing token settles it for EVERY parameter, not just
   * the message — guarding the message alone let a key change slip through,
   * because the naive MAC is computed over key ‖ message.
   */
  let renderToken = 0
  async function renderContrast(): Promise<void> {
    const token = ++renderToken
    const params = currentParams()
    const capturedReport = report
    const facts = contrast(params.strength, params.outputBits)
    const naive = await naiveSha256Mac(params.key, params.message)
    // A newer render started while we were awaiting: drop this result rather
    // than paint it next to values it does not belong to.
    if (token !== renderToken) return
    replace(contrastOut, renderContrastPanel(capturedReport, naive, facts))
    document.body.dataset.ready = 'true'
  }

  function render(): void {
    report = computeRun(state.inputs)
    state.sha3Step = Math.min(state.sha3Step, report.sha3.trace.steps.length - 1)

    const stages = pipelineStages(report)
    replace(coreOut, renderCorePanel(report))
    replace(sha3Out, renderSpine(stages, 0), renderSha3Output(report, state.sha3Step))
    replace(shakeOut, renderSpine(stages, 1), renderShakeOutput(report))
    replace(cshakeOut, renderSpine(stages, 2), renderCshakeOutput(report))
    replace(kmacLiveOut, renderSpine(stages, 3), renderKmacLive(report))

    stepPrev.disabled = state.sha3Step === 0
    stepFirst.disabled = state.sha3Step === 0
    stepNext.disabled = state.sha3Step >= report.sha3.trace.steps.length - 1
    verifyBtn.disabled = state.signed === null
    resetBtn.disabled = state.signed === null && state.held === null
    shakeLengthOut.textContent = `${state.inputs.shakeBytes} bytes`

    renderTagPanel()
    renderVerdictPanel()
    void renderContrast()
  }

  // --- events -------------------------------------------------------------
  const onInput = (node: HTMLElement, apply: () => void): void => {
    node.addEventListener('input', () => {
      apply()
      render()
    })
    node.addEventListener('change', () => {
      apply()
      render()
    })
  }

  onInput(messageInput, () => {
    state.inputs.message = messageInput.value
  })
  onInput(shakeStrengthSelect, () => {
    state.inputs.shakeStrength = Number(shakeStrengthSelect.value) as Strength
  })
  onInput(shakeLengthInput, () => {
    state.inputs.shakeBytes = Number(shakeLengthInput.value)
  })
  onInput(cshakeStrengthSelect, () => {
    state.inputs.cshakeStrength = Number(cshakeStrengthSelect.value) as Strength
  })
  onInput(cshakeNameInput, () => {
    state.inputs.cshakeName = cshakeNameInput.value
  })
  onInput(cshakeCustomInput, () => {
    state.inputs.cshakeCustom = cshakeCustomInput.value
  })
  onInput(keyInput, () => {
    state.inputs.kmacKey = keyInput.value
  })
  onInput(kmacMessageInput, () => {
    state.inputs.kmacMessage = kmacMessageInput.value
  })
  onInput(kmacStrengthSelect, () => {
    state.inputs.kmacStrength = Number(kmacStrengthSelect.value) as Strength
  })
  onInput(kmacVariantSelect, () => {
    state.inputs.kmacXof = kmacVariantSelect.value === 'xof'
  })
  onInput(kmacLengthSelect, () => {
    state.inputs.kmacOutputBits = Number(kmacLengthSelect.value)
  })
  onInput(kmacCustomInput, () => {
    state.inputs.kmacCustom = kmacCustomInput.value
  })

  stepFirst.addEventListener('click', () => {
    state.sha3Step = 0
    render()
  })
  stepPrev.addEventListener('click', () => {
    state.sha3Step = Math.max(0, state.sha3Step - 1)
    render()
  })
  stepNext.addEventListener('click', () => {
    state.sha3Step = Math.min(report.sha3.trace.steps.length - 1, state.sha3Step + 1)
    render()
  })

  signBtn.addEventListener('click', () => {
    const params = currentParams()
    state.signed = { params, tag: computeTag(params).tag }
    // A new tag says nothing about the old verification.
    state.held = null
    render()
  })

  verifyBtn.addEventListener('click', () => {
    if (!state.signed) return
    const params = currentParams()
    state.held = {
      params,
      presentedTag: state.signed.tag,
      outcome: verifyMessage(params, state.signed.tag, state.signed.params),
    }
    render()
  })

  tamperBtn.addEventListener('click', () => {
    const next = tamperMessage(state.inputs.kmacMessage)
    state.inputs.kmacMessage = next
    kmacMessageInput.value = next
    render()
  })

  resetBtn.addEventListener('click', () => {
    state.signed = null
    state.held = null
    render()
  })

  render()
}

function section(
  badge: string,
  id: string,
  title: string,
  lede: string,
  ...children: (HTMLElement | null)[]
): HTMLElement {
  return el(
    'section',
    { class: 'panel', 'aria-labelledby': `${id}-h`, id: `stage-${id}` },
    el(
      'div',
      { class: 'panel-head' },
      el('span', { class: 'stage-num', text: badge }),
      el('h2', { id: `${id}-h`, text: title }),
    ),
    el('p', { class: 'lede', text: lede }),
    ...children,
  )
}
