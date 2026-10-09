import { describe, expect, it } from 'vitest';

import type { DemBinaryGrid } from '@/features/terrain/demBinary';
import { buildHeightfieldGeometry } from '@/features/terrain/heightfield';

import { decimateGrid } from './decimateGrid';

const makeGrid = (
  rows: number,
  cols: number,
  valueAt: (row: number, col: number) => number,
): DemBinaryGrid => {
  const samples = new Float32Array(rows * cols);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      samples[row * cols + col] = valueAt(row, col);
    }
  }
  return {
    samples,
    rows,
    cols,
    widthMeters: (cols - 1) * 30,
    depthMeters: (rows - 1) * 30,
    minElevationMeters: Math.min(...samples),
    maxElevationMeters: Math.max(...samples),
  };
};

describe('decimateGrid', () => {
  it('returns an equivalent grid at stride 1', () => {
    const source = makeGrid(5, 7, (row, col) => 1000 + row * 7 + col);

    const result = decimateGrid(source, 1);

    expect(result.rows).toBe(source.rows);
    expect(result.cols).toBe(source.cols);
    expect([...result.samples]).toEqual([...source.samples]);
    expect(result.widthMeters).toBe(source.widthMeters);
    expect(result.depthMeters).toBe(source.depthMeters);
  });

  it('computes per-axis dimensions with floor((n-1)/stride)+1', () => {
    const source = makeGrid(5, 7, (row, col) => row + col);

    const result = decimateGrid(source, 2);

    expect(result.rows).toBe(3);
    expect(result.cols).toBe(4);
    expect(result.widthMeters).toBe(source.widthMeters);
    expect(result.depthMeters).toBe(source.depthMeters);
  });

  it('keeps the extent corners so the terrain footprint does not shrink', () => {
    const source = makeGrid(4, 6, (row, col) => row * 100 + col);

    const result = decimateGrid(source, 2);

    expect(result.rows).toBe(2);
    expect(result.cols).toBe(3);
    expect(result.samples[0]).toBe(source.samples[0]);
    expect(result.samples[result.samples.length - 1]).toBe(
      source.samples[source.samples.length - 1],
    );
    expect(result.samples[result.cols - 1]).toBe(source.samples[source.cols - 1]);
  });

  it('re-derives the elevation band from the kept samples', () => {
    const source = makeGrid(5, 5, (row, col) => 1000 + row + col);
    source.samples[1 * 5 + 1] = 2500;
    source.maxElevationMeters = 2500;

    const result = decimateGrid(source, 2);

    expect(result.maxElevationMeters).toBe(Math.max(...result.samples));
    expect(result.minElevationMeters).toBe(Math.min(...result.samples));
    expect(result.maxElevationMeters).toBeLessThan(2500);
    expect(result.samples).not.toContain(2500);
  });

  it('keeps at least a 2x2 grid when the stride exceeds the dimensions', () => {
    const source = makeGrid(5, 7, (row, col) => row + col);

    const result = decimateGrid(source, 999);

    expect(result.rows).toBe(2);
    expect(result.cols).toBe(2);
    expect(result.samples).toHaveLength(4);
  });

  it('survives a full-resolution grid at stride 1 without blowing the call stack', () => {
    // The high tier keeps every sample: the shipped DEM is 643 × 746 =
    // 479,678 values. Re-deriving the band with Math.min(...samples) spreads
    // that into one function call and throws "Maximum call stack size
    // exceeded" — which surfaced as the terrain mounting, running for a few
    // seconds, then being replaced by the fallback text the moment the frame
    // sampler promoted the tier to high.
    const rows = 746;
    const cols = 643;
    const samples = new Float32Array(rows * cols);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = 1100 + (i % 200);
    }
    const source: DemBinaryGrid = {
      samples,
      rows,
      cols,
      widthMeters: (cols - 1) * 30,
      depthMeters: (rows - 1) * 30,
      minElevationMeters: 1100,
      maxElevationMeters: 1299,
    };

    const result = decimateGrid(source, 1);

    expect(result.rows).toBe(rows);
    expect(result.cols).toBe(cols);
    expect(result.minElevationMeters).toBe(1100);
    expect(result.maxElevationMeters).toBe(1299);
  });

  it('rejects strides below 1 and non-integer strides', () => {
    const source = makeGrid(5, 7, (row, col) => row + col);

    expect(() => decimateGrid(source, 0)).toThrow(RangeError);
    expect(() => decimateGrid(source, 1.5)).toThrow(RangeError);
    expect(() => decimateGrid(source, -2)).toThrow(RangeError);
  });

  it('produces a grid the heightfield builder accepts', () => {
    const source = makeGrid(9, 9, (row, col) => 1100 + row * 9 + col);

    const result = decimateGrid(source, 2);

    const geometry = buildHeightfieldGeometry({
      samples: result.samples,
      rows: result.rows,
      cols: result.cols,
      extent: {
        widthMeters: result.widthMeters,
        depthMeters: result.depthMeters,
      },
      verticalExaggeration: 2,
      baseElevationMeters: result.minElevationMeters,
    });

    const positions = geometry.getAttribute('position');
    expect(positions.count).toBe(result.rows * result.cols);
    geometry.dispose();
  });
});
