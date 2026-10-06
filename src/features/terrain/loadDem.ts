import { readDemBinary, type DemBinaryGrid } from './demBinary';

/** Where the quantised study-extent DEM is served from at runtime. */
export const DEM_DATA_URL = '/data/kampala-dem.bin';

/**
 * Why a DEM load failed, as a value rather than an exception.
 *
 * - `not-found` — the asset is absent. Expected on a fresh clone: the binary
 *   is gitignored and must be regenerated with `node scripts/fetch-dem.mjs`.
 * - `corrupt` — bytes arrived but are not a readable DEM (truncated, bad
 *   magic, or a length that disagrees with its own header).
 * - `network` — the request itself failed: offline, DNS, timeout, or a
 *   non-404 HTTP error. Distinguished from `not-found` because retrying is
 *   pointless for one and plausible for the other.
 */
export type DemLoadFailure = 'not-found' | 'corrupt' | 'network';

/**
 * Result of a DEM load: a decoded grid, or the reason it is unavailable.
 *
 * Returned rather than thrown so every caller renders an honest fallback for
 * each failure instead of an unhandled rejection. A missing terrain asset is a
 * normal state of this app (gitignored data), not an exceptional one.
 */
export type DemLoadResult =
  { ok: true; grid: DemBinaryGrid } | { ok: false; reason: DemLoadFailure };

/**
 * Fetches and decodes the cached Kampala DEM.
 *
 * Transport layer only — the byte format is `readDemBinary`'s contract and the
 * grid it returns is `buildHeightfieldGeometry`'s input. Covered through MSW
 * so status handling and body reading are exercised for real.
 */
export async function loadDemGrid(url: string = DEM_DATA_URL): Promise<DemLoadResult> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (!response.ok) {
    return { ok: false, reason: response.status === 404 ? 'not-found' : 'network' };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await response.arrayBuffer();
  } catch {
    return { ok: false, reason: 'network' };
  }

  try {
    return { ok: true, grid: readDemBinary(buffer) };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}
