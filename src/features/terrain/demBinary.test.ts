import { describe, expect, it } from 'vitest';
import {
  DEM_BINARY_VERSION,
  MAX_DEM_QUANTISATION_STEP_METERS,
  readDemBinary,
  type DemBinaryGrid,
} from '@/features/terrain/demBinary';

const HEADER_BYTES = 48;

/**
 * Mirrors the writer so reader and writer are pinned to the same contract.
 * Kept here rather than imported from the writer module so the test states the
 * format independently — if both sides shared a codec bug, this would not
 * catch it.
 */
const encodeDemBinary = (
  grid: Omit<DemBinaryGrid, 'widthMeters' | 'depthMeters'> & {
    widthMeters?: number;
    depthMeters?: number;
  },
): ArrayBuffer => {
  const cols = grid.cols;
  const rows = grid.rows;
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

  const quantised = new Uint16Array(count);
  const range = grid.maxElevationMeters - grid.minElevationMeters;
  for (let i = 0; i < count; i += 1) {
    const t = range === 0 ? 0 : (grid.samples[i] - grid.minElevationMeters) / range;
    quantised[i] = Math.round(Math.min(Math.max(t, 0), 1) * 65_535);
  }
  new Uint16Array(buffer, HEADER_BYTES).set(quantised);
  return buffer;
};

const uniformGrid = (
  rows: number,
  cols: number,
  elevation = 1100,
): { samples: Float32Array; rows: number; cols: number } => ({
  rows,
  cols,
  samples: new Float32Array(rows * cols).fill(elevation),
});

describe('readDemBinary', () => {
  describe('round trip', () => {
    it('recovers grid dimensions from the header', () => {
      const grid = uniformGrid(5, 7, 1150);
      const result = readDemBinary(
        encodeDemBinary({ ...grid, minElevationMeters: 1150, maxElevationMeters: 1150 }),
      );
      expect(result.rows).toBe(5);
      expect(result.cols).toBe(7);
    });

    it('recovers the extent in metres', () => {
      const result = readDemBinary(
        encodeDemBinary({
          ...uniformGrid(4, 4),
          minElevationMeters: 1100,
          maxElevationMeters: 1150,
          widthMeters: 19_258.0011,
          depthMeters: 22_336.0089,
        }),
      );
      expect(result.widthMeters).toBeCloseTo(19_258.0011, 6);
      expect(result.depthMeters).toBeCloseTo(22_336.0089, 6);
    });

    it('recovers a flat grid exactly', () => {
      const result = readDemBinary(
        encodeDemBinary({
          ...uniformGrid(6, 8, 1150),
          minElevationMeters: 1150,
          maxElevationMeters: 1150,
        }),
      );
      for (const value of result.samples) {
        expect(value).toBeCloseTo(1150, 3);
      }
    });

    it('recovers elevations in row-major order', () => {
      const rows = 3;
      const cols = 4;
      const samples = new Float32Array(rows * cols);
      for (let i = 0; i < samples.length; i += 1) samples[i] = 1000 + i;
      const result = readDemBinary(
        encodeDemBinary({
          rows,
          cols,
          samples,
          minElevationMeters: 1000,
          maxElevationMeters: 1012,
        }),
      );
      expect(result.samples[0]).toBeCloseTo(1000, 2);
      expect(result.samples[11]).toBeCloseTo(1011, 2);
    });

    it('recovers the band endpoints', () => {
      const result = readDemBinary(
        encodeDemBinary({
          ...uniformGrid(4, 4, 1150),
          minElevationMeters: 1120.5,
          maxElevationMeters: 1180.25,
        }),
      );
      expect(result.minElevationMeters).toBeCloseTo(1120.5, 6);
      expect(result.maxElevationMeters).toBeCloseTo(1180.25, 6);
    });
  });

  describe('quantisation accuracy', () => {
    it('keeps worst-case error within half a quantisation step', () => {
      // Worst case is exactly half a step, since encoding rounds to nearest.
      const rows = 40;
      const cols = 40;
      const min = 1050;
      const max = 1300;
      const samples = new Float32Array(rows * cols);
      for (let i = 0; i < samples.length; i += 1) {
        samples[i] = min + ((i * 37) % 1000) * ((max - min) / 1000);
      }
      const result = readDemBinary(
        encodeDemBinary({
          rows,
          cols,
          samples,
          minElevationMeters: min,
          maxElevationMeters: max,
        }),
      );
      const halfStep = (max - min) / 2 / 65_535;
      for (let i = 0; i < samples.length; i += 1) {
        expect(Math.abs(result.samples[i] - samples[i])).toBeLessThanOrEqual(
          halfStep + 1e-4,
        );
      }
    });

    it('resolves elevations far below the 30m source resolution', () => {
      // The whole point of a uint16 payload: on a realistic Kampala band the
      // step is millimetres, so quantisation cannot be blamed for a visual
      // artefact. This is what lets the file be half the size of float32
      // without weakening any claim we make (RISK-007).
      const min = 1000;
      const max = 1200;
      const step = (max - min) / 65_535;
      expect(step).toBeLessThan(MAX_DEM_QUANTISATION_STEP_METERS);
      expect(step).toBeLessThan(0.01);
    });

    it('decodes a zero-width band as flat, without NaN', () => {
      // min === max means `range` is 0, so the scale term vanishes and every
      // sample is `min`. Pinned so a future refactor to `(v - min) / range`
      // cannot introduce a 0/0 here unnoticed.
      const result = readDemBinary(
        encodeDemBinary({
          ...uniformGrid(4, 4, 1100),
          minElevationMeters: 1100,
          maxElevationMeters: 1100,
        }),
      );
      expect(result.samples[0]).toBeCloseTo(1100, 6);
      expect(Number.isNaN(result.samples[0])).toBe(false);
    });
  });

  describe('format validation', () => {
    const validBuffer = () =>
      encodeDemBinary({
        ...uniformGrid(4, 4, 1150),
        minElevationMeters: 1150,
        maxElevationMeters: 1150,
      });

    it('rejects a file that is not an Ombros DEM', () => {
      const buffer = validBuffer();
      new Uint8Array(buffer)[0] = 0x00;
      expect(() => readDemBinary(buffer)).toThrow(/magic/i);
    });

    it('rejects an unknown format version', () => {
      const buffer = validBuffer();
      new DataView(buffer).setUint32(4, 99, true);
      expect(() => readDemBinary(buffer)).toThrow(/version/i);
    });

    it('rejects a buffer shorter than the header', () => {
      expect(() => readDemBinary(new ArrayBuffer(12))).toThrow(/truncated|short/i);
    });

    it('rejects a buffer truncated mid-payload', () => {
      // The corruption mode that matters: without this check the parser would
      // happily read a partial grid and the terrain would be silently short.
      const full = validBuffer();
      const truncated = full.slice(0, HEADER_BYTES + 4);
      expect(() => readDemBinary(truncated)).toThrow(/truncated|short|length/i);
    });

    it('rejects a header claiming more samples than the payload holds', () => {
      const buffer = validBuffer();
      // Claim 10x10 grid inside a 4x4-sized buffer.
      new DataView(buffer).setUint32(8, 10, true);
      new DataView(buffer).setUint32(12, 10, true);
      expect(() => readDemBinary(buffer)).toThrow(/length|mismatch|sample/i);
    });

    it('rejects a zero or negative grid dimension', () => {
      const zeroCols = validBuffer();
      new DataView(zeroCols).setUint32(8, 0, true);
      expect(() => readDemBinary(zeroCols)).toThrow(/rows|cols|dimension/i);

      const hugeRows = validBuffer();
      new DataView(hugeRows).setUint32(12, 0xffff_ffff, true);
      expect(() => readDemBinary(hugeRows)).toThrow();
    });

    it('rejects a non-finite extent', () => {
      const buffer = validBuffer();
      new DataView(buffer).setFloat64(16, Number.NaN, true);
      expect(() => readDemBinary(buffer)).toThrow(/extent|finite/i);
    });

    it('rejects an inverted elevation band', () => {
      const buffer = validBuffer();
      new DataView(buffer).setFloat32(32, 1200, true);
      new DataView(buffer).setFloat32(36, 1100, true);
      expect(() => readDemBinary(buffer)).toThrow(/elevation|band|min|max/i);
    });
  });

  describe('contract boundary', () => {
    it('returns a grid that satisfies the heightfield grid shape', () => {
      // readDemBinary validates structure; uniform cell size is
      // buildHeightfieldGeometry's invariant (ADR-006). This asserts the two
      // line up rather than duplicating the check.
      const result = readDemBinary(
        encodeDemBinary({
          ...uniformGrid(4, 4, 1150),
          minElevationMeters: 1150,
          maxElevationMeters: 1150,
          widthMeters: 300,
          depthMeters: 300,
        }),
      );
      expect(result.samples).toBeInstanceOf(Float32Array);
      expect(result.samples.length).toBe(result.rows * result.cols);
      expect(Number.isFinite(result.widthMeters)).toBe(true);
      expect(Number.isFinite(result.depthMeters)).toBe(true);
    });

    it('feeds the heightfield builder without modification', async () => {
      // Integration: the two units must compose. A drift between the writer's
      // output shape and the builder's input type would otherwise only show up
      // once a real DEM file existed.
      const { buildHeightfieldGeometry } = await import('@/features/terrain/heightfield');
      const grid = uniformGrid(6, 6, 1150);
      const result = readDemBinary(
        encodeDemBinary({
          ...grid,
          minElevationMeters: 1150,
          maxElevationMeters: 1150,
          widthMeters: 500,
          depthMeters: 500,
        }),
      );
      const geometry = buildHeightfieldGeometry({
        samples: result.samples,
        rows: result.rows,
        cols: result.cols,
        extent: { widthMeters: result.widthMeters, depthMeters: result.depthMeters },
      });
      expect(geometry.getAttribute('position').count).toBe(36);
    });
  });
});
