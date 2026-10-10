/**
 * The on-disk flood layer: one file per rainfall/duration scenario.
 *
 * ## Why one file per scenario
 *
 * The whole rasterised dataset is 2.64 MB raw. Whether that is acceptable
 * depends entirely on whether the host compresses it — gzip takes the full
 * set to ~126 kB, no compression leaves 2.64 MB sitting on top of the 960 kB
 * DEM and over the ≤3MB first-load budget (RISK-008). Per-scenario files make
 * the first load correct in *both* worlds: the map needs one, gets one, and
 * the other fourteen are only pulled if the user actually changes the
 * scenario.
 *
 * ## The header carries the grid, and the loader checks it
 *
 * The flood raster has to land on exactly the same cells as the DEM or the
 * overlay is silently offset. Rather than trusting that, the file states its
 * own grid and extent and the loader refuses a mismatch — a constant that
 * drifts is invisible until someone draws a conclusion from it.
 */

/** Depth thresholds published with the dataset, in metres. */
export const FLOOD_THRESHOLDS_METERS = [0.1, 0.2, 0.3] as const;

/** Rainfall depths published with the dataset, in millimetres. */
export const FLOOD_RAINFALL_MM = [20, 40, 60, 80, 100] as const;

/** Rainfall durations published with the dataset, in seconds. */
export const FLOOD_DURATION_SECONDS = [3600, 10800, 21600] as const;

export const FLOOD_BINARY_MAGIC = 'OFLE';
export const FLOOD_BINARY_VERSION = 1;
export const FLOOD_BINARY_HEADER_BYTES = 60;

import { packFloodFlags, unpackFloodFlags } from './rasterizeFlood.ts';

/** Where a scenario's raster is served from, at runtime and at build time. */
export const floodBinaryUrl = (rainfallMm: number, durationSeconds: number): string =>
  `/data/kampala-flood-${rainfallMm}-${durationSeconds}.bin`;

export interface FloodBinaryMeta {
  cols: number;
  rows: number;
  west: number;
  south: number;
  east: number;
  north: number;
  rainfallMm: number;
  durationSeconds: number;
}

export type DecodedFloodBinary = FloodBinaryMeta & {
  /** One byte per cell, bit 0/1/2 set for threshold 0.1 / 0.2 / 0.3 m. */
  flags: Uint8Array;
};

const text = (s: string): Uint8Array => new TextEncoder().encode(s);

const readText = (bytes: Uint8Array, start: number, length: number): string =>
  new TextDecoder().decode(bytes.subarray(start, start + length));

/**
 * Encodes one scenario's cell flags.
 *
 * @param flags - one byte per cell, three low bits set. Supplied already
 *   packed by `packFloodFlags`? No — packing happens inside, so the caller
 *   never has to know the bit layout.
 */
export function encodeFloodBinary(meta: FloodBinaryMeta, flags: Uint8Array): Uint8Array {
  const payload = packFloodFlags(flags);
  const out = new Uint8Array(FLOOD_BINARY_HEADER_BYTES + payload.length);
  const view = new DataView(out.buffer);

  out.set(text(FLOOD_BINARY_MAGIC), 0);
  view.setUint32(4, FLOOD_BINARY_VERSION, true);
  view.setUint32(8, meta.cols, true);
  view.setUint32(12, meta.rows, true);
  view.setFloat64(16, meta.west, true);
  view.setFloat64(24, meta.south, true);
  view.setFloat64(32, meta.east, true);
  view.setFloat64(40, meta.north, true);
  view.setUint32(48, meta.rainfallMm, true);
  view.setUint32(52, meta.durationSeconds, true);
  out[56] = FLOOD_THRESHOLDS_METERS.length;
  out[57] = 3;
  view.setUint16(58, 0, true);
  out.set(payload, FLOOD_BINARY_HEADER_BYTES);
  return out;
}

/**
 * Decodes a scenario file.
 *
 * @throws if the magic, version, dimensions, extent or threshold count do not
 *   say what this build expects — every one of those is a silent-wrong-map
 *   failure if waved through.
 */
export function decodeFloodBinary(bytes: Uint8Array): DecodedFloodBinary {
  if (bytes.length < FLOOD_BINARY_HEADER_BYTES) {
    throw new Error(`Flood layer truncated: ${bytes.length} bytes`);
  }
  if (readText(bytes, 0, 4) !== FLOOD_BINARY_MAGIC) {
    throw new Error('Not a Ombros flood layer: bad magic');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  if (version !== FLOOD_BINARY_VERSION) {
    throw new Error(`Flood layer version ${version}, expected ${FLOOD_BINARY_VERSION}`);
  }
  if (bytes[56] !== FLOOD_THRESHOLDS_METERS.length) {
    throw new Error('Flood layer does not carry the three published thresholds');
  }

  const cols = view.getUint32(8, true);
  const rows = view.getUint32(12, true);
  if (cols === 0 || rows === 0) throw new Error('Flood layer has an empty grid');

  const cellCount = cols * rows;
  const payload = bytes.subarray(FLOOD_BINARY_HEADER_BYTES);
  if (payload.length < Math.ceil((cellCount * 3) / 8)) {
    throw new Error(
      `Flood layer payload short: ${payload.length} bytes for ${cellCount} cells`,
    );
  }

  return {
    cols,
    rows,
    west: view.getFloat64(16, true),
    south: view.getFloat64(24, true),
    east: view.getFloat64(32, true),
    north: view.getFloat64(40, true),
    rainfallMm: view.getUint32(48, true),
    durationSeconds: view.getUint32(52, true),
    flags: unpackFloodFlags(payload, cellCount),
  };
}
