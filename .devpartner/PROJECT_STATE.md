# Project State — Ombros

> **Single source of truth for project continuity across sessions.**
> Read at the start of every session. It IS the memory.
> Last updated: 2026-10-05

---

## What Currently Works

| Feature / Component                                               | Verified by                           | Date       |
| ----------------------------------------------------------------- | ------------------------------------- | ---------- |
| Repo initialized + `.devpartner/` state files seeded              | `git init`, files on disk             | 2026-10-05 |
| Domain research: problem validated, public data sources confirmed | Web research (see ROADMAP → Evidence) | 2026-10-05 |

> No application code yet. This is a greenfield project at Unit 0.

---

## In Progress (Exact Next Step)

| Story/Task                                 | Current Unit   | Exact Next Action                                                                                                                                         | Files                                             |
| ------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| STORY-001 — Standing 3D scene over Kampala | Unit 1b (next) | Write failing `src/features/terrain/heightfield.test.ts` asserting vertex count from grid dims, Y from elevation samples, and a throw on non-square grids | `src/features/terrain/heightfield.ts` (to create) |

> **Scaffold is done.** Unit 1a covered toolchain setup plus the flood scenario model and geo
> helpers. Unit 1b is the terrain heightfield builder — a pure function producing a
> `THREE.BufferGeometry`, deliberately renderer-free so it is testable in jsdom.

---

## Broken / Blocked

| Issue    | Symptom | Blocking what | Owner |
| -------- | ------- | ------------- | ----- |
| _(none)_ | —       | —             | —     |

---

## Planned Next (Prioritized)

1. Unit 1b — `buildHeightfieldGeometry()` pure heightfield builder + tests
2. Unit 1c — DEM fetch/clip script producing `public/data/kampala-dem.bin`
3. Unit 1d — adaptive quality tiers (3 tiers, measured)
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
