#!/usr/bin/env node
/**
 * Fetches the published Kampala flood extents and rasterises them onto the DEM grid.
 *
 * Output: `public/data/kampala-flood-<rainfall>-<duration>.bin` — one file per
 * scenario, in the format `decodeFloodBinary` reads. Both the zip and the
 * GeoPackage are cached alongside them. Everything here is gitignored; the
 * source of record is the EIDC package below.
 *
 * ## The dataset
 *
 * McClean, F.; Walsh, C.; Lwasa, S.; Ddumba, D. (2021). *Modelled flood
 * extents for Kampala, Uganda*. NERC EDS Environmental Information Data Centre.
 * https://doi.org/10.5285/e53dea2e-cb25-4f0f-b5f9-937eecf15aff
 *
 * Licence: Open Government Licence v3.0 — verified in the Pre-flight Data
 * Verification Log (ERR-001). Attribution is required; `ATTRIBUTION` below is
 * reproduced in the app's output.
 *
 * ## Run it with Node 22.18+ or 24
 *
 * As with `fetch-dem.mjs`, this imports project sources directly and relies on
 * native type stripping. Duplicating `KAMPALA_BOUNDS` would be a second source
 * of truth for the study extent, and a boundary that disagrees by 0.0001°
 * places the flood polygons visibly off the terrain they have to overlay.
 *
 * ## Why the maths is not here
 *
 * Everything that could be wrong with the *data* — WKB parsing, the scanline
 * fill, the bit packing, the file format — lives in `src/features/flood/` and
 * is unit tested. This file does the three things that cannot be tested
 * offline: download an archive, read SQLite, write bytes.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { KAMPALA_BOUNDS } from '../src/lib/geo.ts';
import { readZipEntry } from '../src/features/flood/readZip.ts';
import { readGeoPackagePolygon } from '../src/features/flood/geoPackageGeometry.ts';
import { rasterizeFlood } from '../src/features/flood/rasterizeFlood.ts';
import {
  FLOOD_DURATION_SECONDS,
  FLOOD_RAINFALL_MM,
  encodeFloodBinary,
  floodBinaryUrl,
} from '../src/features/flood/floodBinary.ts';

const PACKAGE_DOI = 'https://doi.org/10.5285/e53dea2e-cb25-4f0f-b5f9-937eecf15aff';
const PACKAGE_URL =
  'https://data-package.ceh.ac.uk/data/e53dea2e-cb25-4f0f-b5f9-937eecf15aff.zip';
const GPKG_ENTRY = 'data/flood_extents.gpkg';

/** Threshold index -> bit. Matches `rasterizeFlood`'s contract. */
const BITS = [1, 2, 4];

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const DATA_DIR = resolve(REPO_ROOT, 'public/data');
const ZIP_PATH = resolve(DATA_DIR, 'kampala-flood-src.zip');
const GPKG_PATH = resolve(DATA_DIR, 'kampala-flood-src.gpkg');
const DEM_PATH = resolve(DATA_DIR, 'kampala-dem.bin');

const log = (...parts) => console.log('[flood]', ...parts);

/** Reads cols/rows from the DEM header so both rasters share one grid. */
async function readDemGrid() {
  if (!existsSync(DEM_PATH)) {
    throw new Error(`${DEM_PATH} is missing — run \`node scripts/fetch-dem.mjs\` first.`);
  }
  const bytes = await readFile(DEM_PATH);
  if (bytes.toString('ascii', 0, 4) !== 'OMBS') {
    throw new Error(`${DEM_PATH} is not an Ombros DEM.`);
  }
  return { cols: bytes.readUInt32LE(8), rows: bytes.readUInt32LE(12) };
}

async function ensurePackage() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(ZIP_PATH)) {
    log(`downloading ${PACKAGE_URL}`);
    const response = await fetch(PACKAGE_URL);
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    await writeFile(ZIP_PATH, Buffer.from(await response.arrayBuffer()));
  }
  if (!existsSync(GPKG_PATH)) {
    log('extracting the GeoPackage');
    const archive = new Uint8Array(await readFile(ZIP_PATH));
    await writeFile(GPKG_PATH, readZipEntry(archive, GPKG_ENTRY));
  }
}

/** Groups every feature by scenario, so each raster is filled in one pass. */
function readFeatures() {
  const db = new DatabaseSync(GPKG_PATH, { readOnly: true });
  try {
    const rows = db
      .prepare('SELECT geom, threshold, rainfall, duration FROM flood_extents')
      .all();
    log(`read ${rows.length} polygons`);

    const byScenario = new Map();
    for (const { geom, threshold, rainfall, duration } of rows) {
      const key = `${rainfall}-${duration}`;
      if (!byScenario.has(key)) {
        byScenario.set(key, { rainfall, duration, thresholds: [[], [], []] });
      }
      const index = FLOOD_THRESHOLDS.indexOf(threshold);
      if (index === -1) {
        throw new Error(
          `Unexpected threshold ${threshold} — the catalogue lists 0.1/0.2/0.3.`,
        );
      }
      byScenario
        .get(key)
        .thresholds[index].push(readGeoPackagePolygon(new Uint8Array(geom)));
    }
    return [...byScenario.values()];
  } finally {
    db.close();
  }
}

const FLOOD_THRESHOLDS = [0.1, 0.2, 0.3];

async function main() {
  const grid = await readDemGrid();
  await ensurePackage();
  const scenarios = readFeatures();

  const expected = FLOOD_RAINFALL_MM.length * FLOOD_DURATION_SECONDS.length;
  if (scenarios.length !== expected) {
    throw new Error(`Expected ${expected} scenarios, found ${scenarios.length}.`);
  }

  const extent = {
    west: KAMPALA_BOUNDS.west,
    south: KAMPALA_BOUNDS.south,
    east: KAMPALA_BOUNDS.east,
    north: KAMPALA_BOUNDS.north,
  };

  let total = 0;
  for (const scenario of scenarios) {
    const flags = new Uint8Array(grid.cols * grid.rows);
    for (let i = 0; i < scenario.thresholds.length; i += 1) {
      const layer = rasterizeFlood({
        cols: grid.cols,
        rows: grid.rows,
        extent,
        polygons: scenario.thresholds[i],
        bit: BITS[i],
      });
      for (let c = 0; c < flags.length; c += 1) flags[c] |= layer[c];
    }

    const bytes = encodeFloodBinary(
      {
        cols: grid.cols,
        rows: grid.rows,
        ...extent,
        rainfallMm: scenario.rainfall,
        durationSeconds: scenario.duration,
      },
      flags,
    );

    // `floodBinaryUrl` is the runtime path (`/data/…`); the file name is all
    // the script needs, and prefixing it with DATA_DIR again would nest a
    // second `data/`.
    const name = floodBinaryUrl(scenario.rainfall, scenario.duration).split('/').pop();
    const path = resolve(DATA_DIR, name);
    await writeFile(path, bytes);
    total += bytes.length;
    log(`wrote ${path} (${(bytes.length / 1024).toFixed(0)} KB)`);
  }

  log(
    `done — ${(total / 1024 / 1024).toFixed(2)} MB across ${scenarios.length} scenarios`,
  );
  log(`source: ${PACKAGE_DOI}`);
  await unlink(GPKG_PATH).catch(() => {});
}

main().catch((error) => {
  console.error('[flood]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
