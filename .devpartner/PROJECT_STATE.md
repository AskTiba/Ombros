# Project State — Ombros

> **Single source of truth for project continuity across sessions.**
> Read at the start of every session. It IS the memory.
> Last updated: 2026-10-05

---

## What Currently Works

| Feature / Component                                                  | Verified by                                           | Date       |
| -------------------------------------------------------------------- | ----------------------------------------------------- | ---------- |
| Repo initialized + `.devpartner/` state files seeded                 | `git init`, files on disk                             | 2026-10-05 |
| Domain research: problem validated, public data sources confirmed    | Web research (see ROADMAP → Evidence)                 | 2026-10-05 |
| Toolchain scaffold: Vite + React 19 + strict TS + Vitest + ESLint    | `pnpm build`, `pnpm typecheck`, `pnpm lint`           | 2026-10-05 |
| Kampala bounds + NDC/lon-lat helpers (`src/lib/geo.ts`)              | `src/lib/geo.test.ts` (12 tests)                      | 2026-10-05 |
| Flood scenario model + depth classes (`src/features/flood/types.ts`) | `src/features/flood/types.test.ts` (9 tests)          | 2026-10-05 |
| Terrain heightfield builder — `buildHeightfieldGeometry()`           | `src/features/terrain/heightfield.test.ts` (37 tests) | 2026-10-05 |
| Test collection scoped to `src/` only (ERR-003 fixed)                | 4 files / 61 tests / 12s                              | 2026-10-05 |

> 90 tests across 5 files, all green. No Three.js scene is mounted in the app yet —
> `ScenePlaceholder` stands in. See "Planned Next" for the exact next step.

---

## In Progress (Exact Next Step)

| Story/Task                                 | Current Unit       | Exact Next Action                                                                                                                                                                                                                                                                                                                                     | Files                               |
| ------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| STORY-001 — Standing 3D scene over Kampala | Unit 1c-iii (next) | Write `scripts/fetch-dem.mjs`: range-request the GLO-30 COG header for `Copernicus_DSM_COG_10_N00_00_E032_00_DEM`, read only the byte ranges covering Kampala, reproject to metres, resample to the uniform 643 x 746 grid, quantise to uint16, write `public/data/kampala-dem.bin`. Then verify the written file round-trips through `readDemBinary` | `scripts/fetch-dem.mjs` (to create) |

> **Unit 1c-i is done.** `readDemBinary()` decodes the 48-byte-header, uint16-payload DEM format into the
> exact shape `buildHeightfieldGeometry` consumes. Pure — no `fetch`, no DOM. Validates structure
> (magic, version, dims, declared length, extent, band); deliberately does **not** re-check uniform
> cell size, since that invariant already lives in the builder (ADR-006). Quantisation step is
> `range / 65535` — ~3mm on a 200m band, two orders of magnitude below the 30m source resolution.
>
> **Unit 1c-ii is done.** `metresPerDegreeLatitude`/`metresPerDegreeLongitude` reproject WGS84 properly, replacing a mean-radius sphere that was 125m out north-south (ERR-004, ADR-007). The study extent is now **19,258.00m E-W x 22,336.01m N-S**, so the 30m grid is **643 x 746 = 479,678 vertices** — still past the 16-bit index limit.
>
> **Unit 1b is done.** `buildHeightfieldGeometry()` is a pure function returning a
> `THREE.BufferGeometry` with no renderer attached — in metres, Y-up, origin at the extent centroid
> (ADR-005) — so the whole 3D pipeline stays verifiable attribute-by-attribute in jsdom.
>
> The grid invariant is **uniform cell size**, not a square cell count (ADR-006): the published
> extent is ~19,237m E-W by ~22,461m N-S, so a 30m grid is 642 × 750 = 481,500 vertices — which
> also exceeds the 16-bit index limit and forces a `Uint32Array` index buffer. Both facts are
> pinned by tests, along with axis orientation and triangle winding.
>
> A 30m grid is heavy for the target market (mid-range Android). The 1c binary format should
> therefore store quantised elevations, and Unit 1d's quality tiers will need to decimate the grid
> at load time rather than only at fetch time.

---

## Broken / Blocked

| Issue    | Symptom | Blocking what | Owner |
| -------- | ------- | ------------- | ----- |
| _(none)_ | —       | —             | —     |

---

## Planned Next (Prioritized)

1. Unit 1c — DEM binary format + `fetch-dem.mjs` producing `public/data/kampala-dem.bin`
2. Unit 1d — adaptive quality tiers (3 tiers, measured), including load-time grid decimation
3. Unit 1e — R3F `<Canvas>` mounting the terrain, with the non-WebGL2 fallback (ADR-002)
4. Unit 2 — flood extent classes → animated water surface
5. Unit 3 — accessible 2D depth view
6. Unit 4 — sub-county risk readout
7. Unit 5 — shareable risk report (the monetization unit)

---

## Architecture & Conventions

### Core Architectural Decision

**Ombros does NOT implement a hydrodynamic solver.** It consumes and visualizes published
flood science. See `DECISIONS.md` → ADR-001.

The reasoning: McClean et al. (2021), Newcastle University + Makerere University, published
modelled flood extents for Kampala produced by a 2D finite-volume hydrodynamic model run over
a 5m DEM, sampling rainfall at 20/40/60/80/100mm across 1/3/6-hour durations with depth
thresholds at 0.1/0.2/0.3m (DOI 10.5285/e53dea2e-cb25-4f0f-b5f9-937eecf15aff). The expensive,
defensible hydrology already exists and is openly licensed. Building our own solver would be
both slower and less credible than consuming peer-reviewed output.

Ombros therefore does four things the source data cannot: renders it explorably in 3D, layers
it against OSM buildings, lets you test drainage-intervention scenarios, and turns it into a
decision artifact a planner or insurer will pay for.

### Stack

| Layer       | Technology                            | Version            | Notes                                                                |
| ----------- | ------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| Runtime     | Node                                  | ≥20                | pnpm 11.16                                                           |
| Framework   | React                                 | 19.3               | Vite 7, TypeScript 5.9 strict                                        |
| 3D          | Three.js + @react-three/fiber + drei  | 0.182 / 9.8 / 10.7 | R3F over raw Three.js — declarative scene graph fits React data flow |
| Styling     | Tailwind CSS                          | 4.3                | CSS-first tokens, via `@tailwindcss/vite`                            |
| Data layer  | PostgreSQL + Drizzle ORM              | 16 / 0.4x          | Matches existing portfolio convention                                |
| Validation  | Zod                                   | 4.6                |                                                                      |
| Testing     | Vitest 3.2 + RTL 16 + Playwright 1.57 |                    | Integration-first. MSW added when the first network call exists.     |
| Lint/format | ESLint 9 flat + Prettier 3            |                    | typescript-eslint 8.71                                               |

### Project Structure

```
ombros/
├── .devpartner/          ← project memory (7 files)
├── src/
│   ├── app/               ← routes, shell, providers
│   ├── components/        ← global UI kit, design tokens
│   ├── features/
│   │   ├── terrain/       ← DEM loading, heightfield mesh
│   │   ├── flood/         ← depth grid → water surface
│   │   ├── scenario/      ← drainage intervention what-ifs
│   │   └── inspection/    ← click-to-query risk readout
│   ├── lib/               ← geo math, units, formatting
│   └── styles/            ← tokens, theme
└── public/data/           ← cached DEM + flood grids (gitignored, fetched by script)
```

### Key Commands

```bash
pnpm install
pnpm dev          # vite dev server on :5173
pnpm build        # tsc -b && vite build
pnpm test         # vitest run
pnpm test:watch
pnpm lint         # eslint .
pnpm typecheck    # tsc --noEmit
pnpm format       # prettier --write .
```

### Conventions

- **Browser support:** Last 2 major Chrome/Edge/Firefox/Safari. WebGL2 required for the 3D
  view; a non-WebGL2 fallback showing 2D depth grids is required, not optional.
- **Performance constraint (the defining one):** Ugandan users are largely on mid-range
  Android over mobile data. Target 3D scene at ≤60 draw calls and adaptive quality tiers.
  The 3D view is a progressive enhancement over a 2D fallback, never the only path.
- **Accessibility conformance target:** WCAG 2.2 AA. A 3D canvas is not accessible on its own —
  every risk value exposed visually must also exist as keyboard-navigable text. This is a hard
  architectural constraint, not a phase-2 item.
- **Test strategy:** Integration-first (RTL + MSW), unit for pure geo math, E2E for one
  critical journey (load scene → select sub-county → read risk).
- **Commit message format:** conventional commits, description ≤12 words
- **Branch strategy:** GitHub Flow — `main` + `feature/*`, `fix/*`, `chore/*`

### Environment Setup

- **Required env vars:** see `.env.example` (to be created with the app scaffold)
- **Secrets:** database URL only. No API keys required for the core product — all data is
  open. This is deliberate: the demo must run with zero paid credentials.

### Checkpoints / Rollback Points

| Tag          | What it marks | Date |
| ------------ | ------------- | ---- |
| _(none yet)_ | —             | —    |

---

## Active Sprint

| Field       | Value                                      |
| ----------- | ------------------------------------------ |
| Sprint #    | 1 — not yet planned                        |
| Sprint goal | Standing 3D terrain + first flood scenario |
| End date    | —                                          |
| See also    | SPRINT_LOG.md                              |
