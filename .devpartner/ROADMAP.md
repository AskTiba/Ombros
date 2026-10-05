# Roadmap — Ombros

> Vision, milestones, NFR targets, backlog snapshot, and risks.
> Last updated: 2026-10-05

---

## Vision

**One-sentence product vision:**

> Ombros is a 3D flood risk intelligence platform that turns Uganda's published flood modelling
> into explorable, testable, decision-ready analysis for city planners, insurers, and developers.

**Core problem solved:**

> Kampala loses an estimated US$49.6M annually to floods (World Bank), and KCCA needs UGX 768bn
> over five years to respond. But the analysis behind those numbers — which sub-county floods
> first, how deep, at what rainfall, and what a new drain actually buys — sits in PDF reports
> and GIS tools that require hydraulic modelling expertise to use. Planners, insurers, and
> developers cannot interrogate it. Ombros lets them.

---

## Evidence — Why This Is Feasible And Monetizable

Verified 2026-10-05 by web research. Every number below is from a citable public source.

### The budget exists

| Figure                                                                                         | Source                                                          |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| UGX 768bn needed over 5 years for drainage rehabilitation                                      | KCCA Parliamentary Committee briefing, Jul 2026                 |
| Shs 447.6bn Kampala City Drainage Improvement Project — 80km of channels, 103 flood blackspots | KCCA 2025/26–2029/30 Strategic Plan                             |
| US$49.6M average annual flood damage; US$101.4M from a 100-year flood                          | World Bank, Kampala Disaster Risk and Climate Change Resilience |
| 69 critical flood blackspots under active monitoring                                           | KCCA, Aug 2026                                                  |

Money is already appropriated and being spent. The gap is analytical tooling, not funding.

### The data exists

| Dataset                                            | Detail                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modelled flood extents for Kampala**             | McClean, Walsh, Lwasa & Ddumba (2021), Newcastle University + Makerere University. 2D finite-volume hydrodynamic model over a 5m DEM. Rainfall sampled at 20/40/60/80/100mm across 1/3/6-hour durations; depths thresholded at 0.1/0.2/0.3m. DOI 10.5285/e53dea2e-cb25-4f0f-b5f9-937eecf15aff. ⚠️ **GeoPackage, vector extents — not a depth raster** (ERR-001). Licence: **Open Government Licence v3.0**, verified 2026-10-05 |
| **Hourly precipitation, Kampala 2019-2020**        | Same study, same OGL licence. `https://catalogue.ceh.ac.uk/id/3df031ad-34ec-4abc-8528-f8f20bad12b8`                                                                                                                                                                                                                                                                                                                             |
| **Copernicus DEM GLO-30**                          | ⚠️ **Replaces the study's 5m DEM** (ADR-004, ERR-002). Free & open, no registration. `s3://copernicus-dem-30m` COG tiles; Kampala tile `Copernicus_DSM_COG_10_N00_00_E032_00_DEM` verified reachable                                                                                                                                                                                                                            |
| Green-space infiltration masks                     | Makerere University                                                                                                                                                                                                                                                                                                                                                                                                             |
| Buildings, drainage channels, catchment boundaries | OpenStreetMap                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Live + historical rainfall                         | NASA CHIRPS                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Observed flood extent validation                   | Sentinel-1 SAR (Copernicus)                                                                                                                                                                                                                                                                                                                                                                                                     |
| Drainage network extents                           | KCCA: 362.3km across 8 catchments (Nakivubo, Lubigi, Walufumbe, Nalukolongo, Kansanga, Kinawataka, Nakamiro, Mayanja); ~700km tertiary                                                                                                                                                                                                                                                                                          |

### The buyer is identified

KCCA's own departments, climate-finance programs (GCF, Adaptation Fund), the World Bank's
GKMA program, and Ugandan insurers needing accumulation-period risk. The credible first sale
is a **single-sub-county flood risk report** — a deliverable, not a subscription. That is
achievable without enterprise procurement cycles.

### Market precedent, no competition

Hydro3DJS (Univ. of Iowa, _Environmental Modelling & Software_ 2026) proves browser 3D flood
visualization works and has been published for US watersheds. Nobody has built it for Kampala.
We are not inventing the method; we are applying it where the money and the risk are.

---

## MVP Scope (MoSCoW)

| Priority            | Feature                                                                    | Status                                                                          | Sprint                                              |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Must Have**       | Terrain from Copernicus GLO-30 DEM as a 3D heightfield (ADR-004)           | 🟡 In progress — heightfield builder done (ADR-005, ADR-006); DEM fetch pending | 1                                                   |
|                     | Published flood extent classes → animated water surface (ADR-003)          | ⏸ Not started                                                                   | 1                                                   |
|                     | OSM building footprints extruded against terrain                           | ⏸ Not started                                                                   | 1                                                   |
|                     | Scenario control: rainfall depth × duration                                | ⏸ Not started                                                                   | 2                                                   |
|                     | Click-to-query sub-county risk readout (depth, extent, exposed population) | ⏸ Not started                                                                   | 2                                                   |
|                     | Drainage intervention what-if overlay                                      | ⏸ Not started                                                                   | 3                                                   |
|                     | Shareable single-sub-county risk report                                    | ⏸ Not started                                                                   | 3                                                   |
|                     | 2D fallback path, fully accessible                                         | ⏸ Not started                                                                   | 1                                                   |
| **Should Have**     | Sentinel-1 observed-flood validation overlay                               | ⏸ Not started                                                                   | 4                                                   |
|                     | CHIRPS historical rainfall replay                                          | ⏸ Not started                                                                   | 4                                                   |
|                     | Saved scenarios + PDF report generation                                    | ⏸ Not started                                                                   | 4                                                   |
| **Could Have**      | Own MCP server so an agent can query district risk                         | ⏸ Not started                                                                   | 5                                                   |
|                     | Jinja / Mbale extension                                                    | ⏸ Not started                                                                   | 6                                                   |
|                     | Public share links with OG imagery                                         | ⏸ Not started                                                                   | 5                                                   |
| **Won't Have (v1)** | Real CFD / live hydraulic solver                                           | ❌ Excluded                                                                     | ADR-001                                             |
|                     | Mobile-money settlement, payments, invoicing                               | ❌ Excluded                                                                     | Not v1; monetization starts as a direct report sale |
|                     | Multi-city                                                                 | ❌ Excluded                                                                     | Needs Kampala proven first                          |
|                     | User accounts / auth                                                       | ❌ Excluded                                                                     | Reports served via signed share links for v1        |

---

## Milestones

| #   | Milestone                                                  | Target date | Status | Key features                                        |
| --- | ---------------------------------------------------------- | ----------- | ------ | --------------------------------------------------- |
| M1  | **The demo.** A 3D Kampala you can drop rain on.           | TBD         | ⏸      | Terrain, water surface, buildings, scenario control |
| M2  | **The analysis.** Sub-county risk readout + interventions. | TBD         | ⏸      | Click-to-query, drainage what-if                    |
| M3  | **The sale.** A report a planner will actually pay for.    | TBD         | ⏸      | Shareable report, PDF export                        |
| M4  | **The agent surface.** Risk queryable by LLM.              | TBD         | ⏸      | Ombros MCP server                                   |

---

## Non-Functional Requirements (NFR Targets)

> The performance targets are the design constraint, not an afterthought. Target users are on
> mid-range Android over mobile data — if the 3D view doesn't degrade gracefully, there is no
> product.

| Requirement                     | Target                                           | Measurement method                          | Current baseline                                                                                                            |
| ------------------------------- | ------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 3D scene draw calls             | ≤60                                              | `renderer.info.render.calls` in dev overlay | _(not measured yet)_                                                                                                        |
| 3D scene frame rate             | ≥30fps mid-range Android, ≥60 desktop            | `renderer.info` + Playwright perf trace     | _(not measured yet)_                                                                                                        |
| Adaptive quality tiers          | 3 tiers, auto-selected on measured perf          | Playwright, throttled CPU                   | _(not measured yet)_                                                                                                        |
| DEM + grid payload (first load) | ≤3MB compressed, progressive                     | Bundle/network panel                        | **Projected 0.92MB** for a 30m grid quantised to uint16 (642×750 = 481,500 samples). Unverified until 1c produces the file. |
| 2D fallback LCP                 | <2.5s on 4G                                      | Lighthouse                                  | _(not measured yet)_                                                                                                        |
| 3D view time-to-interactive     | <5s on mid-range Android                         | Lighthouse throttled                        | _(not measured yet)_                                                                                                        |
| API response (p95)              | <200ms                                           | Load test                                   | _(not measured yet)_                                                                                                        |
| Concurrent users                | 500                                              | Load test                                   | _(not measured yet)_                                                                                                        |
| Accessibility                   | WCAG 2.2 AA, canvas has equivalent keyboard path | axe-core + manual audit                     | _(not measured yet)_                                                                                                        |
| Zero paid credentials           | Core product runs with no API keys               | CI env check                                | _(not measured yet)_                                                                                                        |

### Performance Log

| Date                 | Metric | Value | Notes |
| -------------------- | ------ | ----- | ----- |
| _(not measured yet)_ |        |       |       |

---

## Backlog Snapshot

> Full backlog is in BACKLOG.md once sprint planning runs.

### Ready for next sprint

| ID        | Story                                          | Points | Priority  |
| --------- | ---------------------------------------------- | ------ | --------- |
| STORY-001 | Standing 3D terrain over Kampala               | 5      | Must Have |
| STORY-002 | Published depth grid as animated water surface | 5      | Must Have |
| STORY-003 | OSM buildings extruded against terrain         | 3      | Must Have |
| STORY-004 | Rainfall scenario control (depth × duration)   | 5      | Must Have |
| STORY-005 | Accessible 2D fallback                         | 5      | Must Have |
| STORY-006 | Sub-county risk readout                        | 5      | Must Have |
| STORY-007 | Drainage intervention what-if                  | 8      | Must Have |
| STORY-008 | Shareable risk report                          | 8      | Must Have |

---

## Risks

| ID       | Risk                                                                                                                                                           | Probability | Impact   | Mitigation                                                                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RISK-001 | WebGL scene too slow on mid-range Android — product unusable in its target market                                                                              | High        | Critical | 3-tier adaptive quality, 2D fallback as a first-class path (ADR-002), measure before optimizing                                                                                                                                                                |
| RISK-002 | Source data licensing blocks redistribution in a hosted product                                                                                                | Medium      | High     | Verify licence before building download/distribution paths; cache derived rasters, not the originals                                                                                                                                                           |
| RISK-003 | Visualizing published data is less differentiated than it looks                                                                                                | Medium      | Medium   | The defensibility is intervention modelling + the report artifact, not the rendering. Build toward those.                                                                                                                                                      |
| RISK-004 | 5m DEM citywide is a large payload that breaks mobile data budgets                                                                                             | Medium      | High     | Progressive tile loading, depth-grid simplification, aggressive quantization                                                                                                                                                                                   |
| RISK-005 | No paying customer materializes — demo never becomes revenue                                                                                                   | Medium      | High     | M3 is defined as an actual report, not a feature. Approach KCCA departments and insurers directly.                                                                                                                                                             |
| RISK-006 | Portfolio project reads as "visualized someone else's dataset"                                                                                                 | Medium      | Medium   | Own the scenario/intervention engine and the MCP surface. Lead the README with the decision capability, not the rendering.                                                                                                                                     |
| RISK-007 | Accuracy expectations exceed what a visualization can support                                                                                                  | **High**    | High     | Source data is extent classes on a 30m terrain, not per-cell depth on the study's 5m DEM (ERR-001, ERR-002). Never display a continuous depth value (ADR-003). Publish method and limitations prominently. Show observed SAR extent alongside modelled extent. |
| RISK-008 | Flood extents are vector polygons — 45 scenario/threshold combinations over a whole city may not fit the ≤3MB payload budget after conversion to depth classes | High        | Medium   | Rasterize each extent class to a compact binary at build time; validate payload against target in Unit 1 before building the render path                                                                                                                       |
