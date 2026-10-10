import { describe, expect, it } from 'vitest';

import {
  HILLSHADE_ALTITUDE_DEG,
  HILLSHADE_AZIMUTH_DEG,
  buildHillshade,
} from './hillshade';

const CELL = 30;

/** Fills a grid so elevation rises/falls linearly across cols (E) and rows (S). */
const ramp = (rows: number, cols: number, dCol: number, dRow: number): Float32Array => {
  const samples = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      samples[r * cols + c] = 1200 + c * dCol + r * dRow;
    }
  }
  return samples;
};

describe('buildHillshade', () => {
  it('follows the cartographic convention of a north-west light', () => {
    expect(HILLSHADE_AZIMUTH_DEG).toBe(315);
    expect(HILLSHADE_ALTITUDE_DEG).toBe(45);
  });

  it('returns one value per sample, all within 0..1', () => {
    const samples = ramp(9, 9, 1, 1);

    const shade = buildHillshade(samples, 9, 9, CELL, CELL);

    expect(shade).toHaveLength(samples.length);
    for (const value of shade) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('shades flat ground to a single uniform value', () => {
    const samples = new Float32Array(64).fill(1200);

    const shade = buildHillshade(samples, 8, 8, CELL, CELL);

    const first = shade[0];
    expect(shade.every((value) => Math.abs(value - first) < 1e-9)).toBe(true);
    // Flat ground faces straight up, so the lambert term collapses to sin(alt).
    expect(first).toBeCloseTo(Math.sin((HILLSHADE_ALTITUDE_DEG * Math.PI) / 180), 5);
  });

  it('lights the north-west facing slope brighter than the south-east facing one', () => {
    // Elevation rising east and south tilts the surface to face north-west.
    const northWest = buildHillshade(ramp(9, 9, 2, 2), 9, 9, CELL, CELL);
    // The mirror: elevation falling east and south faces south-east.
    const southEast = buildHillshade(ramp(9, 9, -2, -2), 9, 9, CELL, CELL);

    const centre = 4 * 9 + 4;
    expect(northWest[centre]).toBeGreaterThan(southEast[centre]);
  });

  it('puts a north-west facing slope above flat ground and a south-east one below', () => {
    // Not symmetric about flat: tilting the surface shrinks the normal's
    // y-component, so both deviations share that offset. What must hold is the
    // sign relative to flat ground, which is what the eye reads as relief.
    const northWest = buildHillshade(ramp(9, 9, 2, 2), 9, 9, CELL, CELL);
    const southEast = buildHillshade(ramp(9, 9, -2, -2), 9, 9, CELL, CELL);

    const centre = 4 * 9 + 4;
    const flat = Math.sin((HILLSHADE_ALTITUDE_DEG * Math.PI) / 180);
    expect(northWest[centre]).toBeGreaterThan(flat);
    expect(southEast[centre]).toBeLessThan(flat);
  });

  it('handles a grid whose north edge is also its brightest', () => {
    const rows = 5;
    const cols = 5;
    const samples = new Float32Array(rows * cols);
    for (let i = 0; i < samples.length; i += 1) samples[i] = 1200 + (i % cols) * 3;

    const shade = buildHillshade(samples, rows, cols, CELL, CELL);

    expect(shade.every((value) => Number.isFinite(value))).toBe(true);
  });
});
