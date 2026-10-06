# Skill Evolution — Ombros

> Read at the START of every session, before anything else. Updated at the END of every
> session and every sprint retrospective. These entries OVERRIDE the defaults in BOOT.md and
> the SKILL.md files for this project.
> Last updated: 2026-10-06

---

## Developer Preferences

| Date       | Preference                                                                                                                           | Context                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-05 | Verify claims against real sources before building on them. Do not accept a plausible-sounding data source or name without checking. | I proposed the name "Naka" as Luganda for "water". It isn't — water is _amazzi_. Developer pushed back. Root cause was pattern-matching a plausible-looking word instead of consulting a dictionary. |
| 2026-10-05 | Reject names that collide with existing local businesses.                                                                            | "Amazzi" was verified-correct Luganda but was rejected because Amäzi Foods, a Ugandan agricultural supply chain company, already owns that branding. Local name collision matters.                   |

---

## Project-Specific Conventions

| Date       | Convention                                                                                                                                                                                                                | Established in                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-05 | Never describe data as available, licensed, or free without a recorded verification. Every external dataset has a row in `ERROR_LOG.md` → Pre-flight Data Verification Log before it is used in code.                     | ADR-001. This project has many candidate datasets and one licensing question that could block hosted distribution entirely.                                                                                                                                                             |
| 2026-10-05 | Lead every user-facing surface and README claim with decision capability, not rendering.                                                                                                                                  | RISK-006. The dataset is not the achievement.                                                                                                                                                                                                                                           |
| 2026-10-05 | **Renderer-free geometry builders.** Any function producing a `THREE.BufferGeometry` takes plain data and returns geometry. No `WebGLRenderer`, no canvas, no `document`, no `Mesh`. The R3F component owns the renderer. | Unit 1b. jsdom has no WebGL context, so a builder that reaches for a renderer is untestable in CI. This keeps the whole 3D pipeline verifiable attribute-by-attribute. `heightfield.ts` is the reference implementation.                                                                |
| 2026-10-05 | Pin geometric orientation with tests, not with convention. Axis direction, row order, and triangle winding each get an explicit test.                                                                                     | Unit 1b. A flipped axis or reversed winding does not throw — it renders Kampala mirrored, or terrain that is invisible from above. Only a test catches it.                                                                                                                              |
| 2026-10-05 | When writing a validator, check whether its guards are load-bearing. Compute whether a branch can actually change a result, and delete it if not.                                                                         | Unit 1c-i. A `range === 0` guard in `readDemBinary` was dead code: `min + (v/65535) * 0` is already `min`, and a test asserting it 'avoids dividing by zero' would have passed with or without the guard. A guard that changes nothing still costs a reader wondering what it protects. |
| 2026-10-05 | Geospatial maths gets tight assertions. Prove order-of-magnitude only with order-of-magnitude; pin exact values when a projection or constant changes.                                                                    | Unit 1c-ii. `boundsHeightMeters()` was 125m wrong and its test passed, because `> 18_000 && < 28_000` cannot see 125m. A regression test should fail if someone swaps the ellipsoid back for a sphere.                                                                                  |
| 2026-10-05 | Never hardcode a fixture that was derived from another calculation — recompute it in the test from the shared source.                                                                                                     | Unit 1c-ii. The heightfield test hardcoded `642 x 750`, which encoded the sphere extent. It failed for the right reason when `geo.ts` changed, but only because I rechecked the arithmetic. Dims are now derived from `boundsWidthMeters()`/`boundsHeightMeters()` in the test.         |
| 2026-10-05 | Test arithmetic gets checked before the assertion is written. Compute expected values by hand, not by intuition.                                                                                                          | Unit 1b. Four of 37 tests failed first run on my own arithmetic (half-depth vs depth, 1100×8, (1155−1100)×8), plus one inverted cross product. The implementation was right; the test was wrong.                                                                                        |

---

## Corrections Logged

| Date       | Session # | Was about to do                                                       | Should do instead                                                                                                             |
| ---------- | --------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-05 | Boot      | Use "Naka" as the product name on the claim it means water in Luganda | Search a dictionary before asserting any translation. Then still check for existing local brand collisions before committing. |
| 2026-10-05 | Boot      | Ship a 3D-canvas-first UI                                             | Build the 2D accessible path as a first-class route to the same data (ADR-002)                                                |

---

## What Worked Well

| Date       | Pattern                                                               | Why it worked                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-05 | Researching the domain before designing the architecture              | Found McClean et al.'s published Kampala flood model. That single finding inverted the architecture from "build a solver" to "visualize peer-reviewed science plus own the intervention layer." Hours of wasted build avoided. |
| 2026-10-05 | Verifying named quantities against primary sources (KCCA, World Bank) | Produced citable budget figures, which turned "maybe monetizable" into "money is already appropriated, the gap is tooling."                                                                                                    |

---

## Standing Technical Decisions (Project-Level)

| Decision                                                                     | Settled | Date       | Reference                   |
| ---------------------------------------------------------------------------- | ------- | ---------- | --------------------------- |
| Consume published flood science; do not implement a hydrodynamic solver      | Yes     | 2026-10-05 | ADR-001                     |
| 3D is progressive enhancement over a 2D accessible path, never the only path | Yes     | 2026-10-05 | ADR-002                     |
| Core product requires zero paid API credentials                              | Yes     | 2026-10-05 | PROJECT_STATE → Environment |
| Kampala only for v1                                                          | Yes     | 2026-10-05 | DECISIONS → Scope           |

### S-EVOL-006 — 2026-10-05 — A gate that cannot fail is worse than no gate

Two of the three commits in this session found a check reporting green while verifying
nothing. `tsc --noEmit` against a solution-style root tsconfig compiled zero files
(ERR-006), and Vitest was collecting 145 dependency suites (ERR-003). Both passed
continuously and nobody noticed, because a green check produces no output.

Rule adopted: **when a check is added or changed, break something on purpose and confirm the
check catches it before believing a green run.** Appending one mistyped line
(`const c: string = computeGrid().cols`) and confirming exit 2 takes ten seconds. Exit codes
must be read without a pipe, since `$?` after `| head` is head's status, not tsc's.

### S-EVOL-007 — 2026-10-05 — Verify a data pipeline geographically, not just structurally

The DEM round-tripped through `readDemBinary` cleanly, and that proved nothing about whether
the terrain was the right way up: a transposed or flipped raster decodes perfectly. Three
checks actually established correctness, and all three are cheap:

- **Read the source header** instead of trusting the filename. The tile name says `N00_00`;
  only the `ModelTiepoint` proves the extent is 0-1N, and it is.
- **Cross-check against an independent implementation.** `geotiff`'s own bilinear resample of
  the same window agreed at Pearson 0.997. Agreement between two independent code paths is
  evidence; agreement between a writer and its reader is circular.
- **Look for a feature you know.** The grid peak lands at 1317.6m on Kololo Hill, the highest
  ground in Kampala. No amount of structural checking would have caught a flip; one sentence
  of domain knowledge did.

Rule adopted: **for any geospatial pipeline, name the real-world landmark the output should
peak on, and check it before moving on.** Also: read the file's own georeferencing tags
rather than parsing its name. My first TIFF probe misread the tiepoint as `(1, 0)` instead of
`(32, 1)` and nearly led to the conclusion that the tile did not cover Kampala.

### S-EVOL-008 — 2026-10-06 — When a new dependency fails inside its own stack, swap majors before debugging your code

Added `msw@3.0.2` for the first network test; every fetch died with
`RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal`,
from `@mswjs/interceptors` into Node's bundled undici. Two features of the failure said
"dependency, not us": identical errors with and without a matched handler, and a cause
chain that never touched application code. Installing `msw@2.15.0` and re-running —
zero code changes, seven tests green — both fixed it and proved where it was.

Rule adopted: **if a fresh dependency fails on first use with an error originating in
its own modules, run the same test on the previous major before reading a line of your
own code.** The version swap is the cheapest localising experiment there is. Pair it
with the existing TDD rule: a red run must be red for the _expected_ reason — "module
does not exist" and "interceptor crash" are different reds, and conflating them sends
the debugging the wrong way.

Also re-confirmed the fixture lesson: a test fixture field that restates a computed
value (`maxElevationMeters: 1130` against a ramp reaching 1210) is a second source of
truth. Derive it (`Math.max(...samples)`), never restate it.
