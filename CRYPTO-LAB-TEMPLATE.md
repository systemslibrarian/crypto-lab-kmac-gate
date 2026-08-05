# Crypto Lab — Master Template & Standard

_The single source of truth for how every `crypto-lab-*` demo is **built**, how it **teaches**, and how it **looks**. Folds together the `BUILD-TEMPLATE`, the `PROMPT-standardize` pass, and the `ADA` WCAG accessibility-gate spec — brought up to date (Actions-based Pages deploy, the CI accessibility gate, the standardized hero, and the pedagogy standard from the fleet teaching review)._

Lifecycle: **Build → Teach → Look → Accessibility → README → Deploy.**

---

## What changed in this revision (2026-08-04)

Read this if you are working from an older copy. Each item comes from a defect found in the
live fleet, not from a style preference.

1. **§3.0 — the shared top bar is RETIRED.** `reapply-header.py`, `shared-header.html` and the
   `<!-- BEGIN/END crypto-lab shared header -->` markers are archived. **Each lab now owns its
   own header**; copy one from a sibling. Do not add the markers to a new lab.
2. **§0.7 — the "claim-complete" bar is now the fleet standard.** Every claim computed from
   that run; every verdict stating only what the protocol learned; failure states tested, not
   just visited; **verdicts retire when their inputs change**. No demo has yet scored 10/10.
3. **§4.1 — the Playwright webServer must BUILD before serving**, and `build` must include
   `tsc --noEmit`. Otherwise a failed build leaves the previous bundle and the suite passes
   green against code that no longer compiles. This invalidated real verification work.
4. **§4.1 — the a11y helper was wrong in two ways.** It injected `transition:none` (which makes
   the suite structurally blind to transition and theme-swap defects) and it stripped `[hidden]`
   and forced `display` (which hides a real, common bug). Both removed; a failing `[hidden]`
   probe replaces the second. Also: **`test.use({ reducedMotion })` silently does nothing** on
   Playwright 1.61.1 — use `page.emulateMedia` and assert it landed.
5. **§4.1 — wait for async content before scanning.** A scan that races the page checks an
   empty container and passes. Treat a flaky a11y test as a coverage hole until proven
   otherwise; closing one race exposed a genuine AA failure.
6. **§4.1 — axe is not a complete contrast oracle.** It under-reports nodes and refuses to
   compute contrast over a background gradient at all. Measure ratios arithmetically, against
   the surface the text is actually drawn on rather than white.
7. **§4.1b / §4.1c — new required artifacts:** `e2e/claims.spec.ts`, and mutation discipline to
   prove the tests bite. Commit real work *before* mutating.
8. **§5 — ship a `LICENSE`** (MIT) and a root `.gitignore`. 156 of 176 repos had no license,
   so the default was exclusive copyright.
9. **Ports** moved to the 4600–4700 range and must be unique **in committed state**; a fix that
   is only in the working tree is not a fix.

---

## How to use this template with a coding AI

Point your coding AI (Claude Code, Opus, etc.) at this file and have it build to the standard. **The template is the spec; you supply only the demo-specific facts.**

### Step 1 — Fill in the demo brief

Copy this block and fill the bracketed values (leave everything else):

```
NEW DEMO BRIEF
- Repo name:         crypto-lab-[demo-name]
- Short name (H1):   [e.g. OPAQUE, KDF Arena, X3DH]
- Subtitle:          [spec/expansion, e.g. aPAKE · RFC 9807]
- One-liner:         [one sentence naming the primitive(s); no marketing language]
- Concept to teach:  [the single "aha" a learner should walk away with]
- Primitives/spec:   [RFC/FIPS/paper refs, or "classical cipher — n/a"]
- Accent (--accent): [hex]
- Favicon emoji:     [one emoji]
- In scope:          [the exact algorithms/attacks/variants to build]
- Non-goals:         [what is explicitly OUT of scope]
```

### Step 2 — Give the AI this kickoff prompt

Paste this prompt together with the filled brief. (In Claude Code / any agent that can read files, keep `CRYPTO-LAB-TEMPLATE.md` in the repo so it can read it directly; otherwise paste this file's contents above the prompt.)

```
Build a new Crypto Lab browser demo (Vite + TypeScript, static site, no backend).

Read CRYPTO-LAB-TEMPLATE.md in full and treat it as the BINDING spec. Build to
every standard in it, in this order:

  1. §1 Build — real crypto only (WebCrypto or a named, justified library; hand-roll
     the inspectable teaching parts; NEVER simulate or fake math). Runnable tests that
     actually pass, including spec KATs (state the count). Mount content at id="app";
     define --accent on :root.
  2. §3 Look — COPY the top bar from an existing sibling lab and adapt it (each lab owns
     its own; there is no shared header script — see §3.0), plus the standardized hero
     (short-name <h1> + spec subtitle + "Why it matters" box beside it; title size capped
     at clamp(1.6rem,3.8vw,2.7rem)); theme contract; scripture footer; head/favicon.
     Do NOT add <!-- BEGIN/END crypto-lab shared header --> markers; that tooling is retired.
  3. §2 Teach — SHOW the one headline mechanism (animate/step it, never assert it in
     prose or raw hex); add a plain-language "what is this / why it matters" intro and a
     break-it-yourself interaction against the real crypto; no decorative/idle animation;
     pitch to a college newcomer while rewarding an expert (progressive disclosure).
  4. §4 Accessibility — wire the WCAG 2.1 AA gate and author to its checklist.
     `npm run build` then `npm run test:browser` MUST pass with zero violations in BOTH
     themes. The Playwright webServer must BUILD before serving (§4.1), and "build" must
     be `tsc --noEmit && vite build`.
  4b. §4.1b/§4.1c — write e2e/claims.spec.ts (the page must not claim anything it did not
     compute; verdicts retire when inputs change) and MUTATION-CHECK it: invert a
     condition in the source, confirm the build still succeeds AND the bundle hash
     changes AND the owning test fails, then restore.
  5. §5 README (the standard sections), a LICENSE file, a root .gitignore, and §6 Deploy —
     use the canonical deploy.yml from §6 VERBATIM (filename, two-job split, Node 22,
     npm ci included), and pick a unique local preview port per §4.1 (never 4173).

Hard rules: do NOT dumb down the crypto to make a visual simpler; honest scoping in-page
and in the README ("not production", what's real vs simulated, what it does NOT prove).
Every claim on screen must be computed from that run, every verdict must state only what
the protocol actually learned, and no verdict may outlive the input that produced it.
When done, report a one-line summary stating: unit-test count, spec-KAT count, browser-test
count, confirmation the a11y gate passed in BOTH themes against the production build, and
the mutation-check result (which test failed, and that the bundle hash changed).

DEMO BRIEF:
[paste the filled NEW DEMO BRIEF block here]
```

### Standardizing an existing demo instead

If the demo already exists and only needs to match the fleet, tell the AI: *"Read CRYPTO-LAB-TEMPLATE.md and apply §3 (Look), §4 (Accessibility), §5 (README), and §6 (Deploy) to this repo. Do not touch the cryptographic logic (§1) or invent new content — chrome, a11y, README, and deploy only."*

---

## 0. Principles (non-negotiable)

1. **Real crypto only.** Use WebCrypto (`SubtleCrypto`) or a named, justified library for the actual operations. Never simulate or fake math. For the primitive that *is* the teaching subject, hand-roll the inspectable internals rather than hiding them in a library — transparency is the point. Known-answer tests (KATs) from the spec must pass.
2. **Honest scoping.** Every demo says, in-page and in the README: what's real vs simulated, what it does **NOT** prove, and "not production crypto — a teaching demo." No marketing language.
3. **Teach the college baseline; reward the expert.** Plain-language on-ramp for a motivated newcomer, with depth/rigor/caveats available on demand (progressive disclosure). **Never dumb down the crypto to reach the beginner** — simplify the *explanation*, never the math.
4. **Accessible.** WCAG 2.1 AA, in **both** themes, **gated in CI**. Non-negotiable.
5. **Consistent chrome fleet-wide.** Standardized hero + scripture footer, and a top bar built to
   the same spec — but **each lab owns its own copy** of the header (see §3.0; the old
   script-pushed shared header is retired).
6. **No backend.** Everything runs in the browser; any key/secret material is per-session in memory, never persisted. Ships as a static site to GitHub Pages.
7. **Claim-complete.** *(Added 2026-08 — this is now the bar the whole fleet is measured
   against, and no demo has yet scored 10/10 on it.)*
   - **Every claim on the page is computed from THAT run.** Not hardcoded, not a stored
     constant, not carried over from a previous run with different inputs.
   - **Every verdict states only what the protocol actually learned.** A VRF verifier learns
     "this proof verifies under this key for this input" — not "the output is random". A
     timing measurement is evidence under *this* environment and sample size, not proof of
     exploitability. QKD detects *excess disturbance*, which channel noise also causes — it
     does not detect "an eavesdropper". Overstating here is the most common defect found.
   - **Every important state is TESTED, not merely visited.** Failure paths matter as much as
     success paths: the rejected proof, the tampered share, the threshold not met.
   - **No verdict outlives the input that produced it.** If the learner edits an input, a
     displayed verdict must **retire** — say so and name the control that regenerates it —
     rather than sit there endorsing a run that no longer exists. Never silently blank it: an
     empty panel reads as "nothing happened". This single bug class has been found in more
     labs than any other.
   - **A demo may not contradict itself.** Two panels on one screen must not describe
     different runs. One lab printed "signature verifies" in Exhibit 4 for the very link
     Exhibit 2 was reporting as broken.

---

## 1. Build a new demo

Vite + TypeScript, static to GitHub Pages, no backend. This pass produces the demo's **cryptographic logic, UI, and in-page content only** — the chrome (§3), README (§5), and deploy (§6) are applied afterward. Two demo-side prerequisites the later passes need:
- Mount app content at `id="app"`.
- Define `--accent` on `:root` (in both palettes if light/dark exist).

Fill these seven sections for the specific demo, then build:

- **SCOPE** — exact algorithms/attacks/variants that are IN; explicit NON-GOALS (each gets a one-line "what this isn't" note in the UI).
- **SECURITY / CORRECTNESS INVARIANTS** — a numbered list the architecture *embodies*, not merely describes. For attack demos: fail-closed rules + strict isolation of any deliberately-vulnerable mode (never the default, visibly marked broken). For non-attack demos: KATs pass, constant-time where claimed, strict parsing, independent validations reported independently. **If an invariant conflicts with a feature, the invariant wins.**
- **ARCHITECTURE** — small, separately-testable modules; keep the inspectable crypto isolated (`src/<domain>/<primitive>.ts`, `types.ts`, `<verify|attack>.ts`, `src/ui/`).
- **UI** — the panels/controls and the single core interaction that produces the "aha." Name the central metaphor/toggle and the step-by-step user action. Stacks < 640px.
- **VISUAL SEMANTICS** — precisely what correct-vs-broken looks like. Color tracks **system integrity / correctness**, not the raw return value (a forged-but-accepted result reads as ALARM, not green success). Never convey state by color alone — always icon + text + color (WCAG 1.4.1); verify in grayscale and deuteranopia.
- **EDGE CASES** — enumerate malformed/boundary inputs and the exact fail-closed behavior; each teaches via a tooltip.
- **EXTENSION SEAMS** — the likely future extension and the 1–3 places to shape now (mark with `// [extension] point`). Don't build it yet.

**Testing:** runnable tests (Vitest), actually executed. Cover round-trips, spec KATs, correct-path accepts good / rejects every bad, and (for attack demos) a passing test that the vulnerable path exhibits the flaw. Tests live **colocated in `src/` as `*.test.ts`** — not a top-level `test/` or `tests/` dir (the include pattern below depends on it). **Exclude `e2e/` from the Vitest run** (`test.include: ['src/**/*.test.ts']`) so Playwright specs don't get collected.

**Scripts:** `"build": "tsc --noEmit && vite build"` — the typecheck rides inside `build`, so it gates every local build and the deploy without a separate CI step. `"test": "vitest run"`, `"dev": "vite"`, `"preview": "vite preview"`.

**Definition of done:** `npm run dev` serves it; the core interaction produces the "aha"; tests pass (state count + coverage); content mounts at `#app`; `:root` defines `--accent`. No header/hero/README/footer here — those are §3–§6.

---

## 2. Teach — the pedagogy standard

From the fleet teaching review. A demo can be perfectly correct and still teach badly. Score every demo on six lenses; aim high on all six:

1. **Narrative clarity** — what-it-is and why-it-matters in plain language, up front.
2. **Intuition via interaction** — poking at it builds a mental model; not a toy with knobs.
3. **Progressive disclosure** — simple first, complexity layered; not everything at once.
4. **Visualization quality** — visuals **illuminate the mechanism**, not decorate.
5. **Newcomer accessibility** — jargon introduced, not assumed.
6. **Teaching honesty** — teaches the truth; never oversimplifies into something false.

The recurring failure across the fleet is **"tell, not show."** Fix it with these, in priority order:

- **Show the one headline mechanism.** Animate/step-through the single idea the demo exists to teach — the homomorphism `Enc(a)⊞Enc(b)=Enc(a+b)`, the DH exponent-tower collapsing to `g^(ab)`, the polynomial through the points, noise creeping toward the ceiling. Never assert it in prose or raw hex.
- **Break-it-yourself against real crypto.** Let the learner *cause* the failure (reuse a nonce, forge a signature the real verifier rejects, type a candidate secret that fits). A button that the genuine primitive accepts/rejects teaches far more than a warning banner.
- **A plain-language "what is X / why it matters" intro** on every demo (2–4 sentences, zero math, before any hex or slider). This is the single highest-leverage fix.
- **Compute-both-sides-and-compare**, not assert — show byte-for-byte equality with pass/fail coloring.
- **Decorative motion is banned.** No idle/looping animation that represents nothing (`Math.random()` "wire rain", perpetual pulses). Motion must be purposeful — tied to an action or illustrating the mechanism — or it doesn't ship.
- **Visual honesty.** Never draw a picture that contradicts the taught property (a smooth interpolating curve for Shamir over F_p, a straight chord over a finite field). Default to the real discrete object; if you draw an illustrative simplification, label it as one.

Audience calibration: **college newcomer at the baseline, professional cryptographer rewarded on demand.** The expert-facing rigor lives in honesty + the shown mechanism; the beginner on-ramp is the intro card + jargon scaffolding.

---

## 3. Look — the visual standard

### 3.0 Top bar — **each lab owns its own** (changed 2026-08; read this if you have an older copy)

> **This section was rewritten.** Earlier versions of this template said the top bar was one
> canonical managed snippet pushed from the catalog by `reapply-header.py`, fenced by
> `<!-- BEGIN/END crypto-lab shared header -->` markers. **That approach is retired.**
> `reapply-header.py`, `apply-header.sh`, `shared-header.html` and the rollout verifiers now
> live in `crypto-lab/archive/header-rollout/`. **Do not resurrect them, and do not add the
> BEGIN/END markers to a new lab.** A fleet-wide overwrite driven from one repo caused more
> damage than the drift it prevented.

**Each lab owns its own header.** For a new demo: **copy the header markup and CSS from any
existing lab and adapt it.** That is the intended workflow, not a fallback.

- Changing one lab's header: edit that lab.
- A change every lab should get: a deliberate reviewed pass across the repos, never a script
  driven from the catalog.

If you see `<!-- BEGIN crypto-lab shared header -->` or `/* BEGIN cl-hero standard */` in a lab,
it is a leftover from the old pass (five labs still carry them as of 2026-08-04) — remove the
**marker comments**, keep the header itself.

**What the header must provide** (build these into the lab's own copy):
- a "Skip to content" link targeting `#app` (WCAG 2.4.1);
- a sticky, **always-dark** (`#0b1512`) bar with fully self-contained styles, tinted by the lab's `--accent`;
- brand / Menu / GitHub links (the GitHub link is where `__REPO__` lands);
- the theme toggle **`#cl-theme-toggle`** (☀/☾) that flips `data-theme` on `<html>` and persists `localStorage['theme']`;
- JS that demotes any other `role="banner"` / top-level `<header>` to `role="group"`, keeping a single banner landmark;
- CSS that auto-hides a legacy lab's own toggle matching `#theme-toggle, #themeToggle, .theme-toggle, .theme-toggle-btn, [data-theme-toggle]` (the element stays in the DOM so old theme JS keeps working — but a **new** demo simply doesn't build a toggle at all: the anti-flash script in §3.2 plus the bar's toggle are the entire theme system).

The header expects four things from the demo:
1. **Skip-link target** — a content wrapper with `id="app"`.
2. **Theme contract** — the toggle flips `data-theme` on `<html>` between `dark`/`light` and stores `localStorage['theme']`; page renders correctly for both, **dark default**.
3. **Brand accent** — `:root` defines `--accent` (set to the demo's catalog accent; the bar silently falls back to teal `#35d6bb` if undefined — a missing `--accent` is why a bar looks wrong).
4. **Single banner** — the header JS auto-demotes any other `role="banner"`/top-level `<header>` and hides the lab's own toggle; leave the lab's element, don't delete it.

### 3.1 The hero (standardized — the recognizable name, one size fleet-wide)

Directly below the top bar. The hero carries **three distinct text roles** (keep them distinct — the common mistake is making the description and the why-box say the same thing) plus a standardized **"Why it matters" box**. Exactly **one `<h1>`** on the page = the hero title.

**Layout** — the title block is on the **left** (title → spec → description, top to bottom); the **"Why it matters" box is to the side** (right on desktop, drops below on mobile):

```
┌──────────────────────────────┬──────────────────┐
│  TITLE            (short name)│  WHY IT MATTERS  │
│  spec · label     (subtitle)  │  2–3 sentences   │  ← box to the side
│  one-sentence description      │  on the stakes   │
│  of what the demo demonstrates │                  │
└──────────────────────────────┴──────────────────┘
        (on mobile the box stacks below the title block)
```

- **Subtitle** (`.cl-hero-sub`) — the *spec/qualifier label* only: `aPAKE · RFC 9807`. Not a sentence.
- **Description** (`.cl-hero-desc`) — one sentence answering **what** this demo demonstrates / what you'll see and do here (mechanism-oriented, concrete).
- **Why it matters** (`.cl-hero-why`) — 2–3 sentences on the real-world **stakes** / why a learner should care (motivation, consequence). Never a restatement of the description.

```html
<header class="cl-hero">
  <div class="cl-hero-main">
    <h1 class="cl-hero-title">OPAQUE</h1>
    <p class="cl-hero-sub">aPAKE · RFC 9807</p>
    <p class="cl-hero-desc">Runs the real OPRF → encrypted envelope → 3-message handshake so you can watch a login where the server never sees your password.</p>
  </div>
  <aside class="cl-hero-why" aria-label="Why it matters">
    <span class="cl-hero-why-label">WHY IT MATTERS</span>
    <p class="cl-hero-why-text">Breaches leak billions of credentials — OPAQUE makes the server unable to leak what it never had.</p>
  </aside>
</header>
```

- **Title split:** big title = the concise scheme/primitive/brand name only (`OPAQUE`, `KDF Arena`, `X3DH`, `Paillier`; branded demos like `Iron Letter` keep the brand). Subtitle = the qualifier/spec/expansion, one line, **preserving technical casing** (`aPAKE · RFC 9807`, never `APAKE`). Separator `·`.
- **Size is capped at `clamp(1.6rem, 3.8vw, 2.7rem)`** — the `crypto-lab-x3dh-wire` scale, the maximum. Do not exceed it. This is what makes verbose and terse names read as siblings.

Standard CSS (under a marked managed block; map colors to the demo's own theme vars so it passes AA in both themes):

```css
/* BEGIN cl-hero standard — managed, keep in sync across fleet */
.cl-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:clamp(1rem,4vw,3rem);flex-wrap:wrap;margin:clamp(1rem,3vw,2rem) 0 1.5rem;}
.cl-hero-main{flex:1 1 22rem;min-width:min(100%,20rem);}
.cl-hero-title{margin:0;font-size:clamp(1.6rem,3.8vw,2.7rem);font-weight:700;line-height:1.1;letter-spacing:.01em;}
.cl-hero-sub{margin:.4rem 0 0;font-size:clamp(.9rem,1.6vw,1.05rem);letter-spacing:.01em;opacity:.85;}
.cl-hero-desc{margin:.55rem 0 0;font-size:1rem;line-height:1.5;color:var(--text-dim);max-width:60ch;}
.cl-hero-why{flex:0 1 min(40%,26rem);min-width:min(100%,15rem);border:1px solid var(--border);border-radius:10px;padding:.85rem 1.05rem;background:color-mix(in oklab,var(--accent) 6%,transparent);}
.cl-hero-why-label{display:block;font-size:.68rem;font-weight:700;letter-spacing:.14em;}
.cl-hero-why-text{margin:.35rem 0 0;font-size:.95rem;line-height:1.5;}
@media (max-width:640px){.cl-hero{flex-direction:column;}.cl-hero-why{flex-basis:auto;width:100%;}}
/* END cl-hero standard */
```

### 3.2 Theme contract (anti-flash)

In `<head>`, **before** any `<link>`/`<style>`:

```html
<script>
  (function () {
    const saved = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', saved ?? 'dark');
  })();
</script>
```

Dark default. **Never use `prefers-color-scheme`.** The stylesheet defines its full palette under `:root` (dark) with overrides under `:root[data-theme="light"]`. Don't build a second toggle or duplicate the header's flip/persist logic in `src/main.ts`.

### 3.3 Scripture footer (last visible element)

```html
<footer class="scripture-footer">
  <p>
    Related demos:
    <a href="https://systemslibrarian.github.io/crypto-lab-<sibling>/">crypto-lab-<sibling></a> ·
    <a href="https://systemslibrarian.github.io/crypto-lab-<sibling>/">crypto-lab-<sibling></a>
  </p>
  <p>So whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31</p>
</footer>
```

The **Related demos** line links the sibling labs the brief points to (typically the ones its Non-goals defer to) — 2–5 links, `·`-separated. The scripture line is **verbatim** (exactly this wording — no KJV variants), exactly once, visible in both themes, styled only with existing CSS vars (`--border`, `--text-dim`/`--text-muted`). Matches the README's closing line.

### 3.4 Page `<head>` & favicon

- **Title:** `[Demo Name] — crypto-lab` (same human name as the catalog card / README H1).
- **Meta description:** exactly one, one sentence, naming the primitive(s), no marketing.
- **Social meta (required):** Open Graph + Twitter tags mirroring the title and meta description — `og:type` (`website`), `og:title`, `og:description`, `og:url` (the live Pages URL), `twitter:card` (`summary`), `twitter:title`, `twitter:description`. No image tag needed.
- **Favicon:** a single **inline `data:` URI emoji** (immune to the subpath-404 trap):
  ```html
  <link rel="icon" type="image/svg+xml"
    href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔒</text></svg>" />
  ```
  Remove any `href="/favicon.svg"`-style root-absolute favicon. `lang="en"`, `charset`, `viewport` present.

---

## 4. Accessibility (WCAG 2.1 AA — gated in CI)

Accessibility is **enforced, not aspirational**: `@axe-core/playwright` scans the *production build* for zero WCAG 2.1 A/AA violations in **both** themes, and the GitHub Pages deploy is blocked if it fails. This is the `ADA` gate spec.

### 4.1 Wiring the gate

**Dependencies:** `npm i -D @playwright/test@^1.61.1 @axe-core/playwright` (pin to a current build to dodge the corrupt-cache install loop).

**`playwright.config.ts`** — runs against `vite preview`, so what passes is what ships:

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:<PORT>/<REPO-BASE>/', // if vite base is "./", use http://localhost:<PORT>/
    colorScheme: 'dark',                              // scan the real dark default; the toggle reaches light
  },
  webServer: {
    // BUILD, then preview. Never `preview` alone — see the stale-bundle trap below.
    command: 'npm run build && npm run preview -- --port <PORT> --strictPort',
    url: 'http://localhost:<PORT>/<REPO-BASE>/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

**The stale-bundle trap — the single most expensive mistake in this fleet.** Playwright serves
`dist/`. If the command is `preview` alone, a *failed build leaves the last good bundle in
place* and the whole suite passes green against code that no longer compiles. Two separate
verification exercises silently proved nothing this way. Two rules follow:

1. `webServer.command` must **build before serving** (as above).
2. `"build"` in `package.json` must be `tsc --noEmit && vite build`, so a type error fails the
   build instead of quietly serving yesterday's bundle.

`<PORT>`: pick one **no sibling lab already uses**. The fleet has since been renumbered into the
**4600–4700** range (4603, 4608, 4622, 4668–4673, 4709 …). Grep every sibling before choosing:

```
grep -rhoE "localhost:[0-9]+" ../crypto-lab-*/playwright.config.ts | sort -u
```

**Never the Vite default 4173.** With 170+ labs side by side, a shared port means
`reuseExistingServer` silently scans a *different lab's* preview — which has really happened
here and produced confident, wrong results. Check ports in **committed** state
(`git show HEAD:playwright.config.ts`), not the working tree: a fix that is only local is not a
fix, and that exact mistake made a "collisions eliminated" claim false for five repos.

**Rename completely.** `baseURL`, the `--port` flag, and `webServer.url` must all agree, and the
old port must appear **nowhere** in the repo — including `.mjs` harnesses, `.yml` workflows,
`package.json` scripts, the README, and any `e2e/*.spec.ts` that hardcodes an origin. A partial
rename is worse than none. Better: derive the origin in specs from Playwright's `baseURL`
fixture so there is only one place to change.

**`retries`**: note that a non-zero retry count hides flakiness rather than reporting it. When
investigating a flake, re-run with `--retries=0` **and run that suite alone** — suites here have
measured 5 flaky tests under CPU contention and 0 when run by themselves.

**`e2e/a11y.spec.ts`** — reveal collapsed/animated/injected content and drive the live demo so dynamic result regions get scanned, then assert zero violations in both themes:

```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

// Settle motion through the page's OWN prefers-reduced-motion block, and PROVE it landed.
// `test.use({ reducedMotion: 'reduce' })` SILENTLY DOES NOTHING on Playwright 1.61.1 — the
// page still reports matches === false — so a suite relying on it runs with every transition
// live while reading as if it settled them.
async function settleMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation did not reach the page',
  ).toBe(true)
  // Removing an injected `transition:none` can expose a real animation-drain race
  // (one lab returned ~516 running animations taking ~600ms to settle). Poll it out.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
}

// Wait for what the scan is SUPPOSED to check. A page that paints asynchronously — a slow
// hash, an FHE keygen, a proof, a worker — will otherwise be scanned EMPTY, and pass having
// checked nothing.
async function awaitLiveContent(page: Page): Promise<void> {
  await expect(page.locator('<the last thing the async work writes>')).toHaveCount(N, { timeout: 60_000 })
}

async function prepare(page: Page): Promise<void> {
  await settleMotion(page)
  await awaitLiveContent(page)
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => ((d as HTMLDetailsElement).open = true))
  })
}
async function scan(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5) })),
  ).toEqual([])
}
test('no WCAG A/AA violations — dark theme', async ({ page }) => {
  await page.goto('.'); await prepare(page); await scan(page)
})
test('no WCAG A/AA violations — light theme', async ({ page }) => {
  await page.goto('.'); await page.locator('#cl-theme-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await prepare(page); await scan(page)
})
```

**Four things the old version of this template got wrong. Do not reintroduce them.**

1. **Never inject `transition: none` / `animation: none`.** It deletes the thing the gate is
   meant to check: while it is present the suite is *structurally incapable* of seeing a
   transition or theme-swap defect. Settle motion with `emulateMedia` as above.
2. **Never strip `[hidden]` or force `display` on panels before scanning.** The old helper did
   exactly that, which hides a real and common bug: the UA rule `[hidden]{display:none}` loses
   to **any** author `display`, so a panel that ships `hidden` but whose class sets
   `display:grid/flex/block` renders anyway and every `el.hidden = true` is a silent no-op.
   Found live in three labs (six result regions painted before the learner ran anything).
   Add a **probe that fails** instead:

   ```ts
   test('nothing carrying the hidden attribute is still painted', async ({ page }) => {
     await page.goto('.')
     const leaks = await page.evaluate(() =>
       Array.from(document.querySelectorAll<HTMLElement>('[hidden]'))
         .filter((el) => getComputedStyle(el).display !== 'none')
         .map((el) => el.id || el.className))
     expect(leaks).toEqual([])
   })
   ```
3. **Wait for async content.** See `awaitLiveContent`. A scan that races the page passes on an
   empty container — this hid a genuine AA failure behind a gate that looked green, and read
   as mere "flakiness" for weeks. **Treat a flaky a11y test as a coverage hole until proven
   otherwise.**
4. **axe is not a complete contrast oracle.** It **under-reports nodes** (with two elements
   below AA it named exactly one) and it **refuses to compute contrast over a background
   gradient**, dropping those nodes into `incomplete` where a violations-only assertion never
   sees them — a blind spot that hid two real AA failures, one at 2.66:1. Where a specific
   palette matters, compute the ratio from `getComputedStyle` and assert it directly.
   **Measure against the surface the text is actually drawn on**, not white: three tokens
   "darkened for AA on white" measured 3.97:1, 3.96:1 and exactly 4.50:1 on the tinted panel
   they really sit on.

**Scan states beyond first paint.** A gate that only scans the untouched page cannot see a
violation in a result panel, an error state, or a failed verdict. Author a demo-specific
`driveDemos()` that puts **every** panel into its post-interaction state — run the signature
flow, step the trace to its end, trigger the failure/reject path, open every tab and glossary.
**An unscanned state is an ungated state**, and that is exactly where contrast and live-region
violations hide: one lab's SC 1.4.3 failure at 4.49:1 lived in a state the scan never visited.

**`package.json`:** `"test:a11y": "playwright test"`. And **exclude `e2e/` from Vitest** (`vite.config.ts → test: { include: ['src/**/*.test.ts'] }`) so the Playwright specs aren't collected as unit tests.

Once a lab has `claims.spec.ts` as well, `playwright test` runs both — so name the script
**`test:browser`** rather than `test:a11y`, since it is no longer only an accessibility gate.

**CI:** in `deploy.yml`, before deploy — `npx playwright install --with-deps chromium` then
`npm run test:browser`; violations block the deploy on `main` (see §6).

**Verify the gate actually runs the tests.** A suite that exists is not a suite that runs. One
lab's 30 unit tests were wired into **no** workflow at all — CI ran `build` and the a11y gate
only, so the unit suite had never gated anything. After wiring CI, confirm by reading the
workflow, not by assuming:

```
grep -nE "npm (run )?test|vitest|node --test" .github/workflows/*.yml
```

### 4.1b `e2e/claims.spec.ts` — the claims suite (REQUIRED, added 2026-08)

Alongside `a11y.spec.ts`, every lab needs a suite that checks the page tells the truth. This is
the artifact that enforces Principle 7, and it is what separates a demo that is *correct* from
one that is *trustworthy*.

**The rule that makes these tests worth anything: compare two values the page itself printed,
rather than asserting against a hardcoded string.** A test that re-derives the same expression
the source uses will happily agree with a bug — this has happened here: a fix was "verified" by
a test that recomputed the identical faulty branch condition.

**But internal consistency is not enough — a page can be consistently wrong.** A test that only
checks the page agrees with itself will pass a mutation that corrupts the underlying maths,
because the corrupted value is reported consistently everywhere. A real example: flipping the
rotation direction in a lattice-attack recovery matcher left the existing "the page reports only
its checked outcome" test green; only an **independent re-derivation** of the expected value
caught it. So aim for a mix:

- *cross-checks* — two surfaces that must agree (a counter vs the rows it counts; hand-authored
  prose vs the computed value vs a `maxlength` attribute);
- *independent re-derivations* — recompute the claim from the page's raw inputs by a different
  route than the source takes, and assert the page's answer matches;
- *parts-sum-to-whole* — where the maths offers one (lift + margin = q/2).

Cover at minimum:
- the headline claim, recomputed from values on screen (e.g. parse `p` and `q` out of the
  verdict and assert `p * q` equals the modulus the page displayed);
- each **failure** path, and that the page names the actual cause;
- **retirement**: change an input, assert the stale verdict is gone *and* that the page says it
  was retired;
- the `[hidden]` probe from §4.1;
- a **no-op guard**: re-selecting the same value must NOT retire a fresh verdict.

### 4.1c Prove the tests bite — mutation discipline (added 2026-08)

A green suite is not evidence until you have watched it fail. Before trusting any test:

1. **Invert a condition in the SOURCE** (not the test).
2. Confirm **the build SUCCEEDS**. A mutation that breaks `tsc` proves *nothing* — see the
   stale-bundle trap: the suite runs against the last good bundle and passes.
3. Confirm the **bundle hash CHANGES** (`md5 dist/assets/*.js`) — proof it reached the browser.
4. Confirm **the owning test FAILS**.
5. **Restore**, and confirm the hash returns to its pre-mutation value.

Rules learned the hard way:
- **Commit the real work BEFORE mutating.** An agent or session that dies mid-check otherwise
  strands an inverted condition in the tree. Four were caught in one day here; two did not break
  `tsc` and would have shipped.
- **One mutation at a time, restored immediately.** Never leave one in place while doing
  something else.
- Do **not** `git checkout -- <file>` to undo a mutation if that file also holds real work; use a
  surgical string-level revert.
- **If a mutation leaves every test green, the branch may be UNREACHABLE.** That is evidence
  about the *source*, not the tests — the right fix may be deleting dead code.

### 4.2 Author to these rules from the start (exactly what the gate checks)

- **Contrast** ≥ 4.5:1 body text, ≥ 3:1 large text / UI components. Never convey state by **color alone** (icon + text + color).
  **Measure against the surface the text is really drawn on**, not white — tokens tuned against
  white measured 3.97:1 and 3.96:1 on the tinted panel they actually sit on. And note the
  `background` **shorthand sets `background-image`**: a "secondary" button rule that overrides
  only `background-color` leaves the base gradient painting underneath, so the text is drawn on
  a surface nobody intended (measured 2.66:1). Set `background-image: none` when flattening.
- **`<html>` gets its own `background-color`**, and `color-scheme: dark`/`light` per theme. Use the `background-color` **longhand**, not the `background` shorthand (axe/WebKit miss the shorthand).
- **Scrollable regions must be keyboard reachable.** Any container that scrolls (a capped
  transcript list, a wide results table in an `overflow-x` box) needs `tabindex="0"` and a
  visible focus ring, or it is a WCAG 2.1.1 keyboard trap. These only overflow *after* user
  input, which is exactly why a load-time-only scan never reports them.
- **Text on a colored fill** (accent / gold / amber / danger / success) uses a **dedicated ink token** ≥ 4.5:1 — no near-white on a light accent.
- **Muted text:** lower the color's *lightness*, never use `opacity`.
- **Inline links:** a persistent `text-decoration` underline, not color alone.
- **Styled `<select>`:** `appearance: none` + a custom chevron.
- **Scrollable `overflow:auto` regions:** `tabindex="0"` + `role="region"` (or `group`) + an `aria-label`. (Fails on the Linux CI runner even when it passes local Windows Chromium.)
- **Live / async outputs:** `role="status"` + `aria-live="polite"` (or `role="log"`).
- **Lists:** `role="list"` → children `role="listitem"`; don't put a role/`tabindex` on a `role="presentation"` element; don't wrap a native control in a role/`tabindex` element.
- **The always-dark `.cl-topbar` is self-contained** — scope your base `p{}` / `button{}` rules to `#app`, not globally, so they don't fight the shared bar.
- **`#cl-theme-toggle`** flips `html[data-theme]`; your CSS keys off `[data-theme="light"]` (not `.light`); any CSP must allow the toggle's inline handler.
- Every interactive control has an accessible name (visible `<label>` or `aria-label`); text inputs are real `<textarea>`/`<input>`, never `contenteditable`; keyboard-operable with visible focus; layout stacks < 640px; a single banner landmark (the shared bar; the hero is the page content header).

**Acceptance:** `npm run build` clean; zero axe violations in both themes; run `npm run build && npm run test:a11y` locally before every push.

---

## 5. README standard

**Ship a `LICENSE` file.** *(Added 2026-08.)* MIT, `Copyright (c) <year> Paul Clark`, at the repo
root — matching the rest of the fleet. This was missed on **156 of 176 repos**, which meant the
default applied: exclusive copyright, i.e. a public teaching demo nobody was permitted to copy or
adapt. Copy `LICENSE` from any sibling lab.

Also ensure the repo root has a `.gitignore` covering `node_modules/`, `dist/`, `test-results/`
and `playwright-report/`. In a **nested** lab (`demos/<slug>/`) a `.gitignore` in the subfolder
does **not** cover the repo root — one lab had `node_modules/` showing as untracked for exactly
this reason.

The current fleet README (richer than the old five-section form) uses these sections, in order, with **correctness as the headline**:

**What It Is** (name the exact primitives, the problem, the security model, "not production") · **Exhibits** (numbered tour of the interactive pieces) · **When to Use It** (incl. at least one "do NOT use") · **Live Demo** (the Pages URL + what the user can do) · **What Can Go Wrong** · **Real-World Usage** · **How to Run Locally** · **Related Demos** · **Build & Verify** (test count + KAT files + the a11y gate) · **Performance** (where relevant) · footer.

Close every README with:

```
---

*One of 120+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
```

When adding/altering exhibits, **update `What It Is` and the numbered `Exhibits` list to match** — preserve the structure, honesty framing (KATs, "not production"), footer, and scripture line. Extend, never restructure.

---

## 6. Deploy — GitHub Pages via Actions (a11y-gated)

Actions-based deploy (not the legacy `gh-pages` branch). Use this file **verbatim** as `.github/workflows/deploy.yml` — do not improvise the filename, the two-job split, the Node version, or `npm ci`. (Fleet drift — a `pages.yml` here, an `npm install` there, a repo whose workflow uploads the artifact but never deploys it, a deploy that skips unit tests — all came from treating this as a suggestion.) It runs unit tests, builds, installs the Playwright browser, **runs the axe a11y gate, and only then deploys** — so a broken build or an accessibility regression never ships:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Unit tests (Vitest, incl. spec KATs)
        run: npm test
      - name: Build (typecheck gates the build)
        run: npm run build
      - name: Install Playwright browser
        run: npx playwright install --with-deps chromium
      - name: Accessibility gate (axe-core, WCAG A/AA, both themes)
        run: npm run test:a11y
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Also: `vite.config.ts` `base: '/crypto-lab-<demo-name>/'` (read the real repo name, don't guess); **no root-absolute asset paths** (`/foo` 404s under the project subpath — use `./foo`, a Vite-imported asset, or a `data:` URI); pin `@playwright/test` to a current build to avoid the corrupt-cache install loop. Verify the live URL loads with no 404s after deploy.

---

## Pipeline for a new demo

1. Fill §1's seven sections + the repo metadata (name, one-liner, catalog category, card title, tags, `--accent`, favicon emoji).
2. Create the GitHub repo (name + About one-liner).
3. Build the demo (§1) → working crypto + UI + tests, mounted at `#app` with `--accent` defined.
4. Apply the chrome (§3): copy the top bar from a sibling lab and adapt it (§3.0 — each lab owns its own; the old `reapply-header.py` push is retired), hero, theme contract, footer, head/favicon.
5. Meet the teaching bar (§2), the claim-complete bar (§0.7 + §4.1b), and the a11y gate (§4).
6. Mutation-check the claims suite (§4.1c) — build succeeds, bundle hash changes, owning test fails, then restore.
7. Write the README (§5), add `LICENSE` + root `.gitignore`; wire the Actions deploy (§6).
7. Wire it into the catalog by following the **"Adding a new demo" workflow in the `crypto-lab` repo's `CLAUDE.md` end-to-end** — the card in `index.html`, the `TITLE_TO_SECTION` entry (+ `FOUNDATIONS_TITLES`/`REAL_WORLD_TITLES` if applicable), the README table row, the optional learning-path step, **and the crypto-counsel corpus sync** (`node tools/corpus-sync.js gen <slug> "<Demo Name>"`, fill the prose, then `node tools/corpus-sync.js check` until it reports zero missing/stale). A demo without a corpus entry is permanently invisible to the chatbot. Deploy and verify the live URL loads with no 404s.

---

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
