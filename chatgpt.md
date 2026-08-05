# KMAC Gate: Gold-Standard Teaching Review

Date: 2026-08-05

Scope: teaching, interaction, visual explanation, and claim integrity. This review does not propose expanding the cryptographic scope, rebuilding the length-extension attack, or turning the teaching implementation into production crypto.

## Executive verdict

KMAC Gate is already unusually strong at correctness and evidentiary discipline. It uses the real primitive, computes both sides of its headline comparisons, preserves a held tag for an honest tamper workflow, retires stale verdicts, cross-checks outputs against independent implementations, and gates important browser states for accessibility.

The remaining gap is not more cryptography. It is a clearer causal model.

Today the learner encounters a counter, a suffix table, a SHA3 state trace, and several separate hex comparisons. Those pieces are correct, but the learner must assemble the central idea for themselves. A gold-standard version should make one persistent visual argument:

> Every mode starts a fresh 1600-bit state and calls the same Keccak-f[1600] permutation. What changes is the sponge parameterization, the bytes framed around the message, and the output contract.

The page should let a learner hold the message and strength constant, change one rule at a time, and watch that rule enter the same absorb/permutation/squeeze pipeline.

## What the lesson should teach

A learner who finishes the lab should be able to explain all of the following without relying on memorized API names:

1. A Keccak sponge has a 200-byte state split into a rate and a capacity.
2. Input is XORed directly into the rate only. Keccak-f then diffuses that influence through the whole state, including the capacity. Output is read directly from the rate only.
3. Each operation uses a fresh state. "One sponge" means one shared construction and one shared permutation implementation, not one mutable state reused across SHA3, SHAKE, cSHAKE, and KMAC.
4. SHA3-256 fixes the rate, domain suffix, and 32-byte output contract.
5. SHAKE changes the domain suffix and permits continued squeezing. A longer result preserves the earlier prefix.
6. cSHAKE has an important branch:
   - Empty `N` and `S`: take the exact SHAKE path, with no cSHAKE prefix and SHAKE's `0x1f` domain.
   - Non-empty `N` or `S`: absorb a length-delimited, byte-padded namespace prefix and use the cSHAKE `0x04` domain.
7. KMAC is not merely `key || message` fed to a sponge. It uses cSHAKE with function name `KMAC`, a framed and padded key block, the message, and `right_encode(L)` or `right_encode(0)`.
8. KMAC binds the requested output length into its input. KMACXOF absorbs zero for that field, so longer output extends the same stream.
9. A matching MAC tag authenticates these exact bytes under these exact parameters and shared key. It does not identify a sender, establish when the tag was made, or prevent replay.
10. The SHA-256 prefix-MAC contrast is an append/length-extension forgery, not key recovery. SHA-256 exposes its complete chaining value; a sponge output does not expose its hidden capacity.

That is the learning contract. Every visual and control should support it.

## What is already excellent

These parts should be preserved rather than redesigned away:

- Real, inspectable Keccak-f[1600], sponge, FIPS 202, and SP 800-185 code.
- One shared permutation and sponge architecture, enforced both behaviorally and structurally in `src/keccak/architecture.test.ts`.
- Official known-answer tests and independent OpenSSL/js-sha3 cross-checks.
- One current `RunReport` feeding the page, rather than disconnected panels with unrelated state.
- SHAKE prefix and split-squeeze checks computed from real runs.
- cSHAKE empty-`N`/empty-`S` equality computed against plain SHAKE.
- KMAC versus KMACXOF output-length comparisons.
- A held tag that survives input changes, making genuine rejection possible.
- Explicit verdict retirement and a no-op guard.
- Careful explanation of what verification does and does not establish.
- Honest production, timing, protocol, TupleHash, ParallelHash, HMAC, collision, and attack-demo boundaries.
- Accessibility coverage across initial, stepped, fallback, accepted, retired, and rejected states in both themes.
- Arithmetic contrast testing and keyboard-reachable scroll regions.

This foundation is the expensive part. The next pass should spend its effort on comprehension.

## Validation performed for this review

- `npm test`: 237 of 237 unit tests passed across all 10 test files.
- `npm run test:browser`: 48 of 48 Playwright tests passed against the production build.
- The browser run covered both themes and the initial, stepped, fallback, accepted, retired, and rejected states.
- Untouched production pages were captured at 1440px desktop width and 390px phone width for visual review.

The recommendations below therefore do not come from a failing cryptographic or accessibility baseline. They target misconceptions, visual causality, responsive comprehension, and two claim-integrity paths that the current suites do not exercise.

## Gold-standard blockers

### 1. The headline mechanism is inferred, not directly manipulated

`renderCorePanel()` proves that calls reach one function, but a permutation-call counter is architecture evidence for a developer, not a mental model for a newcomer. The suffix table also compresses several different ideas into one row.

The learner needs a persistent pipeline that remains visually stable across all stages:

```text
mode parameters -> framed input -> absorb into RATE -> Keccak-f[1600] -> squeeze RATE -> output contract
                                      CAPACITY is not direct I/O
```

Each stage should highlight only what changed from the preceding stage. The current counter can remain in an expert detail labeled as total demo workload, including auxiliary proof runs.

### 2. The default path changes too many variables at once

The current default compares SHA3-256 with SHAKE128, cSHAKE128, and KMAC128. That changes rate/capacity at the same time as suffix, framing, and output behavior. It weakens the claim that each stage adds one idea.

Use an apples-to-apples guided path:

- SHA3-256
- SHAKE256
- cSHAKE256
- KMAC256

All four then use a 136-byte rate and 64-byte capacity. The learner can first isolate framing and output-contract changes. A separate expert control can switch the XOF family to 128-bit strength and visibly explain the resulting 168/32-byte split.

### 3. The absorb visualization blurs two different events

The page currently says the capacity is "never written by input" or cannot be "touched." Input is not directly XORed into capacity, but the permutation immediately diffuses input influence into it. The distinction matters.

The trace already records `lanesBefore` and `lanesAfter`, but the UI shows only post-permutation states. A gold-standard absorb step should have two beats:

1. XOR the block: only rate lanes change.
2. Permute: changes diffuse across rate and capacity.

Do not animate all 24 rounds by default. That would teach Keccak internals instead of this lab's thesis. Show the two causal moments, with round detail available only on demand.

### 4. "One sponge" can sound like one reused live state

The four modes are separate invocations with fresh states. They share the permutation implementation and sponge design. The page should say this once, early, because "same state," "same machine," and "one sponge" can otherwise create a false sequential model.

Suggested wording:

> Four fresh runs, one construction: each mode starts from a new zero state and reaches the same Keccak-f[1600] function through the same sponge code.

### 5. KMAC is called signing

A MAC is not a digital signature. Labels such as "Sign message" risk teaching public verification, sender identity, or non-repudiation even though later caveats correct some of that impression.

Use "Create tag" or "Authenticate message" and "Verify tag." State that both creator and verifier possess the same secret key, so either could have created the tag.

### 6. One observed difference is labeled "unrelated"

Changing `S` and observing different bytes proves that this run changed. It does not empirically prove statistical independence or that the values are "unrelated." Domain separation is a construction and security claim, not a conclusion from one sample.

Use two layers of language:

- Computed verdict: "Different output in this run; first divergence at byte N."
- Explanatory claim: "The framed customization defines a distinct function namespace, designed to separate these uses under cSHAKE's security model."

### 7. The padding marker is located by byte value

`renderTrace()` finds the suffix with `findIndex()` on the padded block. If the message itself contains `0x06`, the first matching message byte can be marked as the SHA3 suffix. A truthful visualization must carry the exact suffix offset as trace metadata rather than rediscovering structure by searching values.

Add regression cases where the message already contains `0x06`, `0x1f`, `0x04`, `0x80`, and repeated zero bytes. The displayed marker must still identify the appended suffix and final pad bit.

### 8. The asynchronous contrast panel can mix runs

After awaiting the WebCrypto SHA-256 result, `renderContrast()` guards only the message bytes. A rapid key, strength, output-length, customization, or variant change can allow an older naive tag to be rendered beside the newest KMAC report while the caption says both use the current parameters.

Gold-standard claim integrity requires either a monotonically increasing render token or an equality check over every captured parameter before committing the asynchronous result. Add a delayed-digest race test that changes the key while keeping the message fixed.

## The recommended learner journey

### Opening: one question, one machine

Start with the plain-language sponge explanation, then place the stable 200-byte state diagram directly under it. Before any digest, show three frames:

1. Fresh zero state, split into rate and capacity.
2. Message block XORed into rate only.
3. State after Keccak-f, with influence spread through all 25 lanes.

The opening question should be concrete:

> If the same message enters the same permutation, what must change to make a hash, an XOF, a named XOF, or a MAC?

The four stages answer that question by changing one visible part of the pipeline at a time.

### Stage 1: SHA3-256 establishes the machine

Keep:

- Editable message.
- Exact padding bytes.
- Block stepper.
- Rate/capacity split.
- Real digest.

Improve:

- Show message bytes, suffix/padding, XOR, permutation, and squeeze as distinct steps.
- Mark suffix and final bit from structural metadata, never value search.
- Put the 5x5 lane table behind "Inspect all lanes" after the first guided example. Raw lanes reward experts but should not be the newcomer's primary picture.
- Add a rate-boundary preset such as 135, 136, and 137 bytes so learners can predict when a second absorb block appears.

Success statement:

> SHA3-256 is a fresh sponge run with a 136-byte rate, `0x06` domain/padding, and a fixed 32-byte readout.

### Stage 2: SHAKE changes the output contract

Keep the same message, strength, rate/capacity diagram, and pipeline position. Highlight the two changes: SHAKE's domain suffix and extendable squeeze.

The output should look like one continuous byte runway. When the learner asks for more bytes:

- Existing bytes stay fixed in place.
- New bytes append to the right.
- Crossing 136 bytes in SHAKE256 visibly triggers another permutation.
- Ticks or presets mark `rate - 1`, `rate`, and `rate + 1`.

Ask for a prediction before first reveal:

> When output grows from 32 to 64 bytes, will the first 32 bytes change?

Then compute and compare. Raw hex can remain underneath as evidence.

Success statement:

> SHAKE does not rehash for a longer request; it continues squeezing the same run.

### Stage 3: cSHAKE makes the branch visible

This stage needs a two-route diagram.

Route A, both fields empty:

```text
N = empty, S = empty -> exact SHAKE route -> no cSHAKE prefix -> suffix 0x1f
```

Route B, either field non-empty:

```text
encode_string(N) + encode_string(S)
              -> bytepad(..., rate)
              -> framed prefix || message
              -> suffix 0x04
```

Show framing semantically first as labeled chunks with byte lengths. Put full hex and `left_encode` details behind an expert disclosure. Clearing `N` and `S` should visibly collapse Route B into Route A, not merely update a proof farther down the panel.

Use a namespace example that implies two protocol purposes, such as `Invoices/v1` and `Receipts/v1`. Show "different in this run" as the computed result and explain the domain-separation guarantee separately.

Success statement:

> cSHAKE either is exactly SHAKE, or it prepends an unambiguous namespace before the message. There is no half-fallback state.

### Stage 4A: KMAC authenticates exact parameters

Introduce KMAC by building visibly on Route B:

```text
cSHAKE function name = "KMAC"
customization = S
input = bytepad(encode_string(K), rate) || message || right_encode(L)
```

Avoid the shorthand "put the key before the message" until the complete framed construction is already visible. That shorthand is too close to the broken SHA-256 prefix-MAC shown later.

Turn the interaction into a clear three-step sequence:

1. Create tag.
2. Change one visible message byte.
3. Verify the held tag.

After tampering, show old and current message bytes with the changed byte marked. Then show held and recomputed tags. Keep the existing retired-verdict behavior and the explanation that only the exhibit, not a real verifier, knows which input changed.

Success statement:

> Verification compares a held tag with KMAC recomputed over this exact key, message, strength, customization, variant, and output length.

### Stage 4B: KMAC and KMACXOF make different length promises

Keep this as a second beat inside Stage 4 rather than mixing it into the tag workflow.

Use the same output runway from SHAKE:

- KMAC 256 vs 512: changing `right_encode(256)` to `right_encode(512)` changes the absorbed input, so even the first bytes differ.
- KMACXOF 256 vs 512: both absorb `right_encode(0)`, so the longer result preserves the shorter prefix.

Visually place the encoded suffix immediately before the output comparison. This makes the result causal rather than magical.

Success statement:

> KMAC binds a requested length; KMACXOF defines one extendable stream.

### Closing contrast: show missing state, not just numbers

The current structural table is useful but should follow a paired diagram:

```text
SHA-256(key || message)
full 256-bit chaining value is published
+ guessed key length and glue padding
-> computation can be resumed for an append forgery

KMAC
only rate bytes are exposed as output
capacity remains undisclosed as states evolve
-> the attacker does not possess a complete resumable state
```

Keep three precision guards beside it:

- The attacker may need to guess the key length.
- The result is a valid tag for an appended message, not recovery of the key.
- KMAC's safety is the standardized SP 800-185 framing plus the sponge security argument, not a license to invent arbitrary `sponge(key || message)` constructions.

Keep the full playable attack in the sibling labs.

## Rendered-page findings

The production screenshots reinforce the source-level diagnosis:

- On desktop, the first learner manipulation comes after the hero, three-paragraph introduction, call-counter explanation, and four-row mode table. The page establishes implementation provenance before it establishes the mechanism.
- The visible 5x5 lane table dominates Stage 1, while later stages rely on prose and nested hex comparisons. This makes the most detailed visual the least important layer of the stated lesson.
- Comparison panels, hex boxes, and verdict panels are nested inside equally weighted stage panels. The repetition makes evidence look like the lesson rather than support for it.
- Every computed result is present on first paint. Correctness is excellent, but there is little prediction, suspense, or learner-controlled reveal.
- Stage 4 is substantially longer than the other stages because parameter selection, tag creation, verdict state, verification scope, sponge structure, KMAC length binding, and KMACXOF continuation all share one surface.
- At phone width, the hero's retained `22rem` flex basis becomes vertical height after the layout changes to a column. It leaves a large blank gap between the description and the "Why it matters" panel.
- Dense four-column tables wrap technical explanations into very narrow columns on a phone. They are technically present and keyboard reachable, but they are not efficient teaching surfaces.
- The mobile page becomes an exceptionally long evidence stream. Nothing overlaps, but the learner must traverse lane data, repeated hex, and both length comparisons before reaching the closing contrast.

Responsive acceptance criteria should include more than absence of overlap:

1. The hero has no unexplained vertical void at 320px through 640px widths.
2. The first mechanism-level interaction is visible within the first two phone viewports.
3. Technical tables preserve readable column widths with deliberate horizontal scrolling or transform into labeled row comparisons; they never wrap prose one or two words per line.
4. Expert evidence is collapsed by default on mobile while the current stage, prediction, result, and next conceptual step remain visible.
5. Stage 4's tag workflow can be completed without scrolling through the length-contract evidence, and vice versa.

## Information architecture

The current page gives most sections similar visual weight and exposes a large amount of hex. A stronger hierarchy would have three layers:

1. **Guided layer:** one persistent pipeline, one changed rule, one prediction, one result.
2. **Evidence layer:** the two computed byte strings and their exact comparison.
3. **Inspect layer:** lane tables, complete framed bytes, formulas, call counts, specification references, and implementation links.

Use stage navigation or a visible progress rail so learners know where they are in the four-step argument. Preserve normal scrolling and deep links; do not turn the lab into a modal wizard that hides earlier evidence.

The page should never require raw hex to understand the result. Hex should verify the semantic visualization, not be the semantic visualization.

## Language guardrails

| Avoid | Prefer |
| --- | --- |
| "The same state does all four" | "Four fresh states use the same sponge construction and permutation" |
| "Input never touches capacity" | "Input is directly XORed only into rate; the permutation diffuses its influence through the whole state" |
| "Only framing changes" | "The permutation is shared; rate/capacity parameters, framing, suffix, and output contract define the mode" |
| "Sign message" | "Create tag" or "Authenticate message" |
| "The outputs are unrelated" as an observed verdict | "The outputs differ in this run" plus a separate domain-separation explanation |
| "Absorb a key before the message" | Show `bytepad(encode_string(K), rate) || message || right_encode(L)` |
| "Capacity alone means no HMAC" | "KMAC's standardized framing and the sponge's hidden capacity avoid Merkle-Damgard length extension" |
| "Empty cSHAKE framing is still absorbed" | "Empty N and S take the exact SHAKE path, with no cSHAKE prefix" |
| "Accepted means it came from the sender" | "Accepted means the recomputed tag matches under these exact shared-key parameters" |

## What not to add

Gold standard does not mean maximum feature count. Do not add:

- TupleHash or ParallelHash.
- A second playable length-extension attack.
- HMAC internals.
- A protocol using KMAC as a KDF.
- Collision content.
- Decorative lane motion or random state animation.
- A default walkthrough of all 24 Keccak rounds.
- More permanent output panels competing for attention.
- Production or constant-time claims.

The lesson should become narrower in attention even while it becomes deeper in explanation.

## Verification needed for the teaching layer

The existing cryptographic tests are a strong base. Add tests for visual truth and learner-visible causality:

1. Exact suffix location comes from trace metadata for messages containing suffix-like bytes.
2. The pre-permutation XOR view changes rate lanes only.
3. The post-permutation view demonstrates that capacity lanes can change.
4. Guided defaults keep SHA3/SHAKE/cSHAKE/KMAC at matching 256-strength rate/capacity settings.
5. cSHAKE empty `N,S` shows no framed prefix and reports suffix `0x1f`.
6. Non-empty cSHAKE shows a whole-rate framed prefix and suffix `0x04`.
7. A SHAKE output crossing the rate boundary visibly adds a squeeze permutation without changing its previous prefix.
8. KMAC's displayed 256- and 512-bit framing ends in different `right_encode(L)` values.
9. KMACXOF's displayed runs both end in `right_encode(0)` and preserve the prefix.
10. The selected KMACXOF path is checked against an independent implementation or official KAT at the browser-facing boundary.
11. A delayed SHA-256 computation cannot paint an old naive tag after any KMAC parameter changes.
12. No learner-facing control or verdict calls a MAC a digital signature.
13. Claims tests distinguish "different bytes observed" from the broader domain-separation rationale.
14. Mobile screenshots at the longest labels and outputs show no overlap, accidental nested panels, or hidden current step.
15. Both themes and reduced-motion mode cover every newly introduced guided and inspect state.

## Learner evaluation

Automated tests can prove that the page is truthful; they cannot prove that it teaches. Before calling the redesign gold standard, run a small think-aloud study with 5 to 8 learners who know hashes but have not studied Keccak.

Give them these tasks without telling them which control to use:

1. Predict whether SHAKE's first 32 bytes change when requesting 64 bytes.
2. Make cSHAKE produce exactly the same output as SHAKE and explain why.
3. Explain what changes when `S` changes and what the experiment itself did not prove.
4. Create a KMAC tag, alter the message, and explain the rejection without claiming sender identity.
5. Predict whether KMAC-256 is the prefix of KMAC-512, then contrast that with KMACXOF.
6. Explain why SHA-256(`key || message`) permits an append forgery while KMAC does not, without saying the key is recovered.
7. Point to where input enters the state, where output leaves it, and how input can still influence capacity.
8. Explain whether the four panels reuse one live state or four fresh states.

Target outcomes:

- At least 80% answer each prediction correctly after using the relevant stage once.
- At least 80% can explain the fresh-state/shared-construction distinction.
- No participant leaves calling KMAC a public-key signature.
- No participant describes the contrast as key recovery.
- Median time to complete the four-stage guided path is under 10 minutes.
- Experts can reach full framing bytes, lane states, test provenance, and specification language without cluttering the newcomer path.

Any repeated misconception should trigger a wording or visualization change, not another paragraph added at the bottom.

## Prioritized roadmap

### P0: Make every taught statement exact

- Replace signing terminology.
- Correct direct-I/O language around capacity.
- State fresh runs versus shared implementation.
- Separate observed byte differences from domain-separation claims.
- Fix suffix-offset metadata.
- Eliminate the asynchronous contrast race.
- Label permutation counts as total demo workload, including proof computations.

### P1: Build the persistent teaching spine

- Remove the mobile hero's accidental main-axis height and give narrow tables an intentional responsive treatment.
- Add the stable framing/absorb/permutation/squeeze pipeline.
- Synchronize the default path at 256 strength.
- Split XOR and permutation into distinct visual moments.
- Keep raw lanes and full hex as inspectable evidence.

### P2: Make each stage prove one delta

- SHAKE output runway with rate-boundary markers.
- cSHAKE fallback branch and semantic framing chunks.
- KMAC three-step tag workflow with message-byte diff.
- Separate KMAC/KMACXOF length-contract beat.
- Diagram the length-extension contrast as exposed versus hidden state.

### P3: Validate comprehension

- Add visual-semantic and race tests.
- Re-run accessibility across every new state.
- Conduct the learner study and revise against observed misconceptions.

## Definition of done

KMAC Gate is the gold standard when a newcomer can manipulate one stable sponge model through all four stages, predict each result before seeing it, and accurately explain:

- what is shared,
- what changes,
- what the capacity does,
- why SHAKE extends,
- when cSHAKE is exactly SHAKE,
- how KMAC frames a key,
- why KMAC and KMACXOF treat length differently,
- what tag verification establishes,
- and why the closing attack is length extension rather than key recovery.

The expert should be able to inspect every byte and state transition behind those explanations, but the newcomer should not need raw hex to understand any of them.
