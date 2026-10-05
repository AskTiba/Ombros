import { describe, expect, it } from 'vitest';
import type { BufferAttribute, BufferGeometry } from 'three';
import {
  buildHeightfieldGeometry,
  MAX_CELL_SIZE_DRIFT,
} from '@/features/terrain/heightfield';
import { boundsHeightMeters, boundsWidthMeters } from '@/lib/geo';

interface GridOptions {
  rows: number;
  cols: number;
  widthMeters?: number;
  depthMeters?: number;
}

/** Every non-finite value is a DEM nodata leak, not terrain. */
const FLAT_ELEVATION = 1000;

const flatSamples = (count: number, elevation = FLAT_ELEVATION): Float32Array =>
  new Float32Array(count).fill(elevation);

/**
 * Builds a grid whose cell size is uniform by construction: the extent is
 * derived from `cellMeters` so `width/(cols-1) === depth/(rows-1)` exactly.
 * Tests that need a *bad* grid override the extent instead.
 */
const gridOf = ({
  rows,
  cols,
  cellMeters = 100,
  elevation = FLAT_ELEVATION,
  samples,
}: GridOptions & {
  cellMeters?: number;
  elevation?: number;
  samples?: Float32Array;
}): Parameters<typeof buildHeightfieldGeometry>[0] => ({
  samples: samples ?? flatSamples(rows * cols, elevation),
  rows,
  cols,
  extent: {
    widthMeters: (cols - 1) * cellMeters,
    depthMeters: (rows - 1) * cellMeters,
  },
});

const position = (geometry: BufferGeometry, index: number) => {
  const attribute = geometry.getAttribute('position') as BufferAttribute;
  return {
    x: attribute.getX(index),
    y: attribute.getY(index),
    z: attribute.getZ(index),
  };
};

const normal = (geometry: BufferGeometry, index: number) => {
  const attribute = geometry.getAttribute('normal') as BufferAttribute;
  return {
    x: attribute.getX(index),
    y: attribute.getY(index),
    z: attribute.getZ(index),
  };
};

/**
 * Geometric normal of triangle `triIndex`, computed from the index buffer and
 * positions. This is a renderer-free check of winding order: Three's default
 * material culls back faces, so a reversed winding shows as terrain that is
 * invisible from above rather than as a thrown error.
 */
const geometricNormalY = (geometry: BufferGeometry, triIndex: number): number => {
  const index = geometry.getIndex();
  if (!index) throw new Error('geometry is not indexed');
  const [i0, i1, i2] = [
    index.getX(triIndex * 3),
    index.getX(triIndex * 3 + 1),
    index.getX(triIndex * 3 + 2),
  ];
  const a = position(geometry, i0);
  const b = position(geometry, i1);
  const c = position(geometry, i2);
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  // a, b and c are the triangle's v0, v1, v2 in index order. Three treats
  // CCW winding as front-facing and derives the normal by the right-hand rule:
  // (v1 - v0) x (v2 - v0), i.e. ab x ac here.
  const cross = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x,
  };
  return cross.y;
};

describe('buildHeightfieldGeometry', () => {
  describe('grid validation', () => {
    it('rejects a grid with a single row', () => {
      expect(() => buildHeightfieldGeometry(gridOf({ rows: 1, cols: 4 }))).toThrow(
        /rows/,
      );
    });

    it('rejects a grid with a single column', () => {
      expect(() => buildHeightfieldGeometry(gridOf({ rows: 4, cols: 1 }))).toThrow(
        /cols/,
      );
    });

    it('rejects a non-integer grid dimension', () => {
      expect(() => buildHeightfieldGeometry(gridOf({ rows: 4.5, cols: 4 }))).toThrow(
        /integer/,
      );
    });

    it('rejects a sample buffer that disagrees with the declared dimensions', () => {
      // The real corruption mode: a DEM binary whose header says 16x16 but
      // whose payload is a different length. This must throw loudly, never
      // render a half-empty terrain.
      const options = gridOf({ rows: 4, cols: 4 });
      expect(() =>
        buildHeightfieldGeometry({ ...options, samples: flatSamples(15) }),
      ).toThrow(/samples/);
    });

    it('rejects a non-finite elevation sample', () => {
      // GLO-30 COG tiles contain nodata voids. A NaN that reaches the position
      // attribute silently poisons every triangle it touches.
      const samples = flatSamples(16);
      samples[7] = Number.NaN;
      expect(() =>
        buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4, samples })),
      ).toThrow(/finite/);
    });

    it('rejects an infinite elevation sample', () => {
      const samples = flatSamples(16);
      samples[0] = Number.POSITIVE_INFINITY;
      expect(() =>
        buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4, samples })),
      ).toThrow(/finite/);
    });

    it('rejects a grid whose cells are not a uniform size', () => {
      // 400x400m of extent across 4x4 cells is uniform. Stretching the depth to
      // 500m makes cell sizes differ by 25% — the terrain would be stretched
      // north-south and every later measurement would inherit the distortion.
      expect(() =>
        buildHeightfieldGeometry({
          ...gridOf({ rows: 4, cols: 4 }),
          extent: { widthMeters: 400, depthMeters: 500 },
        }),
      ).toThrow(/uniform/);
    });

    it('accepts the cell-size drift caused by integer rounding', () => {
      // Unit 1c derives dims with `round(width / cell) + 1`, so the realised
      // cell size drifts by design. A uniform grid must still pass.
      expect(() =>
        buildHeightfieldGeometry({
          samples: flatSamples(16),
          rows: 4,
          cols: 4,
          extent: { widthMeters: 400.4, depthMeters: 399.7 },
        }),
      ).not.toThrow();
    });

    it('rejects a non-finite base elevation', () => {
      expect(() =>
        buildHeightfieldGeometry({
          ...gridOf({ rows: 4, cols: 4, elevation: 1000 }),
          baseElevationMeters: Number.NaN,
        }),
      ).toThrow(/baseElevationMeters/);
    });

    it('rejects a non-positive extent', () => {
      expect(() =>
        buildHeightfieldGeometry({
          ...gridOf({ rows: 4, cols: 4 }),
          extent: { widthMeters: 0, depthMeters: 300 },
        }),
      ).toThrow(/extent/);
    });

    it('rejects a vertical exaggeration that is not a positive finite number', () => {
      expect(() =>
        buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4, elevation: 1000 })),
      ).not.toThrow();
      expect(() =>
        buildHeightfieldGeometry({
          ...gridOf({ rows: 4, cols: 4, elevation: 1000 }),
          verticalExaggeration: 0,
        }),
      ).toThrow(/verticalExaggeration/);
      expect(() =>
        buildHeightfieldGeometry({
          ...gridOf({ rows: 4, cols: 4, elevation: 1000 }),
          verticalExaggeration: Number.NaN,
        }),
      ).toThrow(/verticalExaggeration/);
    });
  });

  describe('vertex layout', () => {
    it('creates exactly one vertex per grid sample', () => {
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 7, cols: 11 }));
      const attribute = geometry.getAttribute('position') as BufferAttribute;
      expect(attribute.count).toBe(7 * 11);
    });

    it('anchors the north-west corner at the negative X and Z corner', () => {
      // Origin sits at the study-area centroid, so the mesh is centred rather
      // than offset 19km from the world origin.
      const geometry = buildHeightfieldGeometry(
        gridOf({ rows: 4, cols: 4, elevation: 0 }),
      );
      expect(position(geometry, 0)).toEqual({
        x: expect.closeTo(-150, 6),
        y: expect.closeTo(0, 6),
        z: expect.closeTo(-150, 6),
      });
    });

    it('anchors the south-east corner at the positive X and Z corner', () => {
      const geometry = buildHeightfieldGeometry(
        gridOf({ rows: 4, cols: 4, elevation: 0 }),
      );
      expect(position(geometry, 15)).toEqual({
        x: expect.closeTo(150, 6),
        y: expect.closeTo(0, 6),
        z: expect.closeTo(150, 6),
      });
    });

    it('increases x eastward and z southward along the first row', () => {
      // +X = east, +Z = south. Pinning this once stops a silent axis flip,
      // which is invisible until someone renders the city and notices Kampala
      // is mirrored.
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4 }));
      expect(position(geometry, 1).x).toBeGreaterThan(position(geometry, 0).x);
      expect(position(geometry, 1).z).toBeCloseTo(position(geometry, 0).z, 6);
      expect(position(geometry, 4).z).toBeGreaterThan(position(geometry, 0).z);
      expect(position(geometry, 4).x).toBeCloseTo(position(geometry, 0).x, 6);
    });

    it('places row 0 at the northern edge of the grid', () => {
      // Row 0 must be north (-Z). The flood-extent rasters in Unit 2 will use
      // the same row convention, so flipping it here would misalign the water
      // surface against the terrain it sits on.
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 5, cols: 3 }));
      expect(position(geometry, 0).z).toBeCloseTo(-200, 6);
      expect(position(geometry, 5 * 3 - 1).z).toBeCloseTo(200, 6);
    });
  });

  describe('elevation', () => {
    it('uses the raw elevation when there is no exaggeration or base shift', () => {
      const samples = new Float32Array(16);
      for (let i = 0; i < 16; i += 1) samples[i] = 1100 + i;
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4, samples }));
      expect(position(geometry, 0).y).toBeCloseTo(1100, 3);
      expect(position(geometry, 7).y).toBeCloseTo(1107, 3);
    });

    it('samples elevations row-major as row * cols + col', () => {
      const samples = new Float32Array(16);
      for (let i = 0; i < 16; i += 1) samples[i] = i;
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4, samples }));
      expect(position(geometry, 6).y).toBeCloseTo(6, 3);
      expect(position(geometry, 9).y).toBeCloseTo(9, 3);
    });

    it('multiplies relief by the vertical exaggeration', () => {
      // Kampala has ~1000m of relief across ~20km. At 1:1 the hills are
      // invisible, so the exaggeration is applied here and disclosed to the
      // user — it is never a hidden default.
      const samples = new Float32Array(16);
      samples.fill(1000);
      samples[0] = 1100;
      const geometry = buildHeightfieldGeometry({
        ...gridOf({ rows: 4, cols: 4, samples }),
        verticalExaggeration: 8,
      });
      // samples[0] = 1100 is the peak, the rest of the grid sits at 1000.
      expect(position(geometry, 0).y).toBeCloseTo(8800, 3);
      expect(position(geometry, 1).y).toBeCloseTo(8000, 3);
    });

    it('subtracts the base elevation before exaggerating', () => {
      const geometry = buildHeightfieldGeometry({
        ...gridOf({ rows: 4, cols: 4, elevation: 1150 }),
        baseElevationMeters: 1100,
        verticalExaggeration: 3,
      });
      expect(position(geometry, 0).y).toBeCloseTo(150, 3);
    });

    it('defaults to no exaggeration and no base shift', () => {
      const geometry = buildHeightfieldGeometry(
        gridOf({ rows: 4, cols: 4, elevation: 1150 }),
      );
      expect(position(geometry, 0).y).toBeCloseTo(1150, 3);
    });
  });

  describe('triangle winding and normals', () => {
    it('emits two triangles per quad', () => {
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 5 }));
      expect(geometry.getIndex()?.count).toBe((4 - 1) * (5 - 1) * 6);
    });

    it('winds every triangle counter-clockwise when viewed from above', () => {
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 5, cols: 6 }));
      const index = geometry.getIndex();
      if (!index) throw new Error('geometry is not indexed');
      for (let tri = 0; tri < index.count / 3; tri += 1) {
        expect(geometricNormalY(geometry, tri)).toBeGreaterThan(0);
      }
    });

    it('produces straight-up normals for a flat grid', () => {
      // Proves the winding is correct without a renderer: a reversed winding
      // yields straight-down normals on flat terrain.
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4 }));
      const attribute = geometry.getAttribute('normal') as BufferAttribute;
      for (let i = 0; i < attribute.count; i += 1) {
        const n = normal(geometry, i);
        expect(n.y).toBeCloseTo(1, 5);
        expect(n.x).toBeCloseTo(0, 5);
        expect(n.z).toBeCloseTo(0, 5);
      }
    });

    it('tilts normals on sloped terrain so hillshading has something to shade', () => {
      // A ramp rising toward the north. Normals must lean, not stay vertical.
      const samples = new Float32Array(16);
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          samples[row * 4 + col] = 1000 + (3 - row) * 100;
        }
      }
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4, samples }));
      // Terrain rises toward -Z (north), so the normal leans toward +Z.
      expect(normal(geometry, 0).z).toBeGreaterThan(0);
      expect(normal(geometry, 0).y).toBeGreaterThan(0);
      expect(normal(geometry, 0).y).toBeLessThan(1);
    });
  });

  describe('index buffer width', () => {
    it('uses a 16-bit index buffer while the vertex count fits', () => {
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 64, cols: 64 }));
      expect(geometry.getIndex()?.array.BYTES_PER_ELEMENT).toBe(2);
    });

    it('uses a 32-bit index buffer beyond the 16-bit vertex limit', () => {
      // A 30m grid over the Kampala extent is 642 x 750 = 481,500 vertices.
      // Silently writing those into a Uint16Array wraps past index 65,535 and
      // produces a corrupt mesh with no error thrown anywhere.
      const rows = 750;
      const cols = 642;
      const geometry = buildHeightfieldGeometry(gridOf({ rows, cols, cellMeters: 30 }));
      expect((geometry.getAttribute('position') as BufferAttribute).count).toBe(
        rows * cols,
      );
      expect(geometry.getIndex()?.array.BYTES_PER_ELEMENT).toBe(4);
    });
  });

  describe('attributes', () => {
    it('exposes position, normal and uv', () => {
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4 }));
      expect(geometry.getAttribute('position')).toBeDefined();
      expect(geometry.getAttribute('normal')).toBeDefined();
      expect(geometry.getAttribute('uv')).toBeDefined();
    });

    it('maps the northern edge to v = 1', () => {
      // Three uploads images with flipY = true by default, so v = 0 is the
      // southern edge. Unit 1c's rasteriser must emit rows south-to-north to
      // match, or the terrain will be flipped when a texture lands on it.
      const uv = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4 })).getAttribute(
        'uv',
      ) as BufferAttribute;
      expect(uv.getY(0)).toBeCloseTo(1, 6);
      expect(uv.getX(0)).toBeCloseTo(0, 6);
      expect(uv.getY(15)).toBeCloseTo(0, 6);
      expect(uv.getX(15)).toBeCloseTo(1, 6);
    });

    it('computes a bounding sphere so frustum culling can work', () => {
      // Three skips culling for a geometry with no bounding sphere, so leaving
      // this out is a silent draw-call regression against the <=60 budget.
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4 }));
      expect(geometry.boundingSphere).not.toBeNull();
      expect(geometry.boundingSphere?.radius).toBeGreaterThan(0);
    });

    it('stores positions in 32-bit floats', () => {
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4 }));
      const attribute = geometry.getAttribute('position') as BufferAttribute;
      expect(attribute.array).toBeInstanceOf(Float32Array);
    });
  });

  describe('the real Kampala grid', () => {
    // Dims are derived from the extent rather than hardcoded, using the same
    // `round(extent / cell) + 1` rule Unit 1c's fetch script uses. Hardcoding
    // them silently encoded the old sphere-model extent: when `geo.ts` moved
    // to WGS84 this test failed for the right reason (the grid genuinely
    // needed 643 x 746) but only by accident of me rechecking the arithmetic.
    const kampalaGridDims = (cellMeters: number) => ({
      rows: Math.round(boundsHeightMeters() / cellMeters) + 1,
      cols: Math.round(boundsWidthMeters() / cellMeters) + 1,
    });

    it('accepts the uniform 30m grid the DEM fetch will produce', () => {
      // The WGS84 study extent is ~19,258m E-W by ~22,336m N-S — an aspect of
      // 0.862, so a 30m grid is 643 x 746. This asserts the approved invariant
      // accepts the grid we will actually build rather than rejecting it as
      // "non-square".
      const { rows, cols } = kampalaGridDims(30);
      const geometry = buildHeightfieldGeometry({
        samples: flatSamples(rows * cols),
        rows,
        cols,
        extent: {
          widthMeters: boundsWidthMeters(),
          depthMeters: boundsHeightMeters(),
        },
      });
      expect((geometry.getAttribute('position') as BufferAttribute).count).toBe(
        rows * cols,
      );
    });

    it('derives a grid that stays within cell-size tolerance at every tier', () => {
      // The three adaptive quality tiers Unit 1d will offer. Each must survive
      // the uniform-cell invariant, or a tier would be unloadable.
      for (const cellMeters of [30, 60, 120]) {
        const { rows, cols } = kampalaGridDims(cellMeters);
        const cellX = boundsWidthMeters() / (cols - 1);
        const cellZ = boundsHeightMeters() / (rows - 1);
        expect(Math.abs(cellX - cellZ) / Math.max(cellX, cellZ)).toBeLessThanOrEqual(
          MAX_CELL_SIZE_DRIFT,
        );
      }
    });

    it('rejects a square grid over the real Kampala extent', () => {
      // Square cell counts over a non-square extent would need two different
      // cell sizes, so this is exactly the distortion the invariant exists to
      // catch.
      expect(() =>
        buildHeightfieldGeometry({
          samples: flatSamples(600 * 600),
          rows: 600,
          cols: 600,
          extent: {
            widthMeters: boundsWidthMeters(),
            depthMeters: boundsHeightMeters(),
          },
        }),
      ).toThrow(/uniform/);
    });
  });

  describe('renderer boundary', () => {
    it('creates no canvas and needs no WebGL context', () => {
      expect(document.querySelector('canvas')).toBeNull();
      expect(() => buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4 }))).not.toThrow();
      expect(document.querySelector('canvas')).toBeNull();
      expect(typeof WebGLRenderingContext).toBe('undefined');
    });

    it('returns a BufferGeometry rather than a scene object', () => {
      const geometry = buildHeightfieldGeometry(gridOf({ rows: 4, cols: 4 }));
      expect(geometry.type).toBe('BufferGeometry');
      expect('isMesh' in geometry).toBe(false);
      expect('children' in geometry).toBe(false);
    });

    it('does not mutate the caller-owned sample buffer', () => {
      const samples = new Float32Array(16);
      samples.fill(1155);
      const copy = new Float32Array(samples);
      const geometry = buildHeightfieldGeometry({
        ...gridOf({ rows: 4, cols: 4, samples }),
        verticalExaggeration: 8,
        baseElevationMeters: 1100,
      });
      expect(Array.from(samples)).toEqual(Array.from(copy));
      expect(position(geometry, 0).y).toBeCloseTo(440, 3);
    });

    it('produces an independent geometry on every call', () => {
      const options = gridOf({ rows: 4, cols: 4 });
      const first = buildHeightfieldGeometry(options);
      const second = buildHeightfieldGeometry(options);
      expect(first).not.toBe(second);
      expect(first.getAttribute('position')).not.toBe(second.getAttribute('position'));
    });
  });
});
