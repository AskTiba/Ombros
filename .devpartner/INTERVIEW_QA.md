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
