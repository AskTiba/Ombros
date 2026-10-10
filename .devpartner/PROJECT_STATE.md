# Project State — Ombros

> **Single source of truth for project continuity across sessions.**
> Read at the start of every session. It IS the memory.
> Last updated: 2026-10-10

---

## What Currently Works

| Feature / Component                                                               | Verified by                                                                                             | Date       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| Repo initialized + `.devpartner/` state files seeded                              | `git init`, files on disk                                                                               | 2026-10-05 |
| Domain research: problem validated, public data sources confirmed                 | Web research (see ROADMAP → Evidence)                                                                   | 2026-10-05 |
| Toolchain scaffold: Vite + React 19 + strict TS + Vitest + ESLint                 | `pnpm build`, `pnpm typecheck`, `pnpm lint`                                                             | 2026-10-05 |
| Kampala bounds + NDC/lon-lat helpers (`src/lib/geo.ts`)                           | `src/lib/geo.test.ts` (12 tests)                                                                        | 2026-10-05 |
| Flood scenario model + depth classes (`src/features/flood/types.ts`)              | `src/features/flood/types.test.ts` (9 tests)                                                            | 2026-10-05 |
| Terrain heightfield builder — `buildHeightfieldGeometry()`                        | `src/features/terrain/heightfield.test.ts` (37 tests)                                                   | 2026-10-05 |
| Test collection scoped to `src/` only (ERR-003 fixed)                             | 6 files / 116 tests / 16s                                                                               | 2026-10-05 |
| Type-check gate actually checks files (ERR-006 fixed)                             | `tsc --listFiles` 263; canary proven to fail                                                            | 2026-10-05 |
| CI mirrors the commit gate, order and all                                         | `actionlint` clean; local gate green                                                                    | 2026-10-05 |
| DEM fetched from the live COG, resampled, quantised, round-tripped                | 643x746, 0.91MB, step 2.93mm, peak at Kololo Hill                                                       | 2026-10-05 |
| DEM transport layer — fetch → decode with typed failures (`loadDemGrid`)          | `loadDem.test.ts` (7 tests) through MSW                                                                 | 2026-10-06 |
| WebGL2 probe + scene gate — fallback or lazy scene, never an empty canvas         | `supportsWebGl2.test.ts` (4) + `SceneGate.test.tsx` (3)                                                 | 2026-10-06 |
| Terrain scene mounted end-to-end — probe → gate → mesh, ×2 exaggeration disclosed | `TerrainScene.test.tsx` (5) + `App.test.tsx` (3); suite 135/10                                          | 2026-10-07 |
| Load-time grid decimation for quality tiers — extent-preserving, band re-derived  | `decimateGrid.test.ts` (7 tests)                                                                        | 2026-10-07 |
| Quality tier model — display-only config, conservative initial selection          | `qualityTiers.test.ts` (8 tests); ADR-013                                                               | 2026-10-07 |
| Runtime frame-time sampler + device-signal adapter                                | `frameRateSampler.test.ts` (8) + `deviceSignals.test.ts` (4) — asymmetric hysteresis                    | 2026-10-07 |
| Terrain-vanishing crash fixed — `decimateGrid` band re-derivation, no spread      | `decimateGrid.test.ts` full-resolution case; stride 4/2/1 proven in a real browser                      | 2026-10-09 |
| 3D scene placed mid-page beside the accessible 2D map, with a feature heading     | `App.test.tsx` `compareDocumentPosition` order assertion                                                | 2026-10-09 |
| Cartographic surface: baked tint × hillshade, no scene lights                     | `hillshade.test.ts` (6) + `surfaceColors.test.ts` (13); byte-exact water in-browser                     | 2026-10-10 |
| Wetland/lake water mask — flat and low, cross-verified against ILEC + DEM         | `waterMask.test.ts` (6); 7.6% flag rate matches offline analysis                                        | 2026-10-10 |
| Contour lines at 20m, cut from the triangulated mesh, visible without lifting     | `contours.test.ts` (8); 393 → 8,699 visible px in a real browser                                        | 2026-10-10 |
| Cut-slab base closing the heightfield into a solid specimen                       | `slab.test.ts` (25); 3,486 px band with full rim→floor gradient                                         | 2026-10-10 |
| Orientation overlay — compass, scale bar, extent caption                          | `orientation.test.ts` (20) + `SceneOrientation.test.tsx` (10); orbit-tracked                            | 2026-10-10 |
| Camera pans across the city, clamped to the study extent, resettable from compass | `sceneNavigation.test.ts` (10) + `TerrainScene.test.tsx` (4); 63k px still on screen after a 2500px pan | 2026-10-10 |
| 2D map is the real terrain, not a placeholder — same DEM, tint, hillshade, mask   | `terrainMap.test.ts` (11) + `TerrainMap2D.test.tsx` (6); 90 colour buckets, 7.0% water in-browser       | 2026-10-10 |

> 335 tests across 119 files, all green (sequential file runs — ERR-010). `public/data/kampala-dem.bin` is written and gitignored —
> regenerate with `node scripts/fetch-dem.mjs` (needs Node 22.18+/24 for type stripping).
> With WebGL2, `TerrainScene` mounts the lit terrain mesh in-app; jsdom and
> no-WebGL2 browsers get `SceneFallback` through the real probe. Sequential test
> files keep the gate deterministic under load (ERR-010).
> See "Planned Next" for the exact next step.

---

## In Progress (Exact Next Step)

| Story/Task                                 | Current Unit                                                     | Exact Next Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Files                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STORY-001 — Standing 3D scene over Kampala | Cartographic treatment (shading · contours · slab · orientation) | **Cartographic treatment complete** (`b99c259`, `7d86ba9`, `6ba63df`), directed by the owner after the crash and placement fixes: "I see Kampala in 3D but none of it makes any sense, it all looks like some random clay art work." Chosen remedy was verified lake/wetland water, contour lines, cartographic hillshade, an orientation overlay and a cut-slab base — all pure functions of the DEM already held, so no new external data and no new verification rows. **Shading** (`b99c259`): scene lights removed entirely; hypsometric tint × hillshade baked into vertex colours so the cartographic reading survives orbiting, where a directional light would re-light the terrain into whatever sun angle the camera faces. Water from `waterMask.ts` (slope ≤0.1°, elevation ≤1,140m — cross-verified against ILEC's 1,134m and the DEM's measured 1,133.0m flat-region median). **Colour management root-caused:** r3f defaults to ACESFilmicToneMapping and reads vertex colours as already-linear, so hexes were encoded twice and the tone curve reinterpreted every chosen colour; `hexToLinearRgb` plus `<Canvas flat>` fixes it, and water now renders byte-exact rgb(74,168,192). **Contours were invisible for two independent reasons.** Geometry: they were cut from the bilinear patch, which sits up to 48 model units _inside_ the triangulated mesh (twist/4 measured 11.96m / 5.05m / 2.41m at strides 4 / 2 / 1). Draw order: three.js sorts opaque front-to-back, so the lines could be submitted before the surface and overwritten at equal depth. Contouring the rendered triangles, plus `renderOrder` and a 2-quantum `polygonOffset`, takes visible contour pixels **393 → 8,699 with zero world-space lift** — the lines sit exactly on the ground they describe. **Slab** (`7d86ba9`): `slab.ts` closes the grid into a solid — one wall per boundary edge, floor derived from the _global_ minimum (the lake is interior, so a boundary-derived floor would let the terrain poke through its own base), colours baked with a vertical falloff because there are no lights. Framing moved to the centre of the whole model; targeting the surface alone clipped the base to a 206px rim. **Orientation** (`6ba63df`): `orientation.ts` (pure, 20 tests) + `SceneOrientation.tsx`. Compass aim and scale bar are separate handle methods because only the bar needs layout. It writes style properties directly — OrbitControls fires on every pointer move and inertia frame, and re-rendering the scene subtree to turn one arrow is exactly the cost the mid-range-Android budget cannot absorb. No edge labels: they would claim the canvas top is north for most of the time the user is orbiting, so the overlay states the bounds instead. Verified in a browser: identity rotation at azimuth 0, a 5km bar at 120px within budget, and the compass tracking an orbit to a 125° matrix. **Navigation** (`bc06345`): pan was off — the pivot was welded to the centre, so zooming walked the camera at the middle of the city while everything else left the frame with no way back. It is on now, but the pivot is clamped to the study extent (`clampTargetWithin`), because an unclamped pivot can be dragged until the model is entirely off-canvas and the only recovery is hunting for a reset with one thumb. The camera rides along with the correction: snapping only the pivot would change the view direction and jerk the sideways every time it met a wall. The compass became a real `<button>` reset, which is the Google Earth/Cesium convention — once you can pan, the thing you are already looking at to find north is also the way back. `pointer-events: auto` on it is inline rather than a utility class because a leak there would silently kill the only way out of a panned view. Browser-verified: a 2500px pan still leaves 63k model pixels on screen (the clamp holding), pan leaves the compass at identity and the bar at 120px (correct — pan preserves distance and azimuth), and reset lands within 0.13% of the opening framing. 323 tests / 120 files green, CI green on all four commits. **Placeholder removed** (`fda784c`): the section titled "Baseline flood map" drew two hard-coded circles from `createBaselineScenario`'s two synthetic points — there is no hydrodynamic result anywhere in this product (ADR-001), so it was a placeholder that had outstayed its welcome and it read to the owner as "two circular shapes of different colors and sizes on a dark background" with no meaning. Replaced with `terrainMap.ts` + `TerrainMap2D.tsx`: the same DEM, the same `buildSurfaceColors` call and the same wetland mask the 3D mesh uses, nearest-neighbour sampled to 480px and encoded to sRGB (`linearToSrgb`, added because a canvas has no colour pipeline of its own — without it the map renders the linear values as a muddy smear). The mask is computed once and shared via a new optional `waterMask` parameter so the wet fraction can be quoted in the accessible name without a second pass. Section renamed to "Kampala terrain and wetlands" and the caption states plainly that it is not a prediction of where water would go. `Scenario2D` and `scenarioWater` deleted — unused, and they encoded the fabricated data. Verified in a browser: 90 colour buckets (was 2 shapes), 7.0% water against the offline 7.6%, aspect 0.862 matching 19.3km x 22.3km, luminance mean 143 with a real relief spread, zero page errors. 335 tests / 119 files green. | `hillshade.ts`, `waterMask.ts`, `surfaceColors.ts`, `hypsometric.ts`, `contours.ts`, `slab.ts`, `orientation.ts`, `SceneOrientation.tsx`, `TerrainScene.tsx`, `globals.css` |

> **Sequencing changed 2026-10-06:** Unit 1e (the scene) now comes before Unit 1d (quality tiers). The plan calls for _measured_ tiers, and measuring needs a renderer to measure against — building tier budgets first would mean inventing them (measure before optimizing). 1d follows 1e immediately and plugs into the scene's grid input; a 30m grid at 479,678 vertices is heavy for the mid-range Android this is built for.

> **Unit 1c-iii is done.** The source tile was verified rather than assumed: `N00_00_E032_00`
> covers 32-33E / 0-1N and so does contain the study extent; samples are float32 EGM2008; the
> grid is 1 arcsecond, i.e. **~30.71m N-S and ~30.92m E-W, not 30m** — that asymmetry is real and
> is disclosed rather than hidden (RISK-007). The resample is anchored to the exact WGS84 bounds
> while `geotiff` anchors to the window pixel grid, so the two implementations agree at
> **Pearson 0.997** (mean diff 1.67m) rather than exactly. The grid peak lands at 1317.6m on
> **Kololo Hill**, which is the highest ground in Kampala — the geographic check that a
> round trip cannot give you, since a transposed or flipped raster decodes perfectly.

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

1. **Unit E** — verification pass on the redesigned shell and scene: 320/375/768/1024/1440 + landscape + ultrawide, keyboard, per-theme contrast, screen reader. **Next.**
2. Unit 2 — flood extent classes → animated water surface
3. Unit 3 — accessible 2D depth view
4. Unit 4 — sub-county risk readout
5. Unit 5 — shareable risk report (the monetization unit)

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

| Layer       | Technology                                       | Version               | Notes                                                                                                                         |
| ----------- | ------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Runtime     | Node                                             | ^20.19.0 \| >=22.12.0 | pnpm 11.16. Engine floor is Vite 7's, not an arbitrary choice (CI `engine-floor` job proves it)                               |
| Framework   | React                                            | 19.3                  | Vite 7, TypeScript 5.9 strict                                                                                                 |
| 3D          | Three.js + @react-three/fiber + drei             | 0.182 / 9.8 / 10.7    | R3F over raw Three.js — declarative scene graph fits React data flow                                                          |
| Styling     | Tailwind CSS                                     | 4.3                   | CSS-first tokens, via `@tailwindcss/vite`                                                                                     |
| Data layer  | PostgreSQL + Drizzle ORM                         | 16 / 0.4x             | Matches existing portfolio convention                                                                                         |
| Validation  | Zod                                              | 4.6                   |                                                                                                                               |
| Testing     | Vitest 3.2 + RTL 16 + MSW 2.15 + Playwright 1.57 |                       | Integration-first. MSW pinned to v2 — v3 crashes under Vitest jsdom (ERR-008). Added with the first network call (Unit 1e-i). |
| Lint/format | ESLint 9 flat + Prettier 3                       |                       | typescript-eslint 8.71                                                                                                        |

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
- **CI mirrors the commit gate exactly:** format check → lint → type-check → test → build,
  in that order. `.github/workflows/ci.yml` must not diverge from what runs locally; a
  divergence is a gap, not a convenience. `actionlint` clean is part of the gate.
- **Design system (ADR-014):** "Water-Clarity Teal". Tokens live in `src/styles/globals.css`
  under Tailwind v4 `@theme` (emitted to `:root`); components reference token utilities
  (`bg-surface-*`, `text-text-*`, `border-border`, `text-accent`) — never hardcoded hex.
  Theming is light/dark/system: light is the default `@theme` value, dark is a
  `prefers-color-scheme: dark` override on `:root`; `color-scheme: light dark` lets OS chrome
  follow. Depth-class ramp (`--color-water-100/200/300`) is data encoding (ADR-003), single-hue,
  shared meaning across themes. Content-based breakpoints: mobile ~320–599, tablet ~600–1023,
  desktop ≥1024 — prefer fluid `clamp()` type and grid over breakpoint nudges.

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
