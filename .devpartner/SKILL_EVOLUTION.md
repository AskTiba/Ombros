# Skill Evolution — Ombros

> Read at the START of every session, before anything else. Updated at the END of every
> session and every sprint retrospective. These entries OVERRIDE the defaults in BOOT.md and
> the SKILL.md files for this project.
> Last updated: 2026-10-05

---

## Developer Preferences

| Date       | Preference                                                                                                                           | Context                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-05 | Verify claims against real sources before building on them. Do not accept a plausible-sounding data source or name without checking. | I proposed the name "Naka" as Luganda for "water". It isn't — water is _amazzi_. Developer pushed back. Root cause was pattern-matching a plausible-looking word instead of consulting a dictionary. |
| 2026-10-05 | Reject names that collide with existing local businesses.                                                                            | "Amazzi" was verified-correct Luganda but was rejected because Amäzi Foods, a Ugandan agricultural supply chain company, already owns that branding. Local name collision matters.                   |

---

## Project-Specific Conventions

| Date       | Convention                                                                                                                                                                                            | Established in                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-05 | Never describe data as available, licensed, or free without a recorded verification. Every external dataset has a row in `ERROR_LOG.md` → Pre-flight Data Verification Log before it is used in code. | ADR-001. This project has many candidate datasets and one licensing question that could block hosted distribution entirely. |
| 2026-10-05 | Lead every user-facing surface and README claim with decision capability, not rendering.                                                                                                              | RISK-006. The dataset is not the achievement.                                                                               |

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
