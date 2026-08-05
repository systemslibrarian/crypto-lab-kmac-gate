# KMAC Gate

**Keyed Keccak · SP 800-185 / FIPS 202**

SHAKE, cSHAKE, and KMAC built on one Keccak-f[1600] sponge — the same permutation doing hash,
XOF, domain-separated XOF, and keyed MAC.

**Live demo:** https://systemslibrarian.github.io/crypto-lab-kmac-gate/

---

## What It Is

An interactive, browser-only demonstration that four cryptographic functions people usually meet
separately are one machine with four labels.

The primitives are real and hand-rolled, not called out to a library:

| Function | Spec | Rate / capacity | Domain suffix |
| --- | --- | --- | --- |
| **Keccak-f[1600]** | FIPS 202 §3.2 | — | — |
| **SHA3-256** | FIPS 202 | 136 / 64 bytes | `0x06` |
| **SHAKE128 / SHAKE256** | FIPS 202 | 168 / 32, 136 / 64 bytes | `0x1F` |
| **cSHAKE128 / cSHAKE256** | SP 800-185 §3 | as SHAKE | `0x04` |
| **KMAC128 / KMAC256 / KMACXOF** | SP 800-185 §4 | as cSHAKE | `0x04` |

Plus the SP 800-185 encoding functions the last two are framed with: `left_encode`,
`right_encode`, `encode_string` and `bytepad`.

**The "one sponge" claim is literally true in the code, and enforced by tests.** There is exactly
one `keccakF1600` function and exactly one `Sponge` class in `src/`; every mode reaches the
permutation through them. `src/keccak/architecture.test.ts` checks this two ways — behaviourally
(every mode moves the same shared call counter) and structurally (the source defines the round
function, the permutation and the sponge exactly once, and no mode module calls the permutation
directly).

**Security model.** The key is whatever you type; it lives in a text box and in memory for the
session, and is never persisted or transmitted. There is no backend, no network call, and no
storage beyond the theme preference.

**This is not production cryptography.** It is a teaching implementation whose priority is that
you can read it. The permutation uses BigInt arithmetic in a JIT-compiled runtime and tag
comparison is branch-free in shape only; neither offers any timing guarantee. Use a vetted
library for anything real.

## Exhibits

1. **The core — one permutation, counted.** A live count of Keccak-f[1600] invocations for the
   current render, broken down per stage, with the parts shown summing to the whole. Beside it, a
   table of the four modes' rate/capacity splits and domain-separation suffix bytes — the same
   message, four framings.
2. **Stage 1 — SHA3-256.** Type a message; watch it padded into 136-byte blocks, each XORed into
   the rate and permuted. The rate/capacity split is drawn to scale, and a stepper walks the
   blocks one at a time, showing the 5×5 lane grid after each permutation with changed lanes
   underlined. The padded block is shown with the domain suffix and the pad10*1 final bit marked
   as bytes you can point at.
3. **Stage 2 — SHAKE128/256.** A draggable output-length control from 16 to 512 bytes. The page
   squeezes the same message separately at a short length and compares byte-for-byte against the
   prefix of the long output, so "longer output is a continuation, not a rehash" is shown rather
   than asserted. A second check splits one squeeze in two and confirms the concatenation matches.
4. **Stage 3 — cSHAKE128/256.** Editable function name `N` and customization string `S`. Changing
   `S` by one character is shown producing an unrelated output. Separately and always, the page
   computes cSHAKE with empty `N` and `S` against plain SHAKE and shows the byte-level equality
   that proves the spec's fallback. The framed prefix cSHAKE absorbs is displayed as hex.
5. **Stage 4 — KMAC128/256 + KMACXOF (break it yourself).** Type a key and a message, sign it,
   verify it — then tamper and verify again, and watch the real verifier reject. Also computes
   output-length binding live: KMAC at 256 and 512 bits produces unrelated tags, while KMACXOF at
   the two lengths produces one as a prefix of the other.
6. **Why key it this way.** A compact closing panel placing KMAC beside a naive
   `SHA-256(key ‖ message)` MAC — both really computed — with the structural numbers that explain
   the difference.
7. **Scope.** What is real, what is not, and what is deliberately absent.

## When to Use It

- **Use KMAC** when you want a MAC or a KDF from a Keccak-family primitive: it is a NIST-approved
  construction (SP 800-185), it needs no HMAC-style nesting, and its customization string gives
  you domain separation for free.
- **Use KMACXOF** when you need arbitrary-length key material and want outputs at different
  lengths to extend one another.
- **Use cSHAKE** when two subsystems share a hash function and you need their outputs to be
  independent — the customization string makes each its own function.
- **Do NOT use `SHA-256(key ‖ message)` as a MAC.** Merkle–Damgård emits its chaining state as the
  digest, so a tag holder can append to the message and forge a valid tag for the longer message
  without the key. Use HMAC, or KMAC.
- **Do NOT use this code.** It is a teaching implementation, not a hardened one.

## Live Demo

https://systemslibrarian.github.io/crypto-lab-kmac-gate/

Type a message and watch one digest, one extendable output, and one domain-separated output come
out of the same state. Then key it: sign a message, verify it, tamper with one character, and
verify again to see the real primitive reject. Every number on the page is computed in your
browser during that run.

## What Can Go Wrong

- **Keying a Merkle–Damgård hash by prefixing.** The append/length-extension forgery. It is the
  reason HMAC exists, and the reason KMAC does not need it. The attack itself is played out in
  [crypto-lab-mac-race](https://github.com/systemslibrarian/crypto-lab-mac-race) and
  [crypto-lab-babel-hash](https://github.com/systemslibrarian/crypto-lab-babel-hash).
- **Reusing one XOF across subsystems.** Without a customization string, output meant for one
  purpose is valid output for another, and values can be replayed across the boundary.
- **Assuming a longer KMAC tag contains the shorter one.** It does not: KMAC absorbs
  `right_encode(L)`, so the requested length changes the input. KMACXOF is the variant with the
  prefix property. Stage 4 computes both.
- **Reading an accepted tag as more than it is.** Verification establishes that these exact bytes
  were authenticated under this exact key at these exact parameters. It says nothing about who
  computed it, when, or whether the message should be acted on — a replayed old message and tag
  verify perfectly.
- **Trusting a comparison that returns early.** A verifier that stops at the first mismatching
  byte leaks information through timing. The comparison here accumulates the XOR of every byte
  pair and tests once — the right shape, though JavaScript still makes no timing promise.

## Real-World Usage

KMAC is specified in NIST SP 800-185 and is the MAC and KDF of choice in Keccak-based designs,
including CNSA 2.0-aligned and post-quantum key schedules where a SHA-3-family primitive is
already present. cSHAKE's domain separation is the same mechanism ML-KEM and ML-DSA rely on to
keep their internal hash uses independent. (This demo builds the primitives only; no protocol is
built here.)

## How to Run Locally

```bash
npm ci
npm run dev            # http://localhost:5173/crypto-lab-kmac-gate/
npm test               # 237 unit tests, including 21 spec KATs
npm run build          # tsc --noEmit && vite build
npm run test:browser   # 48 Playwright tests: axe WCAG gate + claims suite
```

`npm run test:browser` builds first, then serves `dist/` on port 4646, so what is tested is what
ships.

## Related Demos

- [crypto-lab-mac-race](https://systemslibrarian.github.io/crypto-lab-mac-race/) — the
  length-extension forgery as a playable attack
- [crypto-lab-babel-hash](https://systemslibrarian.github.io/crypto-lab-babel-hash/) — hash
  construction internals and their failure modes
- [crypto-lab-collision-vault](https://systemslibrarian.github.io/crypto-lab-collision-vault/) —
  collision resistance
- [crypto-lab-hash-zoo](https://systemslibrarian.github.io/crypto-lab-hash-zoo/) — the hash
  function landscape

## Build & Verify

**237 unit tests (Vitest), of which 21 are spec known-answer tests.**

| Suite | File | What it covers |
| --- | --- | --- |
| Permutation | `src/keccak/keccak-f1600.test.ts` | ρ offsets and ι round constants **derived** from their FIPS 202 definitions and asserted equal to the published tables; the all-zero-state vectors |
| FIPS 202 KATs | `src/keccak/fips202.test.ts` | 4 SHA3-256 + 2 SHAKE known answers, rate-boundary inputs, the prefix property |
| SP 800-185 KATs | `src/keccak/sp800-185.test.ts` | 4 cSHAKE + 11 KMAC/KMACXOF sample values, the encoding functions, the SHAKE fallback |
| Cross-oracle | `src/keccak/oracle.test.ts` | agreement with **two independent implementations** — OpenSSL via `node:crypto` for FIPS 202, `js-sha3` for SP 800-185 — across message lengths straddling both rate boundaries |
| Architecture | `src/keccak/architecture.test.ts` | the "one sponge" claim, behaviourally and structurally |
| Demo layer | `src/demo/*.test.ts` | sign/verify accept and every reject path, verdict retirement and the no-op guard, trace fidelity, the run report's parts-sum-to-whole |

`js-sha3` and `node:crypto` are **test-only oracles**. Neither is imported by the app bundle,
which is hand-rolled down to the permutation.

**48 browser tests (Playwright).** `e2e/a11y.spec.ts` runs `@axe-core/playwright` against the
production build for zero WCAG 2.1 A/AA violations in **both themes** across **six interaction
states** each (first paint, mid-trace, cSHAKE fallback, tag accepted, verdict retired, tag
rejected), plus an arithmetic contrast sweep that measures every text node against the surface it
is actually drawn on, a `[hidden]` leak probe, and a keyboard-reachability check on every
scrollable region. `e2e/claims.spec.ts` checks the page cannot claim what it did not compute:
every headline value is re-derived independently, every failure path is exercised, and verdict
retirement and its no-op guard are asserted.

The accessibility gate blocks the deploy: `.github/workflows/deploy.yml` runs the unit tests, the
typechecked build, and the browser suite before publishing.

## Performance

Every mode is computed synchronously on each keystroke. A typical render runs the permutation
about 26 times across all four stages — well under a millisecond of Keccak work — so the page
recomputes everything from scratch rather than caching, which is also what keeps any two panels
from describing different runs. The BigInt implementation is considerably slower than an
optimised 32-bit-lane one; that is a deliberate trade for readability.

---

*One of 120+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
