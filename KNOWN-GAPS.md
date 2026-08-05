# Known gaps

What this demo deliberately does not build, and where the coverage lives instead. Each item is a
scoping decision, not an oversight.

## Unbuilt SP 800-185 siblings

- **TupleHash / TupleHashXOF (SP 800-185 §5).** Hashes a *sequence* of strings unambiguously, so
  that `("abc", "d")` and `("ab", "cd")` cannot collide — the same `encode_string` framing shown
  in stage 3, applied per element. Not built here.
- **ParallelHash / ParallelHashXOF (SP 800-185 §6).** Splits a long input into fixed-size blocks,
  hashes each independently with cSHAKE, then hashes the concatenated chaining values. Built for
  throughput on multi-core hardware. Not built here.

Both ride the same cSHAKE core this demo already exposes, so adding either is framing work rather
than new cryptography.

## Out of scope by design

- **The length-extension attack as a playable exploit.** This demo states the contrast between
  KMAC and `SHA-256(key ‖ message)` structurally, in one closing panel. The interactive forgery
  lives in [crypto-lab-mac-race](https://github.com/systemslibrarian/crypto-lab-mac-race) and
  [crypto-lab-babel-hash](https://github.com/systemslibrarian/crypto-lab-babel-hash). Note the
  precise claim: the weakness is an **append/length-extension forgery**, never key recovery.
- **HMAC.** The construction KMAC makes unnecessary. Covered by its own sibling demos.
- **SHA-3 collision resistance.** See
  [crypto-lab-collision-vault](https://github.com/systemslibrarian/crypto-lab-collision-vault).
- **KMAC as a KDF inside a full protocol.** CNSA 2.0 and post-quantum key schedules use KMAC this
  way; that context is mentioned on the page, but no protocol is built here — only the primitive.
- **A production-hardened or constant-time Keccak.** The permutation is written for readability:
  BigInt lanes, derived tables, no side-channel hardening. The page and README say so plainly.

## Implementation limits

- **Whole-byte outputs only.** FIPS 202 and SP 800-185 define bit-level output lengths; this
  implementation rejects a KMAC length that is not a multiple of 8 rather than silently rounding.
- **Rates are whole lanes.** The sponge requires a rate that is a multiple of 8 bytes. Every
  FIPS 202 / SP 800-185 rate satisfies this (168 = 21 lanes, 136 = 17 lanes); a partial-lane XOR
  path would be unreachable code.
- **Key entry is UTF-8 text, not raw bytes.** Convenient for a demo; a real KMAC key is a byte
  string of a chosen length.
