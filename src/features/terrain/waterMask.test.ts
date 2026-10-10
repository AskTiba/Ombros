import { describe, expect, it } from 'vitest';

import {
  WATER_MAX_ELEVATION_METERS,
  WATER_MAX_SLOPE_DEG,
  buildWaterMask,
} from './waterMask';

const CELL = 30;

describe('buildWaterMask', () => {
  it('matches the thresholds measured against the shipped DEM', () => {
    // 98.5% of every sub-0.10° sample sits at or below 1,140m, and the
    // 1140-1150m band is 0.3% flat — so these two together separate the
    // south-east water/wetland block from sloping shore with no overlap.
    expect(WATER_MAX_SLOPE_DEG).toBe(0.1);
    expect(WATER_MAX_ELEVATION_METERS).toBe(1140);
  });

  it('returns one flag per sample', () => {
    const samples = new Float32Array(64).fill(1200);

    const mask = buildWaterMask(samples, 8, 8, CELL, CELL);

    expect(mask).toHaveLength(samples.length);
    expect(mask.every((flag) => flag === 0 || flag === 1)).toBe(true);
  });

  it('marks still low ground as water', () => {
    const rows = 5;
    const cols = 5;
    const samples = new Float32Array(rows * cols).fill(1134);

    const mask = buildWaterMask(samples, rows, cols, CELL, CELL);

    expect(Array.from(mask)).toEqual(new Array(rows * cols).fill(1));
  });

  it('leaves sloping ground as land, whatever its elevation', () => {
    const rows = 9;
    const cols = 9;
    const samples = new Float32Array(rows * cols);
    // The centre sample lands at 1,116m — comfortably under the 1,140m limit —
    // yet climbs 4m per 30m cell, a 7.6° slope against a 0.1° threshold. So a
    // zero here can only have come from the slope term, never from elevation.
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) samples[r * cols + c] = 1100 + c * 4;
    }

    const mask = buildWaterMask(samples, rows, cols, CELL, CELL);

    expect(samples[4 * cols + 4]).toBeLessThan(WATER_MAX_ELEVATION_METERS);
    expect(mask[4 * cols + 4]).toBe(0);
  });

  it('leaves flat ground above the water line as land', () => {
    const rows = 5;
    const cols = 5;
    const samples = new Float32Array(rows * cols).fill(WATER_MAX_ELEVATION_METERS + 1);

    const mask = buildWaterMask(samples, rows, cols, CELL, CELL);

    expect(Array.from(mask)).toEqual(new Array(rows * cols).fill(0));
  });

  it('accepts ground exactly at the elevation limit', () => {
    const rows = 5;
    const cols = 5;
    const samples = new Float32Array(rows * cols).fill(WATER_MAX_ELEVATION_METERS);

    const mask = buildWaterMask(samples, rows, cols, CELL, CELL);

    expect(Array.from(mask)).toEqual(new Array(rows * cols).fill(1));
  });
});
