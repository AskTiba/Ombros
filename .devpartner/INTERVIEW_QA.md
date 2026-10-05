# Interview Q&A — Ombros

> **Personal software-engineering study bank.** Generated live during development plus
> post-hoc project scans — every entry maps a real design decision, file, or code pattern
> to the question an interviewer would ask, with a teaching-grade model answer written for
> an intermediate developer working toward interview readiness.
> Last updated: 2026-10-05

---

## Index

| Domain                       | Section | Question count |
| ---------------------------- | ------- | -------------- |
| System Design & Architecture | §D1     |                |
| Algorithms & Data Structures | §D2     |                |
| Language Fundamentals        | §D3     |                |
| Frontend / React             | §D4     |                |
| Backend / API Design         | §D5     |                |
| Database & Queries           | §D6     |                |
| Security                     | §D7     |                |
| Performance & Scalability    | §D8     |                |
| Testing & QA                 | §D9     |                |
| CI/CD & DevOps               | §D10    |                |
| Accessibility                | §D11    |                |
| Mobile / Native              | §D12    |                |
| Data / ML                    | §D13    |                |
| Behavioral & Decisions       | §D14    |                |
| Project Deep-Dive            | §D15    |                |

---

## Story Entries (Chronological)

### STORY-001b — Renderer-free heightfield geometry — 2026-10-05

**Q:** Why is `buildHeightfieldGeometry()` a plain function instead of a React component or a hook?

**Direct answer:** Because jsdom has no WebGL context. If geometry construction touched
`WebGLRenderer`, a canvas, or `document`, it would be untestable in CI and I would only discover it
was broken when someone opened the page. Returning a `BufferGeometry` from a pure function lets me
assert vertex count, axis orientation, and index buffer width in a unit test that runs in 12
seconds. The R3F component owns the renderer; the builder never sees one.

**Q:** What actually breaks if you get the triangle winding order wrong?

**Direct answer:** Nothing throws. The mesh still has the right vertex count and the right
positions, and every assertion you would naturally reach for still passes. But the triangles face
downward, Three's back-face culling hides them, and the terrain is invisible from above — which is
where you always view it. My test asserts that a flat grid yields normals of exactly `(0, 1, 0)`,
which catches a reversed winding with no renderer involved.

**Q:** Why assert a 32-bit index buffer past 65,535 vertices? That is an edge case.

**Direct answer:** It is the _main_ case, not an edge case. A 30m grid over Kampala's extent is
642 × 750 = 481,500 vertices. Written into a `Uint16Array`, index 65,536 wraps to 0, so quads in the
far south collapse back onto the first row — torn terrain, no exception thrown anywhere. Three's
`setIndex` picks the type for you if you hand it a plain array, but I pass a typed array explicitly
so the choice is visible in the source and assertable.

**Q:** Your first test run had four failures. What were they?

**Direct answer:** All four were bugs in my tests, not the builder. Three were arithmetic — I
asserted a full depth where I meant a half-depth, `1100 × 8 = 8800` written as `8000`, and
`(1155 − 1100) × 8 = 440` written as `4400`. The fourth was the worst: my helper computed `ab × ac`
when Three's right-hand-rule normal for vertex order `(v0, v1, v2)` is `(v1 − v0) × (v2 − v0)`. My
helper's variables `a`, `b`, `c` were the triangle's vertices in index order, so `ab × ac` was
already correct and my "fix" inverted every normal. The lesson: when a geometry test fails, verify
the test's own vector arithmetic before rewriting the builder.

**Q:** Why require uniform _cell size_ rather than a square grid?

**Direct answer:** The published extent is ~19,237m east-west by ~22,461m north-south, an aspect
ratio of 0.856. A square cell count over a non-square extent forces either two different cell sizes
— stretching the terrain north-south, which corrupts every distance measured off it — or padding
with dead columns. The 30m grid is 642 × 750. So I enforce uniform cell size within 0.5% relative
drift, which also absorbs the rounding in `round(extent / cell) + 1`. It also catches the failure
that actually matters: a DEM file whose header disagrees with its payload.

**Q:** Why build the geometry in metres when you already have a `lonLatToNdc` helper?

**Direct answer:** Kampala has ~1,000m of relief across 20km, so I must exaggerate vertically or
the city looks like a sheet of paper. That exaggeration has to be one number I can state in the UI
and in the risk report, because the terrain is 30m GLO-30 while the flood model ran on 5m — the
report is obliged to disclose it. In NDC the ratio is entangled with the projection and stops being
a physical quantity. Metres also keeps `computeVertexNormals` correct and gives OSM footprints and
flood polygons one shared space to snap into. `lonLatToNdc` stays a camera and picking helper.

**Q:** `pnpm test` reported 1,498 tests. The project has 61. What happened?

**Direct answer:** My `vitest.config.ts` set `exclude: ['e2e/**', 'node_modules/**']`. Setting
`exclude` _replaces_ Vitest's defaults rather than adding to them, and `node_modules/**` anchors
only at the project root — so it never matched `.opencode/node_modules/zod/**`, and 145 suites from
a vendored dependency were collected. Two failed. The fix was
`[...configDefaults.exclude, 'e2e/**']`. General rule: when a config key has sane library defaults,
spread them instead of retyping the list.

---

### STORY-001c-ii — WGS84 reprojection — 2026-10-05

**Q:** Why not just use a sphere of mean Earth radius to convert degrees to metres?

**Direct answer:** Because the error is systematic and, at city scale, large. Multiplying every degree by R = 6,371,008.8m put Kampala's north-south extent 125m too long and its east-west extent 21m too short — opposite signs, because a real ellipsoid's meridian and parallel radii diverge with latitude while a sphere's radius does not. Over 22km the two axes drifted about 146m apart. This was in shipped code that passed its tests.

**Q:** Your tests passed with the wrong model. How did you catch it?

**Direct answer:** The tests asserted `boundsHeightMeters() > 18_000 && < 28_000`. That range is 10,000m wide, so a 125m error is invisible to it. It only surfaced because the DEM fetch needed per-degree scale factors and I computed the WGS84 values to compare. An order-of-magnitude assertion cannot detect a percent-level error — that is the actual lesson. I tightened them to ~500m ranges and added exact-value regression pins.

**Q:** How much error can a flood risk tool tolerate in its projection?

**Direct answer:** For the terrain mesh, almost none of it matters — a 0.56% scale error on a 30m cell is 17cm, invisible. It matters the moment we report a distance or an exposed population figure to a planner, and it compounds with anything derived from the grid. Given the tool's stated purpose is decision-ready numbers, "invisible on screen" is not the bar.

**Q:** Why does longitude need a latitude argument but latitude does not?

**Direct answer:** Because of cos(φ). A degree of longitude is 111.3km at the equator but 78.8km at 45°, a 29% difference, so a latitude-independent constant misplaces features by a third of a kilometre per degree. A degree of latitude barely moves — the meridian radius varies about 0.6% pole to equator — so one value per extent is enough. That asymmetry is exactly why a single `EARTH_RADIUS_M` could never be right for both.

**Q:** Why does your test file derive the grid dimensions instead of hardcoding 643 x 746?

**Direct answer:** Because I hardcoded `642 x 750` and it encoded the sphere extent. When I fixed the projection the test failed — and it failed for the right reason, because 643 x 746 is genuinely the correct 30m grid now. But I only knew that because I rechecked the arithmetic by hand. If I had not, I would have "fixed" the test by loosening it and baked the 146m axis error in permanently. A fixture derived from another calculation should recompute from the shared source.

---

### STORY-001c-i — Quantised DEM binary — 2026-10-05

**Q:** How did you halve the DEM payload, and what did it cost you in precision?

**Direct answer:** uint16 samples instead of float32: 1.83MB down to 0.92MB for 479,678 samples. The step is `range / 65535`, and since the observed elevation band is a few hundred metres, that is about 3mm — two orders of magnitude below the 30m source resolution. The point I care about is not that 3mm is small, it is that quantisation can never be the _explanation_ for a visual artefact. That matters because we already have to disclose that the terrain is 30m while the flood model ran on 5m (RISK-007); a second, self-inflicted source of imprecision would muddy an honesty claim.

**Q:** Why store the elevation band in the header instead of hardcoding it?

**Direct answer:** Because a fixed band wastes range. If I hardcoded, say, 900–1500m to cover Kampala's relief, the step would be 9mm. Measuring the actual band gives 3mm for free, and it adapts to whatever the DEM really contains instead of to my guess about it. I also export `MAX_DEM_QUANTISATION_STEP_METERS = 0.01` as the threshold where uint16 stops being transparent — past that width, the format should move to uint32 rather than quietly degrade.

**Q:** What does your binary header actually validate, and what does it deliberately skip?

**Direct answer:** Magic, version, dimensions, declared byte length against actual length, extent finiteness, and that the elevation band is not inverted. It deliberately does _not_ re-check uniform cell size — that invariant already lives in `buildHeightfieldGeometry` (ADR-006), and asserting it in both places means two copies to keep in sync when one changes. The parser's contract is "this is a well-formed grid"; the builder's is "this is a loadable grid."

**Q:** You check `buffer.byteLength !== declaredBytes` rather than `>=`. Why strict equality?

**Direct answer:** Because both failure directions matter. `<` is truncation, which would otherwise parse as a short grid and render terrain that stops mid-city with no error. `>` is trailing garbage or a version skew, which means the file is not what its header claims. Strict equality catches both with one comparison.

**Q:** You added a guard for a zero-width elevation band, then deleted it. Why?

**Direct answer:** Because it was dead code. The decoding is `min + (value / 65535) * range`, and when `range` is 0 the product is 0, so every sample already decodes to `min` exactly. The `range === 0` branch changed no result, and the test I wrote to justify it would have passed with or without it. A guard that cannot fail is worse than no guard, because the next reader assumes it is protecting something. I kept the test — it pins the behaviour against a future refactor to `(value - min) / range` — but rewrote the comment so it claims only what is true.

**Q:** How do you test a binary decoder?

**Direct answer:** The test builds its own encoder inline rather than importing a writer from the source module. That is deliberate: if the reader and the writer shared a codec helper, a bug in that helper would cancel out and both tests would pass. The test states the format independently from the byte layout, so the two implementations have to actually agree. There is also an integration test that feeds the decoded grid straight into `buildHeightfieldGeometry` and asserts the vertex count, which catches drift between what the writer emits and what the builder expects.

---

### STORY-001e — DEM pipeline and a broken type-check gate — 2026-10-05

**Q:** Your `typecheck` script had been passing for weeks. How did you find out it checked nothing?

**Direct answer:** I made a call-site mistake during a refactor — dropped an argument — and expected `pnpm typecheck` to fail. It didn't. Instead `pnpm test` failed, because Vitest's transform type-errored on the same file. The script was `tsc --noEmit` against the root `tsconfig.json`, which is solution-style: it contains only `references`, with no `files` or `include`. `tsc --listFiles` on it printed zero files. `tsc --noEmit` on a config that matches nothing exits 0, which looks exactly like success. The actual program is in `tsconfig.app.json` — 263 files including tests — and only `tsc -b`, which `build` happened to call, ever reached it.

**Q:** How do you prove a gate works before trusting it?

**Direct answer:** Break something on purpose. I appended `const c: string = computeDemGrid(300, 200).cols` to a module and measured: old gate exit 0 with no output, new gate exit 2 with `TS2322`, clean file exit 0 again. One subtlety — I initially piped tsc into `head`, and `$?` reported head's status. Exit codes have to be read without a pipe or the proof is worthless. The fix was `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json --noEmit` rather than `tsc -b`, because `-b` trusts its `.tsbuildinfo` cache and a pre-commit gate should never depend on a cache being valid.

**Q:** How do you know a resampling step is geographically correct, not just internally consistent?

**Direct answer:** Round-tripping proves almost nothing — a transposed or flipped raster decodes perfectly. Three things gave real confidence. First, I read the file's own `ModelTiepoint` rather than trusting the filename. My initial probe misread the six tiepoint values as `[i, j, x, y]` and got the origin as `(1, 0)` instead of `(32, 1)`, which nearly led me to conclude the tile didn't contain Kampala at all. Second, I cross-checked against `geotiff`'s own bilinear resample of the same window — Pearson 0.997, mean absolute difference 1.67m over 479,678 samples, residual explained by my grid anchoring to exact WGS84 bounds while geotiff anchors to the window pixel grid. Two independent paths agreeing is evidence; a writer and its own reader agreeing is circular. Third, and most decisive: the grid's peak is 1317.6m at 0.3466N, 32.605E — Kololo Hill, the highest ground in Kampala. One sentence of domain knowledge caught what 116 passing tests could not.

**Q:** Why use `geotiff` instead of reading the byte ranges yourself?

**Direct answer:** Because I checked before deciding. The `Compression` tag is 8 — Deflate — with `Predictor` 3, a floating-point predictor, on 1024x1024 tiles. Hand-decoding that is a project in itself, and a subtle bug in it would produce a plausible but wrong terrain. So `geotiff` handles I/O and decompression, and I kept all the resampling in a unit-tested module. Notably `geotiff` offers `resampleMethod: 'bilinear'` and I deliberately passed `nearest` instead: letting geotiff resample _and_ resampling myself would mean two independent resamples of the same data, and a bug in either would be very hard to see in the output.

**Q:** Your tests failed three times in a row during this unit. Were those real bugs?

**Direct answer:** Two were my test fixtures and one was a real bug, and telling them apart mattered. The first two failures were fixtures: I'd georeferenced a synthetic window at the study extent's north edge while the module anchors latitude at the south edge, so every sample fell outside the window and silently clamped to the edge value — tests that would have passed while asserting nothing. The third was a genuine design flaw I introduced during a refactor: `targetVertexToLonLat` was taking the step size from the study extent while taking the vertex count from the grid spec, so those two had to agree exactly. That constraint was invisible to callers and would have been violated by any different footprint. The fix was to let the spec own the geometry and the extent own only the anchor. I only found it because the test used a spec deliberately smaller than the study extent, which is the only kind of fixture that can catch it.

**Q:** What does "1 arcsecond is not 30m" actually change?

**Direct answer:** It bounds what we may claim. A degree of longitude at 0.3N is ~30.92m while a degree of latitude is ~30.71m, so the source is genuinely anisotropic in metres and the published "30m" is a rounded figure. That has two consequences: the resample is a ~3% stretch, which is why bilinear beats nearest — nearest would terrace the terrain into visible steps along the stretched axis — and any precision claim has to be stated against ~30.7m horizontal resolution, not 30m. It's the same discipline as the quantisation claim in ADR-008: state the real number rather than the flattering one.

---

### STORY-001d — CI pipeline — 2026-10-05

**Q:** What does "CI mirrors the commit gate" actually mean in practice?

**Direct answer:** The checks must be the same commands in the same order, because a pipeline that differs from what you run locally will eventually pass something you would have rejected, or fail something you just fixed. Here that is format check → lint → type-check → test → build. I also checked that every command the workflow calls actually exists in `package.json` before emitting it — a CI file referencing a script that was never written is a pipeline that is red on the first run and gets ignored after that.

**Q:** You added a CI step that checks the test count. Isn't that paranoid?

**Direct answer:** It is the direct result of a real incident. My test suite once reported 1,498 tests across 149 files, 145 of which were Zod's own suites pulled in from a nested `node_modules` because I had replaced Vitest's `exclude` defaults instead of spreading them. Everything passed locally for a session. A grep for `^src/` on the collected file list is one line and makes that class of failure loud, so it stays.

**Q:** You found that `engines.node` was wrong. How?

**Direct answer:** I probed the actual manifests rather than reading my own config. `vite@7.3.6` declares `^20.19.0 || >=22.12.0`; my `package.json` said `>=20.0.0`. The gap is Node 20.0 through 20.18 — versions that satisfy my declaration and cannot run the build. `engines` is advisory to npm, so nothing catches this; it fails late as an obscure error inside a bundler. I corrected the range and added a matrix job that builds on `20.19.0` and `24`, so the floor is now verified instead of asserted.

**Q:** Why run the engine floor job in CI rather than trusting the `engines` field?

**Direct answer:** Because a declared range is a comment until something enforces it. Dependencies raise their floors over time; when one does, the floor job fails and tells me the declared range needs updating. Without it, I find out when a contributor's build breaks for no visible reason.

**Q:** You validated the workflow with `actionlint`. What did it catch?

**Direct answer:** A real bug: I had written `node-version: ${{ matrix.node }}` in the `quality` job, which has no matrix. The expression evaluates to empty, and `setup-node` would silently fall back to whatever default the runner ships — so the primary job's Node version would not have been what the file claimed. `actionlint` type-checks expressions against the job's context and flagged it. Worth noting the tool only helps if you run it: my own YAML sanity check parsed fine and reported nothing.

**Q:** Did you add a job that fetches the DEM in CI?

**Direct answer:** No, deliberately. The DEM script does not exist yet, so wiring the job now would make `main` permanently red — and a permanently red pipeline is how people learn to ignore red. It lands with Unit 1c-iii alongside the script. And even then I would only assert the script exists and parses, never that the upstream COG responds: a network dependency should never be able to redden CI.

---

### STORY-001a — Project bootstrap and data verification — 2026-10-05

**Q:** You built a flood visualization app. Did you implement a flood simulation?

**Direct answer:** No. The hydrodynamics already existed as peer-reviewed research, so I
consume it and build the layer the research can't provide.

**Concept:** Flood risk needs three separate things: a hydrological model (how water moves),
a terrain model (where the ground is), and a risk readout (who and what is affected).
McClean, Walsh, Lwasa & Ddumba (2021) at Newcastle and Makerere published the first of these
for Kampala — a 2D finite-volume hydrodynamic model run over a 5m DEM, sampling rainfall at
20/40/60/80/100mm across 1/3/6-hour durations, with depths thresholded at 0.1/0.2/0.3m.
It's openly licensed under the Open Government Licence.

**Why / tradeoffs:** Building my own solver would have been slower, coarser, and — critically
— less credible than output from Uganda's own university. The trade is control for
credibility: I can't tune the model or extend it to scenarios nobody simulated. The rejected
alternative wins if a client needs an event that isn't in the 15 published scenarios, or if
the model turns out to be wrong for Kampala's current drainage state. That's a live risk,
not a hypothetical — the study's rainfall period ends October 2020, and KCCA has since built
out drainage.

**In this project:** `DECISIONS.md` ADR-001 records the decision. The architecture consequence
is that `src/features/flood/types.ts` models a scenario as `{rainfallMm, durationHours}` —
only the 15 combinations that actually exist — and throws on anything else rather than
silently approximating.

**Edge cases:** Two. First, the source data is _extents_, not continuous depth (ERR-001), so
the model carries discrete `DEPTH_CLASSES` and the severe class is labelled `>=0.3m`, never
`0.3m` — a floor, not a point value. Second, the study's 5m DEM is a research _input_, not a
published output (ERR-002), so terrain comes from Copernicus DEM GLO-30 at 30m instead.

**At scale:** Per-scenario simulation cost is amortized at build time into our own compact
binary rather than shipping a GeoPackage to the browser. At 15 scenarios × 3 depth classes,
the rasterization step is a batch job; at 100+ cities it becomes a queue with caching keyed
on study extent.

**Interviewer's intent:** Whether you can recognize when NOT to build something, and whether
you understand what you actually know versus what you're inferring.

**Follow-ups:**

- Q: Why not just call a commercial flood API per scenario? → A: No commercial flood API covers
  Kampala, and it puts a paid key and a network round-trip inside an interactive render loop.
  It would also break the zero-credentials requirement.
- Q: How do you know the research is trustworthy? → A: I didn't take the search summary at face
  value. I read the publisher's own catalog record for format, spatial representation type,
  CRS, and licence — which is exactly how I discovered the data was vector extents rather than
  the depth raster I had assumed.

---

**Q:** Your tests all passed. How do you know they'd catch a real bug?

**Direct answer:** I mutate the code and confirm the test fails, rather than trusting a green
run.

**Concept:** A passing test proves nothing on its own. A test that can't fail isn't testing
anything. Mutation is the check: change the implementation in a way that breaks the intended
behavior, and the test must go red. If it stays green, the test is decorative.

**Why / tradeoffs:** It costs seconds per test and catches the specific failure mode where
someone writes an assertion that happens to match whatever the code did. This paid off
immediately — my first mutation attempt on the geo module passed all 21 tests, which told me
the assertion was wrong, not the code. I had written "study area is wider than it is tall"
when Kampala's published extent is actually _taller_ than wide (~0.202°N vs ~0.173°E). The
test was asserting my assumption instead of the fact.

**In this project:** Two concrete catches in `src/lib/geo.test.ts`. Flipping the NDC y-axis
sign surfaced 5 failures — and one of them exposed a genuine bug: `1 - t*2` puts south at +1
and north at −1, the opposite of WebGL convention. The correct formula is `t*2 - 1`. A third
mutation confirmed the ADR-003 guard test works: changing `>=0.3m` to `0.3m` in
`src/features/flood/types.test.ts` fails exactly the assertion that encodes the data-honesty
constraint.

**Edge cases:** Mutation testing requires the mutation to target a _semantic_ property, not a
typo. My first attempt substituted `label:` where the field was `rangeLabel:` and changed
nothing — a false pass that would have told me the test was strong when I hadn't actually
mutated the right thing.

**At scale:** Worth doing on the risk math and any data-integrity guards. Not worth doing on
every pure helper at high volume — pick the tests guarding correctness claims a user could act
on.

**Interviewer's intent:** Whether you treat "tests pass" as evidence or as a precondition.

**Follow-ups:**

- Q: Should every test be mutation-tested? → A: No. The expensive ones to keep honest are the
  ones encoding a domain constraint — here, that the depth classes are floors and the NDC
  orientation is right. Those are the ones a future refactor would silently break.
- Q: What did the y-axis bug look like in production? → A: It never reached production, which
  is the point. The mutation exposed it while the function was four days old and had no
  renderer attached.

### STORY-XXX — [title] — 2026-10-05

**Q:** [question as an interviewer would ask]

**Direct answer:** [the sentence a strong candidate leads with]

**Concept:** [2-4 lines teaching the underlying idea — what it is, how it works under
the hood, in plain language]

**Why / tradeoffs:** [rationale + what was traded away + when the rejected alternative
would have been correct]

**In this project:** [file:line + what we did + why it was the right fit here]

**Edge cases:** [1-2 failure modes, why they happen, and the mitigation]

**At scale:** [what changes at 10x/100x load and the next step]

**Interviewer's intent:** [what this question screens for]

**Follow-ups:**

- Q: [follow-up] → A: [answer]
- Q: [follow-up] → A: [answer]

---

## §D1. System Design & Architecture

### [Question title]

**Q:** [question as an interviewer would ask]

**Answer:** [direct answer]

...

---

## §D15. Project Deep-Dive

Questions only answerable by someone who actually worked here — the strongest interview
material.

---

## Sprint Reviews

### Sprint [N] — 2026-10-05

**T3 deep-dive:** [full system walkthrough question + answer]

---

## Project Scan (Post-Hoc)

[Filled by the interview-partner §7 scan — one structured entry per domain.]

---

## Behavioral & Decision Trail

**Q:** [STAR-format behavioral question grounded in a real logged decision]
**Answer (STAR):** Situation / Task / Action / Result

---

## Personal Study Queue

| Question  | Domain   | Status (strong / weak / repeat) | Last drilled |
| --------- | -------- | ------------------------------- | ------------ |
| [Short Q] | [domain] | weak                            | [date]       |
