import { describe, expect, it } from 'vitest';
import {
  DEM_CELL_SIZE_METERS,
  computeDemGrid,
  computeSourceWindow,
  resampleWindowToGrid,
  targetVertexToSourcePixel,
  type DemGridSpec,
  type SourceWindowGeo,
  type StudyExtent,
} from '@/features/terrain/demResample';
import {
  KAMPALA_BOUNDS,
  boundsHeightMeters,
  boundsWidthMeters,
  metresPerDegreeLatitude,
} from '@/lib/geo';
import { MAX_CELL_SIZE_DRIFT } from '@/features/terrain/heightfield';

/** 1 arcsecond, the Copernicus GLO-30 grid spacing. */
const ARCSECOND = 1 / 3600;

/**
 * Georeferencing for a synthetic window whose pixel (0, 0) sits at the study
 * extent's north-west corner, growing south and east.
 *
 * Built from the real bounds rather than a fixed latitude, so the pixel-scale
 * maths under test is the same WGS84 maths the shipped grid depends on.
 */
/**
 * The real study extent, assembled the same way `scripts/fetch-dem.mjs` does.
 * Built here rather than imported so the test exercises the real metre span
 * while keeping geo.ts the single source of the published bounds.
 */
const EXTENT: StudyExtent = {
  ...KAMPALA_BOUNDS,
  widthMeters: boundsWidthMeters(),
  depthMeters: boundsHeightMeters(),
};

const KAMPALA_DEM_GRID: DemGridSpec = computeDemGrid(
  EXTENT.widthMeters,
  EXTENT.depthMeters,
);

const NW_ORIGIN: Pick<SourceWindowGeo, 'originLon' | 'originLat' | 'pixelSizeDegrees'> = {
  originLon: KAMPALA_BOUNDS.west,
  originLat: KAMPALA_BOUNDS.north,
  pixelSizeDegrees: ARCSECOND,
};

/**
 * The real COG's raster origin: pixel (0, 0) is the centre of the pixel at
 * 32°E, 1°N. Used for the window tests so they exercise the same coordinates
 * `scripts/fetch-dem.mjs` will, instead of an origin placed conveniently at the
 * extent edge.
 */
const RASTER_ORIGIN: Pick<
  SourceWindowGeo,
  'originLon' | 'originLat' | 'pixelSizeDegrees'
> = {
  originLon: 32,
  originLat: 1,
  pixelSizeDegrees: ARCSECOND,
};

describe('computeDemGrid', () => {
  it('produces 643 x 746 for the Kampala extent at 30m', () => {
    expect(KAMPALA_DEM_GRID.cols).toBe(643);
    expect(KAMPALA_DEM_GRID.rows).toBe(746);
    expect(KAMPALA_DEM_GRID.cols * KAMPALA_DEM_GRID.rows).toBe(479_678);
  });

  it('carries the metre extent through unchanged', () => {
    // Critical: the header records these numbers, so any rescale here would
    // move the terrain relative to its own declared footprint.
    expect(KAMPALA_DEM_GRID.widthMeters).toBe(boundsWidthMeters());
    expect(KAMPALA_DEM_GRID.depthMeters).toBe(boundsHeightMeters());
  });

  it('yields uniform cells within the ADR-006 tolerance', () => {
    const cellX = KAMPALA_DEM_GRID.widthMeters / (KAMPALA_DEM_GRID.cols - 1);
    const cellZ = KAMPALA_DEM_GRID.depthMeters / (KAMPALA_DEM_GRID.rows - 1);
    const drift = Math.abs(cellX - cellZ) / Math.max(cellX, cellZ);
    expect(drift).toBeLessThan(MAX_CELL_SIZE_DRIFT);
  });

  it('counts vertices, not cells', () => {
    // A 30m x 30m extent has one cell and therefore two grid lines per axis.
    expect(computeDemGrid(30, 30)).toEqual({
      cols: 2,
      rows: 2,
      widthMeters: 30,
      depthMeters: 30,
    });
  });

  it('never returns a grid of fewer than 2 vertices per axis', () => {
    // round(30/30) + 1 = 2. A cell size larger than the extent would otherwise
    // collapse to 1 vertex, which cannot form a quad.
    const tiny = computeDemGrid(10, 10, 30);
    expect(tiny.cols).toBe(1);
    expect(tiny.rows).toBe(1);
  });

  it('rejects non-positive or non-finite extents', () => {
    expect(() => computeDemGrid(0, 100)).toThrow(/width must be positive/);
    expect(() => computeDemGrid(100, -1)).toThrow(/depth must be positive/);
    expect(() => computeDemGrid(Number.NaN, 100)).toThrow(/width must be positive/);
    expect(() => computeDemGrid(100, Number.POSITIVE_INFINITY)).toThrow(
      /depth must be positive/,
    );
  });

  it('rejects a non-positive cell size', () => {
    expect(() => computeDemGrid(100, 100, 0)).toThrow(/cell size must be positive/);
    expect(() => computeDemGrid(100, 100, Number.NaN)).toThrow(
      /cell size must be positive/,
    );
  });

  it('defaults to the 30m cell size', () => {
    expect(computeDemGrid(19_258, 22_336)).toEqual(computeDemGrid(19_258, 22_336, 30));
    expect(DEM_CELL_SIZE_METERS).toBe(30);
  });
});

describe('targetVertexToSourcePixel', () => {
  const geo: SourceWindowGeo = { ...NW_ORIGIN, cols: 10, rows: 10 };

  it('puts the north-west vertex at the origin', () => {
    const { px, py } = targetVertexToSourcePixel(0, 0, KAMPALA_DEM_GRID, EXTENT, geo);
    expect(px).toBeCloseTo(0, 6);
    expect(py).toBeCloseTo(0, 6);
  });

  it('increases px eastward and py southward', () => {
    const east = targetVertexToSourcePixel(1, 0, KAMPALA_DEM_GRID, EXTENT, geo);
    const south = targetVertexToSourcePixel(0, 1, KAMPALA_DEM_GRID, EXTENT, geo);
    expect(east.px).toBeGreaterThan(0);
    expect(east.py).toBeCloseTo(0, 6);
    expect(south.py).toBeGreaterThan(0);
    expect(south.px).toBeCloseTo(0, 6);
  });

  it('spans the source window in roughly a thousand pixels', () => {
    const ne = targetVertexToSourcePixel(
      KAMPALA_DEM_GRID.cols - 1,
      0,
      KAMPALA_DEM_GRID,
      EXTENT,
      geo,
    );
    const sw = targetVertexToSourcePixel(
      0,
      KAMPALA_DEM_GRID.rows - 1,
      KAMPALA_DEM_GRID,
      EXTENT,
      geo,
    );
    expect(ne.px).toBeGreaterThan(600);
    expect(ne.px).toBeLessThan(700);
    expect(sw.py).toBeGreaterThan(700);
    expect(sw.py).toBeLessThan(800);
  });

  it('is anisotropic in source pixels because 1 arcsecond is not isotropic in metres', () => {
    const ne = targetVertexToSourcePixel(
      KAMPALA_DEM_GRID.cols - 1,
      0,
      KAMPALA_DEM_GRID,
      EXTENT,
      geo,
    );
    const sw = targetVertexToSourcePixel(
      0,
      KAMPALA_DEM_GRID.rows - 1,
      KAMPALA_DEM_GRID,
      EXTENT,
      geo,
    );
    // 642 uniform 30m cells east-west covers fewer arcseconds than 745 do
    // north-south: a degree of longitude is shorter than a degree of latitude.
    expect(ne.px).toBeLessThan(sw.py);
  });

  it('round-trips back to the published bounds within a source pixel', () => {
    const { px, py } = targetVertexToSourcePixel(
      KAMPALA_DEM_GRID.cols - 1,
      KAMPALA_DEM_GRID.rows - 1,
      KAMPALA_DEM_GRID,
      EXTENT,
      geo,
    );
    const lon = NW_ORIGIN.originLon + px * ARCSECOND;
    const lat = NW_ORIGIN.originLat - py * ARCSECOND;
    expect(Math.abs(lon - KAMPALA_BOUNDS.east) / ARCSECOND).toBeLessThan(1);
    expect(Math.abs(lat - KAMPALA_BOUNDS.south) / ARCSECOND).toBeLessThan(1);
  });
});

describe('computeSourceWindow', () => {
  it('covers the full extent plus a one-pixel margin', () => {
    const win = computeSourceWindow(KAMPALA_DEM_GRID, EXTENT, RASTER_ORIGIN, 3600, 3600);
    const ne = targetVertexToSourcePixel(
      KAMPALA_DEM_GRID.cols - 1,
      0,
      KAMPALA_DEM_GRID,
      EXTENT,
      {
        ...RASTER_ORIGIN,
        cols: 0,
        rows: 0,
      },
    );
    const sw = targetVertexToSourcePixel(
      0,
      KAMPALA_DEM_GRID.rows - 1,
      KAMPALA_DEM_GRID,
      EXTENT,
      {
        ...RASTER_ORIGIN,
        cols: 0,
        rows: 0,
      },
    );

    expect(win.left).toBeLessThanOrEqual(ne.px);
    expect(win.top).toBeLessThanOrEqual(sw.py);
    expect(win.left + win.width).toBeGreaterThan(ne.px);
    expect(win.top + win.height).toBeGreaterThan(sw.py);
  });

  it('leaves the margin inside the raster instead of clamping it away', () => {
    // A window with no margin would clip bilinear interpolation against its own
    // boundary and flatten the terrain along the western and southern edges.
    const win = computeSourceWindow(KAMPALA_DEM_GRID, EXTENT, RASTER_ORIGIN, 3600, 3600);
    expect(win.left).toBeGreaterThan(0);
    expect(win.top).toBeGreaterThan(0);
    expect(win.left + win.width).toBeLessThan(3600);
    expect(win.top + win.height).toBeLessThan(3600);
  });

  it('reads a window of roughly 626 x 730 source pixels', () => {
    const win = computeSourceWindow(KAMPALA_DEM_GRID, EXTENT, RASTER_ORIGIN, 3600, 3600);
    expect(win.width).toBeGreaterThan(620);
    expect(win.width).toBeLessThan(630);
    expect(win.height).toBeGreaterThan(724);
    expect(win.height).toBeLessThan(732);
  });

  it('clamps to the raster when the extent runs past its right and bottom edges', () => {
    // The study extent occupies pixels ~1839..2462 E-W and ~2127..2854 N-S of
    // the real 3600x3600 raster, so a raster that is smaller than the extent but
    // still overlaps it must yield a clipped window rather than a negative size.
    const win = computeSourceWindow(KAMPALA_DEM_GRID, EXTENT, RASTER_ORIGIN, 2400, 2200);
    expect(win.left).toBe(1838);
    expect(win.top).toBe(2126);
    expect(win.left + win.width).toBe(2400);
    expect(win.top + win.height).toBe(2200);
    expect(win.width).toBeGreaterThan(0);
    expect(win.height).toBeGreaterThan(0);
  });

  it('throws when the raster is too small to overlap the extent at all', () => {
    // A negative-width window would make every downstream read out of bounds,
    // so this has to fail loudly rather than clamp to a 1px sliver.
    expect(() =>
      computeSourceWindow(KAMPALA_DEM_GRID, EXTENT, RASTER_ORIGIN, 400, 400),
    ).toThrow(/window is empty/);
  });

  it('throws when the extent falls entirely outside the raster', () => {
    const elsewhere = {
      originLon: EXTENT.west - 10,
      originLat: EXTENT.north + 10,
      pixelSizeDegrees: ARCSECOND,
    };
    expect(() =>
      computeSourceWindow(KAMPALA_DEM_GRID, EXTENT, elsewhere, 3600, 3600),
    ).toThrow(/window is empty/);
  });
});

describe('resampleWindowToGrid', () => {
  const spec = { cols: 4, rows: 3, widthMeters: 300, depthMeters: 200 };

  /**
   * 1 arcsecond georeferencing for a window covering a given grid spec.
   *
   * Anchored at that grid's **north-west** corner, because
   * `targetVertexToLonLat` places the grid's northernmost row at
   * `KAMPALA_BOUNDS.south + depthMeters / metresPerDegreeLatitude(midLat)`. Any
   * other anchor pushes the grid off its window and every sample silently
   * clamps to an edge value, so a ramp test would pass while asserting nothing.
   */
  const windowFor = (target: DemGridSpec, cols = 700, rows = 700): SourceWindowGeo => {
    const midLatitude = (EXTENT.north + EXTENT.south) / 2;
    return {
      originLon: EXTENT.west,
      originLat: EXTENT.south + target.depthMeters / metresPerDegreeLatitude(midLatitude),
      pixelSizeDegrees: ARCSECOND,
      cols,
      rows,
    };
  };

  it('returns exactly rows * cols samples', () => {
    const geo = windowFor(spec);
    const out = resampleWindowToGrid(new Float32Array(700 * 700), geo, spec, EXTENT);
    expect(out).toHaveLength(spec.rows * spec.cols);
  });

  it('passes a flat field through unchanged', () => {
    const geo = windowFor(spec);
    const out = resampleWindowToGrid(
      new Float32Array(700 * 700).fill(1_150),
      geo,
      spec,
      EXTENT,
    );
    for (const v of out) expect(v).toBeCloseTo(1_150, 3);
  });

  it('rejects a window whose length contradicts its georeferencing', () => {
    const geo = windowFor(spec);
    expect(() => resampleWindowToGrid(new Float32Array(10), geo, spec, EXTENT)).toThrow(
      /holds 10 samples but its georeferencing describes 490000/,
    );
  });

  it('reproduces a linear ramp along the row axis', () => {
    // One pixel of elevation gain per row, north to south. Bilinear sampling of
    // a linear field is exact, so the resampled grid must stay linear — this
    // catches a transposed or flipped resample that a flat field cannot.
    const geo = windowFor(spec);
    const window = new Float32Array(700 * 700);
    for (let r = 0; r < 700; r += 1) {
      for (let c = 0; c < 700; c += 1) window[r * 700 + c] = r;
    }
    const out = resampleWindowToGrid(window, geo, spec, EXTENT);

    const first = out[0];
    const last = out[(spec.rows - 1) * spec.cols];
    expect(last).toBeGreaterThan(first);
    // Every step between consecutive rows must be the same, to float tolerance.
    for (let row = 1; row < spec.rows; row += 1) {
      const delta = out[row * spec.cols] - out[(row - 1) * spec.cols];
      expect(delta).toBeCloseTo((last - first) / (spec.rows - 1), 4);
    }
  });

  it('reproduces a linear ramp along the column axis', () => {
    const geo = windowFor(spec);
    const window = new Float32Array(700 * 700);
    for (let r = 0; r < 700; r += 1) {
      for (let c = 0; c < 700; c += 1) window[r * 700 + c] = c;
    }
    const out = resampleWindowToGrid(window, geo, spec, EXTENT);

    const first = out[0];
    const last = out[spec.cols - 1];
    expect(last).toBeGreaterThan(first);
    for (let col = 1; col < spec.cols; col += 1) {
      expect(out[col] - out[col - 1]).toBeCloseTo((last - first) / (spec.cols - 1), 4);
    }
  });

  it('clamps at the window edge rather than reading a neighbouring row', () => {
    // A window whose origin sits far north-east of the extent pushes the whole
    // grid outside the window. Clamping must hold every sample at the edge
    // value; indexing without the clamp would read row 700+ and return 0 or
    // undefined-shaped garbage.
    const geo: SourceWindowGeo = {
      originLon: EXTENT.east,
      originLat: EXTENT.south + spec.depthMeters / metresPerDegreeLatitude(0.308),
      pixelSizeDegrees: ARCSECOND,
      cols: 10,
      rows: 10,
    };
    const out = resampleWindowToGrid(new Float32Array(100).fill(42), geo, spec, EXTENT);
    for (const v of out) expect(v).toBe(42);
  });

  it('keeps row 0 at the north edge, matching the raster and the builder', () => {
    // A north-up ramp: low values north, high values south. If the resample
    // flipped the row order the terrain would be inverted with no error.
    const geo = windowFor(spec);
    const window = new Float32Array(700 * 700);
    for (let r = 0; r < 700; r += 1) {
      for (let c = 0; c < 700; c += 1) window[r * 700 + c] = r;
    }
    const out = resampleWindowToGrid(window, geo, spec, EXTENT);
    expect(out[0]).toBeLessThan(out[(spec.rows - 1) * spec.cols]);
  });
});
