import { describe, expect, it } from 'vitest';

import { CONTOUR_INTERVAL_METERS, buildContourGeometry } from './contours';

const EXTENT = { widthMeters: 60, depthMeters: 60 };

/** Rows of `[0, 15, 30]` — a ramp that crosses the 20m level exactly once. */
const RAMP = new Float32Array([0, 15, 30, 0, 15, 30, 0, 15, 30]);

const build = (samples: Float32Array, rows: number, cols: number, overrides = {}) => {
  const geometry = buildContourGeometry({
    samples,
    rows,
    cols,
    extent: EXTENT,
    verticalExaggeration: 1,
    baseElevationMeters: 0,
    ...overrides,
  });
  const attribute = geometry.getAttribute('position');
  return {
    geometry,
    values: Array.from(attribute.array as Float32Array),
    count: attribute.count,
  };
};

/**
 * Elevation of the **rendered** surface at a cell-space point, using the two
 * triangles `buildHeightfieldGeometry` actually indexes: (northWest, southWest,
 * northEast) and (northEast, southWest, southEast), split on the
 * northEast↔southWest diagonal. This is the definition the contours are meant
 * to satisfy — the bilinear patch between corners is a different surface and
 * must not be used here, or the test would assert the bug it exists to catch.
 *
 * Expects a 2×2 grid of `[northWest, northEast, southWest, southEast]`.
 */
const triangulatedHeight = (samples: Float32Array, t: number, s: number): number => {
  const [northWest, northEast, southWest, southEast] = samples;
  if (t + s <= 1) {
    return northWest * (1 - t - s) + northEast * t + southWest * s;
  }
  return northEast * (1 - s) + southWest * (1 - t) + southEast * (t + s - 1);
};

describe('buildContourGeometry', () => {
  it('uses a 20m interval so the 192m of relief reads as ~10 lines, not 190', () => {
    expect(CONTOUR_INTERVAL_METERS).toBe(20);
  });

  it('emits nothing when the terrain never crosses a level', () => {
    const { values } = build(new Float32Array(9).fill(10), 3, 3);

    expect(values).toEqual([]);
  });

  it('cuts a line where a linear ramp crosses a level', () => {
    // Elevation climbs 15m per 30m cell, so 20m sits a third of the way from
    // grid column 1 (x = 0) to column 2 (x = 30): x = 10.
    const { values, count } = build(RAMP, 3, 3);

    // Two rows of cells, each cut by its two triangles — four segments, split
    // where the contour crosses the corner-to-corner diagonal.
    expect(count).toBe(8);
    expect(values).toEqual([
      10,
      20,
      -10,
      10,
      20,
      -30,
      10,
      20,
      -10,
      10,
      20,
      0, //
      10,
      20,
      20,
      10,
      20,
      0,
      10,
      20,
      20,
      10,
      20,
      30,
    ]);
  });

  it('holds every vertex exactly at the level plane, on the surface it describes', () => {
    const { values } = build(RAMP, 3, 3);

    for (let i = 1; i < values.length; i += 3) {
      expect(values[i]).toBe(20);
    }
  });

  it('applies vertical exaggeration and the base shift to the level plane', () => {
    const { values } = build(RAMP, 3, 3, {
      verticalExaggeration: 4,
      baseElevationMeters: 10,
    });

    // (level − base) × exaggeration, matching where
    // buildHeightfieldGeometry would place the same elevation.
    const expected = (20 - 10) * 4;
    for (let i = 1; i < values.length; i += 3) {
      expect(values[i]).toBe(expected);
    }
  });

  it('keeps every vertex inside the extent footprint', () => {
    const samples = new Float32Array([30, 100, 170, 200, 270, 340, 370, 440, 510]);

    const { values } = build(samples, 3, 3);

    expect(values.length).toBeGreaterThan(0);
    for (let i = 0; i < values.length; i += 3) {
      expect(values[i]).toBeGreaterThanOrEqual(-30);
      expect(values[i]).toBeLessThanOrEqual(30);
      expect(values[i + 2]).toBeGreaterThanOrEqual(-30);
      expect(values[i + 2]).toBeLessThanOrEqual(30);
    }
  });

  it('resolves an ambiguous saddle instead of emitting a stray pair', () => {
    // Corners alternate around the 20m level, so all four edges cross. The
    // northEast↔southWest diagonal — the one heightfield.ts actually
    // triangulates on — decides the pairing, so no centre test is needed.
    const samples = new Float32Array([0, 30, 30, 0]);

    const { values, count } = build(samples, 2, 2);

    expect(count).toBe(4);
    expect(values.every((value) => Number.isFinite(value))).toBe(true);
    for (let i = 1; i < values.length; i += 3) {
      expect(values[i]).toBe(20);
    }
  });

  it('lies on the triangulated mesh rather than on the bilinear patch', () => {
    // twist = a + d − b − c = 0 + 40 − 50 − 0 = −10, so the bilinear patch and
    // the two rendered triangles disagree by up to 2.5m at the cell centre.
    // Contouring the patch instead drops the line inside the surface, where the
    // depth test rejects it — bilinear contours rendered 417px of the canvas
    // against 9,557 once corrected.
    const samples = new Float32Array([0, 50, 0, 40]);
    const { values } = build(samples, 2, 2);

    // A 2×2 grid is a single cell spanning the whole extent, so the cell step
    // is the full 60m — deriving t/s with the 30m step a 3×3 grid would use
    // silently doubles every coordinate and puts the point outside the cell.
    const stepX = EXTENT.widthMeters / 1;
    const stepZ = EXTENT.depthMeters / 1;

    expect(values.length).toBeGreaterThan(0);
    for (let i = 0; i < values.length; i += 3) {
      const t = (values[i] + EXTENT.widthMeters / 2) / stepX;
      const s = (values[i + 2] + EXTENT.depthMeters / 2) / stepZ;
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
      const onMesh = triangulatedHeight(samples, t, s);
      // base 0, exaggeration 1, so y is the level — and the level is exactly
      // where the rendered triangles sit at this point.
      expect(values[i + 1]).toBeCloseTo(onMesh, 4);
    }
  });
});
