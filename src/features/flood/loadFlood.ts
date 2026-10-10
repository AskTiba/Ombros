/**
 * Fetching one scenario's raster from `/data/`.
 *
 * Same shape as `loadDem`: a value, not an exception, so the map can say what
 * went wrong instead of rendering an empty overlay.
 *
 * The extra failure this layer has that the DEM does not is `grid-mismatch`.
 * The flood raster has to land on exactly the same cells as the terrain or the
 * overlay is offset by whole cells and nothing on screen looks wrong — the
 * flooding simply appears in the wrong suburb. The file states its own grid;
 * this is where that claim is checked.
 */

import {
  decodeFloodBinary,
  floodBinaryUrl,
  type DecodedFloodBinary,
} from './floodBinary.ts';

export type FloodLoadFailure = 'not-found' | 'corrupt' | 'network' | 'grid-mismatch';

export type FloodLoadResult =
  { ok: true; flood: DecodedFloodBinary } | { ok: false; reason: FloodLoadFailure };

/** The terrain grid a flood raster is required to line up with. */
export interface ExpectedFloodGrid {
  cols: number;
  rows: number;
}

export async function loadFloodScenario(
  rainfallMm: number,
  durationSeconds: number,
  expected?: ExpectedFloodGrid,
): Promise<FloodLoadResult> {
  let response: Response;
  try {
    response = await fetch(floodBinaryUrl(rainfallMm, durationSeconds));
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (!response.ok) {
    return { ok: false, reason: response.status === 404 ? 'not-found' : 'network' };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    return { ok: false, reason: 'network' };
  }

  let flood: DecodedFloodBinary;
  try {
    flood = decodeFloodBinary(bytes);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }

  if (expected && (flood.cols !== expected.cols || flood.rows !== expected.rows)) {
    return { ok: false, reason: 'grid-mismatch' };
  }

  return { ok: true, flood };
}

/**
 * Loads a scenario at most once per session.
 *
 * Scrubbing between rainfall depths re-requests nothing: the UI moves through
 * a handful of scenarios and each is ~176 kB, so the cache is what keeps a
 * curious planner from re-downloading the dataset.
 */
const once = new Map<string, Promise<FloodLoadResult>>();

export function loadFloodScenarioOnce(
  rainfallMm: number,
  durationSeconds: number,
  expected?: ExpectedFloodGrid,
): Promise<FloodLoadResult> {
  const key = `${rainfallMm}-${durationSeconds}`;
  let pending = once.get(key);
  if (!pending) {
    pending = loadFloodScenario(rainfallMm, durationSeconds, expected);
    once.set(key, pending);
  }
  return pending;
}

/** Drops the cache. Test-only; production never resets it. */
export function resetFloodCache(): void {
  once.clear();
}
