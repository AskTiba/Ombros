# Error Log — Ombros

> Every non-trivial error is logged here at the time it's resolved.
> Newest entries at top. Last updated: 2026-10-05

---

## Format

```
## ERR-[NNN] — [Date] — [Short title]

| Field | Content |
|---|---|
| **Context** | What task was in progress |
| **Symptom** | What was observed |
| **Root cause** | Actual underlying cause |
| **Resolution** | What was changed — file/line references |
| **Prevention** | What catches this earlier next time |
| **Related** | Links to other entries |
```

---

## Errors

_(No errors logged yet — add newest at the top)_

---

## ERR-001 — 2026-10-05 — Source flood dataset is vector extents, not depth rasters

| Field          | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context**    | Pre-flight data verification before Unit 1. PROJECT_STATE assumed a raster "depth grid → water surface" pipeline based on the dataset title and the depth-threshold values quoted in search metadata.                                                                                                                                                                                                                                                                                                             |
| **Symptom**    | Catalog record reports `Spatial representation type: Vector`, `Format: GeoPackage`. There is no raster depth product.                                                                                                                                                                                                                                                                                                                                                                                             |
| **Root cause** | The metadata sentence "Maximum depths were converted into extents using various thresholds" means the _thresholds were applied before publishing_ — each published layer is a binary footprint (inside ≥0.1m, ≥0.2m, or ≥0.3m), not a continuous depth value. Our earlier reading treated the thresholds as if depth rasters were published separately.                                                                                                                                                           |
| **Resolution** | Pipeline is extent-based, not depth-value-based. For each rainfall scenario × threshold we hold one polygon set. Per-cell depth is **not** available and must not be implied. Storage is GeoPackage (WGS 84), which we parse at build time into our own compact binary rather than shipping the GeoPackage to the browser. Design impact: the water surface renders as stacked threshold layers, and a numeric depth readout shows a _class_ (">0.3m"), never a false point value. Requires an ADR — see ADR-003. |
| **Prevention** | Any dataset claim is verified against the publisher's own catalog record (format, spatial representation type, CRS), never against a third-party summary or search snippet.                                                                                                                                                                                                                                                                                                                                       |
| **Related**    | ADR-003, RISK-007                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## ERR-002 — 2026-10-05 — The 5m DEM is not redistributable in a hosted product

| Field          | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context**    | Same verification pass. Unit 1 requires a terrain heightfield.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Symptom**    | The source study states its DEM "was obtained from Makerere University" — it is an input to their model, **not** a published deliverable of this dataset. It is not in the GeoPackage.                                                                                                                                                                                                                                                                                                                                                                                 |
| **Root cause** | Institutional DEM is typically research-licensed, not open. Assuming it ships with the flood dataset was an unverified inference.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Resolution** | Use **Copernicus DEM GLO-30** for terrain instead. Verified free & open licence; public S3 bucket `s3://copernicus-dem-30m` (`eu-central-1`, Cloud Optimized GeoTIFF, no AWS account required, STAC endpoint available). Confirmed the Kampala-covering tile `Copernicus_DSM_COG_10_N00_00_E032_00_DEM` exists and is publicly reachable — HTTP 206 on a range request. Note 30m vs the study's 5m: terrain is coarser than the flood model's resolution, which must be stated in any output so depth classes are not over-interpreted. Requires an ADR — see ADR-004. |
| **Prevention** | Distinguish clearly between a study's _inputs_ and its _outputs_. Only outputs are downloadable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Related**    | ADR-004, RISK-007                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

---

## Pre-flight Data Verification Log

> Verification steps run before trusting any external dataset. Results recorded here so a later
> session doesn't assume it was already checked.

| Dataset                                          | Check                                            | Result                                                                                                                                       | Date       |
| ------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Modelled flood extents** (McClean et al. 2021) | Licence permits use/redistribution               | ✅ **Open Government Licence** (OGL v3.0). Attribution required, commercial use permitted, derivatives permitted. Blocker cleared.           | 2026-10-05 |
|                                                  | Format + spatial type                            | ⚠️ **GeoPackage, Vector, WGS 84** — NOT a depth raster. See ERR-001.                                                                         | 2026-10-05 |
|                                                  | Scenario coverage                                | ✅ 20/40/60/80/100mm rainfall × 1/3/6h duration × 0.1/0.2/0.3m depth thresholds — 45 scenario/threshold combinations                         | 2026-10-05 |
|                                                  | Download endpoint                                | ✅ `https://data-package.ceh.ac.uk/data/e53dea2e-cb25-4f0f-b5f9-937eecf15aff` (HTTP 200; landing page requires form submission for the zip)  | 2026-10-05 |
|                                                  | Temporal extent                                  | ✅ 2018-11-01 → 2020-10-31 (rainfall period used in simulation)                                                                              | 2026-10-05 |
| **Makerere 5m DEM**                              | Published?                                       | ❌ **Not available** — study input only, not a deliverable. See ERR-002.                                                                     | 2026-10-05 |
| **Copernicus DEM GLO-30** (substitute)           | Licence                                          | ✅ Free & open, ESA Free & Open Licence. No registration required.                                                                           | 2026-10-05 |
|                                                  | Access path                                      | ✅ `s3://copernicus-dem-30m`, `eu-central-1`, Cloud Optimized GeoTIFF, no account needed. STAC endpoint available.                           | 2026-10-05 |
|                                                  | Kampala tile exists + reachable                  | ✅ `Copernicus_DSM_COG_10_N00_00_E032_00_DEM` confirmed present in bucket listing; HTTP 206 on range request                                 | 2026-10-05 |
|                                                  | Uganda in GLO-30 restricted set?                 | ✅ Not restricted — adjacent tiles E030–E039 all public at N00                                                                               | 2026-10-05 |
| **OSM buildings**                                | Extraction path + cost                           | ⏳ PENDING                                                                                                                                   | —          |
| **CHIRPS rainfall**                              | Access path, resolution, lag                     | ⏳ PENDING                                                                                                                                   | —          |
| **Sentinel-1 SAR**                               | Access path, revisit over Kampala                | ⏳ PENDING                                                                                                                                   | —          |
| **KCCA drainage geometry**                       | Channel centerlines published or only described? | ⏳ PENDING                                                                                                                                   | —          |
| **Related dataset**                              | Hourly precipitation Kampala 2019-2020           | ✅ Found: `https://catalogue.ceh.ac.uk/id/3df031ad-34ec-4abc-8528-f8f20bad12b8` — same study, same licence, 174-download precedent for reuse | 2026-10-05 |
