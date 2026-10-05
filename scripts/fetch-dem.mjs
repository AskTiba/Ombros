#!/usr/bin/env node
/**
 * Fetches the Copernicus GLO-30 DEM tile and writes the cached Kampala terrain.
 *
 * Output: `public/data/kampala-dem.bin`, in the format `readDemBinary`
 * decodes (48-byte header + uint16 payload). That file is gitignored — it is
 * 0.92 MB of derived data, and the source of record is the COG below.
 *
 * ## Run it with Node 22.18+ or 24
 *
 * This script imports `src/lib/geo.ts` directly and relies on native type
 * stripping, so it cannot run on the project's declared Node floor of 20.19.
 * That is deliberate: duplicating `KAMPALA_BOUNDS` here would be a second
 * source of truth for the study extent, and a boundary that disagrees by even
 * 0.0001° places the terrain visibly off the flood polygons it has to line up
 * with. A separate copy of a constant that everything else depends on is worse
 * than a documented runtime requirement.
 *
 * ## Why the geometry lives elsewhere
 *
 * All the resampling maths is in `src/features/terrain/demResample.ts` and is
 * unit tested. This file does the three things that cannot be tested offline:
 * talk to S3 over HTTP range requests, decode Deflate, and write bytes.
 *
 * ## Verified properties of this tile
 *
 * Read from the live header rather than assumed:
 *
 * - `N00_00_E032_00` covers 32–33°E, 0–1°N, which contains the study extent.
 * - float32 samples, EGM2008 geoid heights, no `GDAL_NODATA` tag.
 * - Deflate + floating-point predictor 3, tiled 1024×1024.
 * - 1 arcsecond grid: ~30.71m N-S, ~30.92m E-W at this latitude. **Not 30m.**
 *
 * The last point matters for honesty rather than mechanics. The published "30m"
 * is a nominal round number, so any claim about vertical precision has to be
 * stated against a ~30.7m horizontal resolution (RISK-007).
 *
 * Usage:
 *   node scripts/fetch-dem.mjs               # fetch, convert, write, verify
 *   node scripts/fetch-dem.mjs --dry-run     # report the plan, fetch nothing
 *   node scripts/fetch-dem.mjs --verify-only # re-check the existing file
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromUrl } from 'geotiff';

import {
  DEM_BINARY_HEADER_BYTES,
  DEM_BINARY_MAGIC,
  DEM_BINARY_VERSION,
  MAX_DEM_QUANTISATION_STEP_METERS,
  readDemBinary,
} from '../src/features/terrain/demBinary.ts';
import {
  computeDemGrid,
  computeSourceWindow,
  resampleWindowToGrid,
} from '../src/features/terrain/demResample.ts';
import { KAMPALA_BOUNDS, boundsHeightMeters, boundsWidthMeters } from '../src/lib/geo.ts';

/**
 * The composition root for this script: the published bounds come from `geo.ts`
 * and the metre spans from its own helpers, so there is exactly one place in the
 * codebase that states the study extent.
 */
const EXTENT = {
  ...KAMPALA_BOUNDS,
  widthMeters: boundsWidthMeters(),
  depthMeters: boundsHeightMeters(),
};

const KAMPALA_DEM_GRID = computeDemGrid(EXTENT.widthMeters, EXTENT.depthMeters);

const SOURCE_TIF =
  'https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/' +
  'Copernicus_DSM_COG_10_N00_00_E032_00_DEM/' +
  'Copernicus_DSM_COG_10_N00_00_E032_00_DEM.tif';

const MAX_QUANTISED_VALUE = 65_535;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = resolve(REPO_ROOT, 'public/data/kampala-dem.bin');

const log = (message) => console.log(`[fetch-dem] ${message}`);

const formatMeters = (value) => `${value.toFixed(2)}m`;

/**
 * Quantises elevations to uint16 across the observed band.
 *
 * The band is measured from the data rather than assumed, because the step is
 * `range / 65535` — fixing a band wider than reality would throw away
 * precision for nothing. If the band turns out so wide that the step reaches
 * 1cm, the format's own threshold says uint16 is no longer a transparent
 * compression and this throws rather than silently shipping a lossy terrain.
 */
const quantise = (samples) => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i];
    if (!Number.isFinite(v)) {
      throw new Error(
        `DEM contains a non-finite elevation at index ${i}. The tile declares no ` +
          `GDAL_NODATA, so this is corruption rather than a legitimate void, and ` +
          `writing it would produce a terrain mesh with holes and no error.`,
      );
    }
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const step = (max - min) / MAX_QUANTISED_VALUE;
  if (step > MAX_DEM_QUANTISATION_STEP_METERS) {
    throw new Error(
      `DEM band ${formatMeters(max - min)} would quantise at ` +
        `${(step * 1000).toFixed(3)}mm per step, past the ` +
        `${MAX_DEM_QUANTISATION_STEP_METERS * 1000}mm limit where uint16 stops ` +
        `being transparent. Use a uint32 payload.`,
    );
  }

  const payload = new Uint16Array(samples.length);
  const range = max - min;
  for (let i = 0; i < samples.length; i += 1) {
    payload[i] = Math.round(((samples[i] - min) / range) * MAX_QUANTISED_VALUE);
  }

  return { payload, min, max, step };
};

/**
 * Writes the 48-byte header + uint16 payload.
 *
 * Little-endian throughout, matching the reader. The reserved fields are zeroed
 * rather than left uninitialised so two runs over the same data produce
 * byte-identical files.
 */
const encodeDemBinary = ({ payload, min, max }, cols, rows, widthMeters, depthMeters) => {
  const buffer = new ArrayBuffer(DEM_BINARY_HEADER_BYTES + payload.byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < DEM_BINARY_MAGIC.length; i += 1) {
    bytes[i] = DEM_BINARY_MAGIC.charCodeAt(i);
  }
  view.setUint32(4, DEM_BINARY_VERSION, true);
  view.setUint32(8, cols, true);
  view.setUint32(12, rows, true);
  view.setFloat64(16, widthMeters, true);
  view.setFloat64(24, depthMeters, true);
  view.setFloat32(32, min, true);
  view.setFloat32(36, max, true);
  view.setUint32(40, 0, true);
  view.setUint32(44, 0, true);

  new Uint16Array(buffer, DEM_BINARY_HEADER_BYTES).set(payload);
  return buffer;
};

/** Reads only the byte ranges covering the study extent, via the COG's own tiles. */
const fetchWindow = async () => {
  log(`opening ${SOURCE_TIF}`);
  const tiff = await fromUrl(SOURCE_TIF);
  const image = await tiff.getImage();

  const imageWidth = image.getWidth();
  const imageHeight = image.getHeight();
  const [originLon, originLat] = image.getOrigin();
  const [pixelSizeDegrees] = image.getResolution();

  log(`raster ${imageWidth} x ${imageHeight} px, origin ${originLon},${originLat}`);

  const win = computeSourceWindow(
    KAMPALA_DEM_GRID,
    EXTENT,
    { originLon, originLat, pixelSizeDegrees },
    imageWidth,
    imageHeight,
  );
  log(
    `study extent maps to a ${win.width} x ${win.height} px window at ` +
      `(${win.left}, ${win.top}) — reading only those tiles`,
  );

  // `nearest` here, not `bilinear`: the resample to the uniform grid is done in
  // demResample.ts where it can be unit tested. Asking geotiff to resample as
  // well would mean two independent resamples of the same data, and a bug in
  // either would be very hard to see in the output.
  // geotiff's `window` is [left, top, right, bottom] in absolute pixel
  // coordinates — not [left, top, width, height]. It validates by comparing
  // window[0] > window[2], so passing a width in slot 2 reads as "left edge is
  // beyond the right edge" and throws "Invalid subsets". The pure module keeps
  // width/height because that is the clearer shape to compute; the conversion
  // happens here, where geotiff's convention is known.
  const [window] = await image.readRasters({
    window: [win.left, win.top, win.left + win.width, win.top + win.height],
    samples: [0],
    interleave: false,
  });

  // Shift the origin to the window's own top-left. demResample works in window
  // pixel space, so failing to do this displaces the terrain by up to 15km.
  const shifted = {
    originLon: originLon + win.left * pixelSizeDegrees,
    originLat: originLat - win.top * pixelSizeDegrees,
    pixelSizeDegrees,
    cols: win.width,
    rows: win.height,
  };

  return { window: Float32Array.from(window), geo: shifted };
};

const reportPlan = () => {
  log(
    `target grid ${KAMPALA_DEM_GRID.cols} x ${KAMPALA_DEM_GRID.rows} = ` +
      `${KAMPALA_DEM_GRID.cols * KAMPALA_DEM_GRID.rows} vertices`,
  );
  log(
    `extent ${formatMeters(KAMPALA_DEM_GRID.widthMeters)} E-W x ` +
      `${formatMeters(KAMPALA_DEM_GRID.depthMeters)} N-S`,
  );
  const cellX = KAMPALA_DEM_GRID.widthMeters / (KAMPALA_DEM_GRID.cols - 1);
  const cellZ = KAMPALA_DEM_GRID.depthMeters / (KAMPALA_DEM_GRID.rows - 1);
  log(`cell ${cellX.toFixed(3)}m x ${cellZ.toFixed(3)}m`);
};

/** Reads the written file back through the real decoder. A file that cannot be
 * decoded is not a cache, it is a future incident. */
const verify = async () => {
  const buffer = await readFile(OUTPUT_PATH);
  const grid = readDemBinary(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );

  if (grid.cols !== KAMPALA_DEM_GRID.cols || grid.rows !== KAMPALA_DEM_GRID.rows) {
    throw new Error(
      `round-trip mismatch: wrote ${KAMPALA_DEM_GRID.cols} x ${KAMPALA_DEM_GRID.rows} ` +
        `but decoded ${grid.cols} x ${grid.rows}`,
    );
  }

  let decodedMin = Infinity;
  let decodedMax = -Infinity;
  for (const v of grid.samples) {
    if (v < decodedMin) decodedMin = v;
    if (v > decodedMax) decodedMax = v;
  }

  log(`verified ${grid.cols} x ${grid.rows} samples decoded cleanly`);
  log(`elevation band ${decodedMin.toFixed(2)}m .. ${decodedMax.toFixed(2)}m`);
  log(
    `quantisation step ${(((decodedMax - decodedMin) / MAX_QUANTISED_VALUE) * 1000).toFixed(4)}mm`,
  );
  log(
    `payload ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB total, grid is ` +
      `${((buffer.byteLength - DEM_BINARY_HEADER_BYTES) / 1024 / 1024).toFixed(2)} MB`,
  );
  return grid;
};

const main = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verifyOnly = args.includes('--verify-only');

  reportPlan();

  if (verifyOnly) {
    if (!existsSync(OUTPUT_PATH)) {
      throw new Error(`${OUTPUT_PATH} does not exist — run without --verify-only first`);
    }
    await verify();
    return;
  }

  if (dryRun) {
    log('--dry-run: stopping before any network access');
    return;
  }

  const { window, geo } = await fetchWindow();
  log(`decoded ${window.length} source samples`);

  const samples = resampleWindowToGrid(window, geo, KAMPALA_DEM_GRID, EXTENT);
  log(`resampled to ${samples.length} grid vertices`);

  const quantised = quantise(samples);
  log(
    `band ${formatMeters(quantised.min)} .. ${formatMeters(quantised.max)}, ` +
      `step ${(quantised.step * 1000).toFixed(4)}mm`,
  );

  const buffer = encodeDemBinary(
    quantised,
    KAMPALA_DEM_GRID.cols,
    KAMPALA_DEM_GRID.rows,
    KAMPALA_DEM_GRID.widthMeters,
    KAMPALA_DEM_GRID.depthMeters,
  );

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, Buffer.from(buffer));
  log(`wrote ${OUTPUT_PATH}`);

  await verify();
};

main().catch((error) => {
  console.error(`[fetch-dem] failed: ${error.message}`);
  process.exitCode = 1;
});
