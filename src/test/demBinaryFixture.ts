import { DEM_BINARY_VERSION, type DemBinaryGrid } from '@/features/terrain/demBinary';

const HEADER_BYTES = 48;

/**
 * Encodes a `DemBinaryGrid` into the on-disk byte format.
 *
 * Mirrors the format documented in `demBinary.ts` so transport-layer tests can
 * serve realistic bytes without depending on `public/data/kampala-dem.bin`
 * (which is gitignored and absent on a fresh clone). `demBinary.test.ts` keeps
 * its own independent copy of this encoder on purpose: reader and writer must
 * be stated separately or a shared codec bug would pass both sides.
 */
export const encodeDemBinary = (
  grid: Omit<DemBinaryGrid, 'widthMeters' | 'depthMeters'> & {
    widthMeters?: number;
    depthMeters?: number;
  },
): ArrayBuffer => {
  const { cols, rows, samples } = grid;
  const count = rows * cols;
  const buffer = new ArrayBuffer(HEADER_BYTES + count * 2);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  bytes.set([0x4f, 0x4d, 0x42, 0x53]); // "OMBS"
  view.setUint32(4, DEM_BINARY_VERSION, true);
  view.setUint32(8, cols, true);
  view.setUint32(12, rows, true);
  view.setFloat64(16, grid.widthMeters ?? 1000, true);
  view.setFloat64(24, grid.depthMeters ?? 1000, true);
  view.setFloat32(32, grid.minElevationMeters, true);
  view.setFloat32(36, grid.maxElevationMeters, true);
  view.setUint32(40, 0, true); // reserved
  view.setUint32(44, 0, true); // reserved

  const range = grid.maxElevationMeters - grid.minElevationMeters;
  const quantised = new Uint16Array(count);
  for (let i = 0; i < count; i += 1) {
    const t = range === 0 ? 0 : (samples[i] - grid.minElevationMeters) / range;
    quantised[i] = Math.round(Math.min(Math.max(t, 0), 1) * 65_535);
  }
  new Uint16Array(buffer, HEADER_BYTES).set(quantised);
  return buffer;
};

/** A small deterministic ramp grid — every value distinct so decode errors show. */
export const rampGrid = (): DemBinaryGrid => {
  const cols = 4;
  const rows = 3;
  const samples = new Float32Array(rows * cols);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = 1100 + i * 10;
  }
  return {
    samples,
    rows,
    cols,
    widthMeters: 90,
    depthMeters: 60,
    // Derived, never restated: the ramp reaches 1100 + (rows*cols - 1) * 10,
    // and a hardcoded band that disagrees with the samples silently clamps
    // everything above it during quantisation.
    minElevationMeters: Math.min(...samples),
    maxElevationMeters: Math.max(...samples),
  };
};
