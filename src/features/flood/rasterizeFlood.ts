/**
 * Polygon flood extents → cell flags → packed bytes.
 *
 * ## Why rasterize at all
 *
 * The published dataset is 12,229 vector polygons across 45 scenario/threshold
 * combinations — 4.64 MB of raw geometry before any encoding (RISK-008).
 * Shipping vectors would blow the ≤3MB first-load budget on its own, and
 * rasterizing in the browser would put a scanline fill on the main thread of
 * a mid-range Android every time the scenario changed.
 *
 * So the conversion happens once, in the fetch script, and the runtime reads
 * bits. The functions here are the part worth testing: the geometry parsing
 * and the fill itself.
 *
 * ## The cell-centre rule
 *
 * A cell is flooded if and only if its **centre** is inside a polygon. The
 * looser "any overlap" rule inflates every extent by up to a cell on each
 * side, which at 30m would put the published numbers and ours out of
 * agreement — the exact kind of quiet drift that makes a decision tool
 * untrustworthy.
 *
 * ## Three bits, not two
 *
 * A tempting encoding stores only the *deepest* threshold a cell reaches,
 * on the assumption that ≥0.3 nests inside ≥0.2 nests inside ≥0.1. Measured
 * against the shipped data: **it does not**. 15 of 15 scenarios have cells
 * flagged at ≥0.2 but not ≥0.1 — up to 15 cells each, 123 in total. Whether
 * that is polygon simplification in the source or cell-edge discretisation
 * here, the honest thing is to store what the polygons actually say rather
 * than force an invariant the data does not honour.
 */

import type { GeoPackagePolygon } from './geoPackageGeometry';

/** How many published depth thresholds the format carries. */
export const FLOOD_THRESHOLD_COUNT = 3;

export interface FloodRasterExtent {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface RasterizeFloodOptions {
  cols: number;
  rows: number;
  extent: FloodRasterExtent;
  polygons: ReadonlyArray<GeoPackagePolygon>;
  /** Which of the three threshold bits to set: 1, 2 or 4. */
  bit: number;
}

/**
 * Fills `polygons` into a one-byte-per-cell mask.
 *
 * Later rings of a polygon are holes and are excluded by even-odd crossing
 * counting — treating them as solid would paint islands inside a flood patch
 * as dry land.
 */
export function rasterizeFlood(options: RasterizeFloodOptions): Uint8Array {
  const { cols, rows, extent, polygons, bit } = options;
  if (bit !== 1 && bit !== 2 && bit !== 4) {
    throw new Error(`Bit ${bit} is not one of the three published thresholds (1, 2, 4)`);
  }
  const flags = new Uint8Array(cols * rows);
  const cellLon = (extent.east - extent.west) / cols;
  const cellLat = (extent.north - extent.south) / rows;

  for (const polygon of polygons) {
    fillPolygon(flags, polygon, {
      cols,
      rows,
      extent,
      cellLon,
      cellLat,
      bit,
    });
  }
  return flags;
}

interface FillContext {
  cols: number;
  rows: number;
  extent: FloodRasterExtent;
  cellLon: number;
  cellLat: number;
  bit: number;
}

function fillPolygon(
  flags: Uint8Array,
  polygon: GeoPackagePolygon,
  ctx: FillContext,
): void {
  const edges: Array<[number, number, number, number]> = [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const ring of polygon.rings) {
    const count = ring.length / 2;
    if (count < 3) continue;
    // Rings are explicitly closed per spec, but close defensively: an open
    // ring would leave the last edge missing and leak fill out of the shape.
    const closed =
      ring[0] === ring[(count - 1) * 2] && ring[1] === ring[(count - 1) * 2 + 1];
    const segments = closed ? count - 1 : count;
    for (let i = 0; i < segments; i += 1) {
      const j = (i + 1) % count;
      const x1 = ring[i * 2];
      const y1 = ring[i * 2 + 1];
      const x2 = ring[j * 2];
      const y2 = ring[j * 2 + 1];
      if (y1 === y2) continue; // horizontal edges cross nothing
      edges.push([x1, y1, x2, y2]);
      minLat = Math.min(minLat, y1, y2);
      maxLat = Math.max(maxLat, y1, y2);
      minLon = Math.min(minLon, x1, x2);
      maxLon = Math.max(maxLon, x1, x2);
    }
  }
  if (edges.length === 0) return;

  // Rows whose cell centre cannot fall inside the polygon's latitude band are
  // skipped outright — most published patches are small relative to the city.
  const firstRow = Math.max(
    0,
    Math.ceil((ctx.extent.north - maxLat) / ctx.cellLat - 0.5),
  );
  const lastRow = Math.min(
    ctx.rows - 1,
    Math.floor((ctx.extent.north - minLat) / ctx.cellLat - 0.5),
  );

  const firstCol = Math.max(0, Math.ceil((minLon - ctx.extent.west) / ctx.cellLon - 0.5));
  const lastCol = Math.min(
    ctx.cols - 1,
    Math.floor((maxLon - ctx.extent.west) / ctx.cellLon - 0.5),
  );
  if (firstCol > lastCol || firstRow > lastRow) return;

  const crossings: number[] = [];

  for (let row = firstRow; row <= lastRow; row += 1) {
    const lat = ctx.extent.north - (row + 0.5) * ctx.cellLat;
    crossings.length = 0;
    for (const [x1, y1, x2, y2] of edges) {
      if (y1 <= lat !== y2 <= lat) {
        crossings.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a - b);

    for (let i = 0; i + 1 < crossings.length; i += 2) {
      // First and last column whose *centre* lies within the span.
      const start = Math.max(
        firstCol,
        Math.min(
          lastCol,
          Math.ceil((crossings[i] - ctx.extent.west) / ctx.cellLon - 0.5),
        ),
      );
      const end = Math.max(
        firstCol,
        Math.min(
          lastCol,
          Math.floor((crossings[i + 1] - ctx.extent.west) / ctx.cellLon - 0.5),
        ),
      );
      if (start > end) continue;
      const base = row * ctx.cols;
      for (let col = start; col <= end; col += 1) flags[base + col] |= ctx.bit;
    }
  }
}

/**
 * Packs one byte per cell down to three bits per cell, little-endian within
 * each byte.
 *
 * @throws if any cell carries bits outside the low three — a mask that leaked
 *   a fourth threshold would silently corrupt every scenario after it.
 */
export function packFloodFlags(flags: Uint8Array): Uint8Array {
  const packed = new Uint8Array(Math.ceil((flags.length * FLOOD_THRESHOLD_COUNT) / 8));
  for (let i = 0; i < flags.length; i += 1) {
    const value = flags[i];
    if ((value & ~0b111) !== 0) {
      throw new Error(
        `Cell ${i} carries ${value.toString(2)}: more than three threshold bits`,
      );
    }
    if (value === 0) continue;
    const bit = i * FLOOD_THRESHOLD_COUNT;
    const byte = bit >> 3;
    const shift = bit & 7;
    packed[byte] |= (value << shift) & 0xff;
    if (shift > 5) packed[byte + 1] |= value >> (8 - shift);
  }
  return packed;
}

/** Inverse of {@link packFloodFlags}. */
export function unpackFloodFlags(packed: Uint8Array, cellCount: number): Uint8Array {
  const flags = new Uint8Array(cellCount);
  for (let i = 0; i < cellCount; i += 1) {
    const bit = i * FLOOD_THRESHOLD_COUNT;
    const byte = bit >> 3;
    const shift = bit & 7;
    if (byte >= packed.length) break;
    let value = packed[byte] >> shift;
    if (shift > 5 && byte + 1 < packed.length) value |= packed[byte + 1] << (8 - shift);
    flags[i] = value & 0b111;
  }
  return flags;
}
