# Ombros

**Rain, simulated. Risk, quantified.**

Ombros is a 3D flood risk intelligence platform for Kampala. It turns Uganda's published flood
modelling into something a city planner, insurer, or developer can actually interrogate: drop a
rainfall event on the city, watch which sub-counties flood and how deep, test whether a
proposed drainage channel changes the outcome, and export a risk report.

<!-- TODO(portfolio-partner): capture a demo GIF or screenshot of the 3D scene before this
     README is considered done. The "Show, Don't Tell" gate fails without it. -->

---

## The Problem

Kampala floods every rainy season, and it kills people — Buddo, Kinawataka, Katookye, and the
Nakivubo channel corridor have all flooded repeatedly. The city is losing real money doing
nothing: the World Bank estimated **US$49.6M in average annual flood damage**, rising to
US$101.4M in a 100-year event. KCCA told Parliament in July 2026 it needs **UGX 768 billion
over five years** to rehabilitate its drainage network, and the Kampala City Drainage
Improvement Project is budgeted at Shs 447.6bn to upgrade 80km of channels and tackle 103
flood blackspots.

The money is there. The analysis is the bottleneck.

KCCA tracks **69 critical flood blackspots**. But the modelling that produces these numbers
lives in PDF reports and desktop GIS tools that require a hydraulic modelling background to
open. So the questions that actually matter — _which sub-county floods first? How deep? At what
rainfall? What does this new drain actually buy?_ — cannot be answered by the people making
the decisions.

## Why This Is Different

The hydrology already exists, and Uganda's own researchers produced it.

**McClean, Walsh, Lwasa & Ddumba (2021)**, Newcastle University with Makerere University,
published [modelled flood extents for Kampala](https://doi.org/10.5285/e53dea2e-cb25-4f0f-b5f9-937eecf15aff)
— a 2D finite-volume hydrodynamic model run over a **5m digital elevation model**, sampling
rainfall at 20/40/60/80/100mm across 1/3/6-hour durations with depths thresholded at
0.1/0.2/0.3m. That is a peer-reviewed, openly licensed, Kampala-specific flood model, freely
available.

Ombros does not try to outdo that. It does the four things the dataset can't:

1. **Renders it explorably in 3D** — terrain, buildings, and an animated water surface, in the browser, no plugin.
2. **Layers it against the city** — OSM building footprints extruded against terrain, so you see which structures stand in water.
3. **Tests interventions** — sketch a drainage channel and see what it changes.
4. **Produces a decision artifact** — a risk report a planner or insurer will sign off on.

The defensible part is not the rendering. It's the intervention modelling and the report.

## Quick Start

```bash
git clone <repo-url> && cd ombros
pnpm install
pnpm dev
```

Requires **zero API keys.** All data is open. Then see `scripts/fetch-data` for the
geospatial fetch step.

## Tech Stack

| Layer      | Technology                                        |
| ---------- | ------------------------------------------------- |
| 3D         | Three.js + @react-three/fiber                     |
| Framework  | React 19 + Vite + TypeScript (strict)             |
| Styling    | Tailwind CSS v4                                   |
| Database   | PostgreSQL 16 + Drizzle ORM                       |
| Validation | Zod                                               |
| Testing    | Vitest + React Testing Library + MSW + Playwright |

## Roadmap

- [ ] 3D Kampala terrain with rainfall you can control
- [ ] Sub-county flood depth and exposed-population readout
- [ ] Drainage intervention what-if
- [ ] Exportable risk report
- [ ] MCP server so an AI agent can query district risk

## Contributing

See [AGENTS.md](AGENTS.md) for architecture rules and development conventions.
