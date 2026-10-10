/**
 * The 2D map — the accessible equivalent of the 3D scene (ADR-002).
 *
 * ## What it is, and what it is not
 *
 * It is a top-down cartographic rendering of the *terrain we actually hold*:
 * the verified Copernicus DEM, shaded with the same hypsometric tint, the same
 * hillshade and the same wetland mask the 3D mesh is built from. Same inputs,
 * same colour maths, same constants — so the two paths cannot disagree about
 * what Kampala looks like.
 *
 * It is **not** a flood map. No hydrodynamic result is loaded in this product
 * yet (ADR-001: published modelling is consumed, never rebuilt). The previous
 * occupant of this slot drew two hard-coded circles and called them flood
 * extents; that was a placeholder that had outstayed its welcome, and it is
 * why the section used to be unreadable. Flood extent becomes a *layer* on
 * this map once the McClean et al. (2021) GeoPackage is ingested — see the
 * Pre-flight Data Verification Log, which already clears its licence.
 *
 * ## Why a canvas and not SVG
 *
 * The study extent is 746 x 643 samples. As SVG that is ~480k elements, which
 * no mid-range Android will lay out. As an `ImageData` buffer it is one pass
 * over one flat array, and the browser scales it with a single draw.
 */

import type { DemBinaryGrid } from './demBinary';
import { hexToLinearRgb, linearToSrgb } from './hypsometric';
import { FLOOD_BLEND, FLOOD_CLASS_HEX, buildSurfaceColors } from './surfaceColors';
import { buildWaterMask } from './waterMask';

/**
 * Widest map this will render.
 *
 * 480 CSS pixels covers a phone at 2x and a desktop column at 1.5x, and caps
 * the per-pixel work at ~270k conversions regardless of viewport. Beyond this
 * the extra resolution is invisible; below it the hillshade starts to moire.
 */
export const TERRAIN_MAP_MAX_WIDTH = 480;

export interface TerrainMapPixels {
  /**
   * RGBA, row-major, row 0 at the north edge — the shape `putImageData` wants.
   *
   * The buffer type is spelled out because `ImageData` refuses a
   * `SharedArrayBuffer`-backed view, and the default `Uint8ClampedArray` type
   * parameter is `ArrayBufferLike`, which includes one.
   */
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
  /** Share of the study extent flagged as water/wetland, 0..1. */
  waterShare: number;
  minElevationMeters: number;
  maxElevationMeters: number;
  /** Share of cells in each depth class, lightest first. Zero when no flood raster was given. */
  floodClassShares: [number, number, number];
}

/**
 * Renders the DEM to sRGB pixels.
 *
 * @param grid - the decoded study-extent DEM.
 * @param targetWidth - output width in pixels; height follows the extent's
 *   own aspect ratio so the map is never stretched.
 */
/** Linear RGB of each depth class, lightest first. */
const FLOOD_CLASS: ReadonlyArray<readonly [number, number, number]> = FLOOD_CLASS_HEX.map(
  (hex) => hexToLinearRgb(hex),
);

/**
 * @param floodFlags - optional raster from `loadFloodScenario`: one byte per
 *   cell, bit 0/1/2 set for the 0.1 / 0.2 / 0.3 m classes. Must be the same
 *   grid as the DEM — the loader is what enforces that.
 */
export function renderTerrainMap(
  grid: DemBinaryGrid,
  targetWidth: number,
  floodFlags?: Uint8Array,
): TerrainMapPixels {
  const width = Math.max(1, Math.round(targetWidth));
  const height = Math.max(1, Math.round((width * grid.depthMeters) / grid.widthMeters));

  const cellXMeters = grid.widthMeters / (grid.cols - 1);
  const cellZMeters = grid.depthMeters / (grid.rows - 1);

  // The mask is needed twice — once to colour water, once to quote a wet
  // fraction in the text alternative — so it is computed once and shared.
  const waterMask = buildWaterMask(
    grid.samples,
    grid.rows,
    grid.cols,
    cellXMeters,
    cellZMeters,
  );

  // Identical call to the one the 3D mesh makes, so the two views are the
  // same terrain rather than two re-implementations of it.
  const colors = buildSurfaceColors({
    samples: grid.samples,
    rows: grid.rows,
    cols: grid.cols,
    cellXMeters,
    cellZMeters,
    minElevationMeters: grid.minElevationMeters,
    maxElevationMeters: grid.maxElevationMeters,
    waterMask,
  });

  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const row = Math.min(grid.rows - 1, Math.floor((y * grid.rows) / height));
    for (let x = 0; x < width; x += 1) {
      const col = Math.min(grid.cols - 1, Math.floor((x * grid.cols) / width));
      const sampleIndex = row * grid.cols + col;
      const source = sampleIndex * 3;
      const pixel = (y * width + x) * 4;

      let r = colors[source];
      let g = colors[source + 1];
      let b = colors[source + 2];

      if (floodFlags && floodFlags.length === grid.samples.length) {
        // Deepest class wins, so the bands stack rather than overwrite.
        const flags = floodFlags[sampleIndex];
        const band = flags & 4 ? 2 : flags & 2 ? 1 : flags & 1 ? 0 : -1;
        if (band >= 0) {
          const flood = FLOOD_CLASS[band];
          r += (flood[0] - r) * FLOOD_BLEND;
          g += (flood[1] - g) * FLOOD_BLEND;
          b += (flood[2] - b) * FLOOD_BLEND;
        }
      }

      // Linear in, sRGB out: a canvas has no colour pipeline of its own.
      data[pixel] = Math.round(linearToSrgb(r) * 255);
      data[pixel + 1] = Math.round(linearToSrgb(g) * 255);
      data[pixel + 2] = Math.round(linearToSrgb(b) * 255);
      data[pixel + 3] = 255;
    }
  }

  let wet = 0;
  for (let i = 0; i < waterMask.length; i += 1) {
    if (waterMask[i] === 1) wet += 1;
  }

  const floodShares: [number, number, number] = [0, 0, 0];
  if (floodFlags && floodFlags.length === grid.samples.length) {
    for (let i = 0; i < floodFlags.length; i += 1) {
      const flags = floodFlags[i];
      if (flags & 4) floodShares[2] += 1;
      else if (flags & 2) floodShares[1] += 1;
      else if (flags & 1) floodShares[0] += 1;
    }
    for (let c = 0; c < 3; c += 1) floodShares[c] /= floodFlags.length;
  }

  return {
    data,
    width,
    height,
    waterShare: waterMask.length > 0 ? wet / waterMask.length : 0,
    minElevationMeters: grid.minElevationMeters,
    maxElevationMeters: grid.maxElevationMeters,
    floodClassShares: floodShares,
  };
}
