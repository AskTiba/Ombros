import { describe, expect, it } from 'vitest';
import type { BufferAttribute, BufferGeometry } from 'three';
import { buildSlabGeometry, SLAB_DEPTH_METERS } from '@/features/terrain/slab';

interface GridOptions {
  rows: number;
  cols: number;
  cellMeters?: number;
  samples?: Float32Array;
  baseElevationMeters?: number;
  verticalExaggeration?: number;
  depthMeters?: number;
}

const FLAT_ELEVATION = 1000;

const flatSamples = (count: number, elevation = FLAT_ELEVATION): Float32Array =>
  new Float32Array(count).fill(elevation);

/**
 * Extent is derived from `cellMeters` so the uniform-cell invariant holds by
 * construction, exactly as `heightfield.test.ts` does. Tests that need a *bad*
 * grid override the extent instead.
 */
const gridOf = ({
  rows,
  cols,
  cellMeters = 100,
  samples,
  ...rest
}: GridOptions): Parameters<typeof buildSlabGeometry>[0] => ({
  samples: samples ?? flatSamples(rows * cols),
  rows,
  cols,
  extent: {
    widthMeters: (cols - 1) * cellMeters,
    depthMeters: (rows - 1) * cellMeters,
  },
  ...rest,
});

const position = (geometry: BufferGeometry, index: number) => {
  const attribute = geometry.getAttribute('position') as BufferAttribute;
  return { x: attribute.getX(index), y: attribute.getY(index), z: attribute.getZ(index) };
};

const colour = (geometry: BufferGeometry, index: number) => {
  const attribute = geometry.getAttribute('color') as BufferAttribute;
  return { r: attribute.getX(index), g: attribute.getY(index), b: attribute.getZ(index) };
};

/**
 * Geometric normal of triangle `triIndex`, from the index buffer and positions.
 * Renderer-free winding check: three culls back faces, so a reversed winding
 * shows as a wall you can see through rather than as a thrown error.
 */
const geometricNormal = (geometry: BufferGeometry, triIndex: number) => {
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
  return {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x,
    // The centroid gives the outward direction for a wall around the origin.
    cx: (a.x + b.x + c.x) / 3,
    cz: (a.z + b.z + c.z) / 3,
  };
};

/** Boundary vertices in the order the walls are built: N, E, S, W. */
const boundaryLength = (rows: number, cols: number): number => 2 * (rows + cols) - 4;

describe('buildSlabGeometry', () => {
  describe('closing the terrain', () => {
    it('builds one wall segment per boundary edge plus a floor', () => {
      const rows = 4;
      const cols = 4;
      const segments = boundaryLength(rows, cols); // 12
      const geometry = buildSlabGeometry(gridOf({ rows, cols }));

      // Two vertices per segment (top and floor of that wall run), plus four
      // dedicated corners for the floor face.
      expect(geometry.getAttribute('position')?.count).toBe(segments * 2 + 4);
      // Two triangles per wall segment, two for the floor.
      expect(geometry.getIndex()?.count).toBe(segments * 6 + 6);
    });

    it('sizes the wall loop from the grid, not from its aspect', () => {
      // A non-square grid still has one segment per boundary edge: 2*(r+c)-4.
      // Hardcoding a square loop would leave the east and west walls open.
      const geometry = buildSlabGeometry(gridOf({ rows: 7, cols: 11 }));
      const segments = boundaryLength(7, 11);
      expect(geometry.getAttribute('position')?.count).toBe(segments * 2 + 4);
    });

    it('joins the wall tops to the terrain surface they inherit', () => {
      // Flat grid whose base is its own elevation, so the terrain sits at y = 0
      // and every wall top must land exactly on it.
      const geometry = buildSlabGeometry(
        gridOf({ rows: 4, cols: 4, baseElevationMeters: FLAT_ELEVATION }),
      );
      const attribute = geometry.getAttribute('position') as BufferAttribute;
      const segments = boundaryLength(4, 4);
      for (let i = 0; i < segments; i += 1) {
        expect(attribute.getY(i * 2)).toBeCloseTo(0, 6);
      }
    });

    it('follows a sloped boundary rather than levelling it', () => {
      // Elevation climbs 100m per row toward the north. The wall tops are the
      // boundary samples themselves, so they must vary with row.
      const samples = new Float32Array(25);
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          samples[row * 5 + col] = 1000 + (4 - row) * 100;
        }
      }
      const geometry = buildSlabGeometry(
        gridOf({
          rows: 5,
          cols: 5,
          samples,
          baseElevationMeters: 1000,
          verticalExaggeration: 1,
        }),
      );
      const attribute = geometry.getAttribute('position') as BufferAttribute;
      const topOf = (i: number) => attribute.getY(i * 2);
      // Segment 0 is the first north-wall run: both ends sit on row 0 at y = 400.
      expect(topOf(0)).toBeCloseTo(400, 6);
      expect(topOf(1)).toBeCloseTo(400, 6);
      // Walking east along the north wall keeps row 0, so it stays at 400.
      expect(topOf(3)).toBeCloseTo(400, 6);
    });
  });

  describe('the floor', () => {
    it('defaults to SLAB_DEPTH_METERS below the lowest sample of the whole grid', () => {
      const geometry = buildSlabGeometry(
        gridOf({ rows: 4, cols: 4, baseElevationMeters: FLAT_ELEVATION }),
      );
      const attribute = geometry.getAttribute('position') as BufferAttribute;
      const segments = boundaryLength(4, 4);
      for (let i = segments * 2; i < attribute.count; i += 1) {
        expect(attribute.getY(i)).toBeCloseTo(-SLAB_DEPTH_METERS, 6);
      }
    });

    it('sits below a basin that no boundary vertex reaches', () => {
      // The real failure mode: the lake sits in the grid's south-east interior,
      // so a floor derived from the *boundary* minimum would end up above the
      // water and the terrain would poke through the bottom of the slab.
      const samples = flatSamples(25, 1000);
      samples[12] = 900; // the only sample below 1000, and it is interior
      const geometry = buildSlabGeometry(
        gridOf({ rows: 5, cols: 5, samples, baseElevationMeters: 1000 }),
      );
      const attribute = geometry.getAttribute('position') as BufferAttribute;
      const segments = boundaryLength(5, 5);
      const floorY = attribute.getY(segments * 2);
      expect(floorY).toBeCloseTo(900 - SLAB_DEPTH_METERS - 1000, 6);
      expect(floorY).toBeLessThan(900 - 1000);
    });

    it('multiplies the floor depth by the vertical exaggeration', () => {
      // The slab lives in the same model space as the terrain, so the depth has
      // to be exaggerated with it or the base would look paper-thin at ×4.
      const geometry = buildSlabGeometry(
        gridOf({ rows: 4, cols: 4, baseElevationMeters: 1000, verticalExaggeration: 4 }),
      );
      const attribute = geometry.getAttribute('position') as BufferAttribute;
      expect(attribute.getY(boundaryLength(4, 4) * 2)).toBeCloseTo(
        -SLAB_DEPTH_METERS * 4,
        6,
      );
    });

    it('honours an explicit floor depth', () => {
      const geometry = buildSlabGeometry(
        gridOf({ rows: 4, cols: 4, baseElevationMeters: 1000, depthMeters: 150 }),
      );
      const attribute = geometry.getAttribute('position') as BufferAttribute;
      expect(attribute.getY(boundaryLength(4, 4) * 2)).toBeCloseTo(-150, 6);
    });

    it('rejects a depth that is not a positive finite number', () => {
      expect(() =>
        buildSlabGeometry(gridOf({ rows: 4, cols: 4, depthMeters: 0 })),
      ).toThrow(/depthMeters/);
      expect(() =>
        buildSlabGeometry(gridOf({ rows: 4, cols: 4, depthMeters: -20 })),
      ).toThrow(/depthMeters/);
      expect(() =>
        buildSlabGeometry(gridOf({ rows: 4, cols: 4, depthMeters: Number.NaN })),
      ).toThrow(/depthMeters/);
    });
  });

  describe('winding and normals', () => {
    it('winds every wall triangle to face away from the slab', () => {
      // A wall wound inward renders as a surface you can see through from
      // outside the model, which reads as a hole rather than as an error.
      const geometry = buildSlabGeometry(gridOf({ rows: 5, cols: 6 }));
      const index = geometry.getIndex();
      if (!index) throw new Error('geometry is not indexed');
      const wallTriangles = boundaryLength(5, 6) * 2;
      for (let tri = 0; tri < wallTriangles; tri += 1) {
        const n = geometricNormal(geometry, tri);
        expect(n.cx * n.x + n.cz * n.z).toBeGreaterThan(0);
      }
    });

    it('winds the floor to face downward', () => {
      const geometry = buildSlabGeometry(gridOf({ rows: 5, cols: 6 }));
      const index = geometry.getIndex();
      if (!index) throw new Error('geometry is not indexed');
      const floorStart = boundaryLength(5, 6) * 2;
      for (let tri = floorStart; tri < index.count / 3; tri += 1) {
        expect(geometricNormal(geometry, tri).y).toBeLessThan(0);
      }
    });

    it('computes normals so the slab can be lit or reused elsewhere', () => {
      const geometry = buildSlabGeometry(gridOf({ rows: 4, cols: 4 }));
      expect(geometry.getAttribute('normal')).toBeDefined();
      expect(geometry.getAttribute('normal')?.count).toBe(
        geometry.getAttribute('position')?.count,
      );
    });
  });

  describe('surface colour', () => {
    it('bakes a colour onto every vertex so one unlit material suffices', () => {
      const geometry = buildSlabGeometry(gridOf({ rows: 4, cols: 4 }));
      const colours = geometry.getAttribute('color');
      expect(colours).toBeDefined();
      expect(colours?.count).toBe(geometry.getAttribute('position')?.count);
      for (let i = 0; i < (colours?.count ?? 0); i += 1) {
        expect(Number.isFinite(colour(geometry, i).r)).toBe(true);
      }
    });

    it('shades darker toward the floor so the slab reads as solid mass', () => {
      // Every wall runs top-to-floor, so within a single wall the channel must
      // strictly decrease. Without this the slab renders as a flat silhouette.
      const geometry = buildSlabGeometry(gridOf({ rows: 5, cols: 5 }));
      const segments = boundaryLength(5, 5);
      for (let i = 0; i < segments; i += 1) {
        const top = colour(geometry, i * 2);
        const bottom = colour(geometry, i * 2 + 1);
        expect(bottom.r).toBeLessThan(top.r);
        expect(bottom.g).toBeLessThan(top.g);
        expect(bottom.b).toBeLessThan(top.b);
      }
    });

    it('paints the floor at the darkest shade', () => {
      const geometry = buildSlabGeometry(gridOf({ rows: 5, cols: 5 }));
      const segments = boundaryLength(5, 5);
      const darkestWall = colour(geometry, 1);
      expect(colour(geometry, segments * 2).r).toBeCloseTo(darkestWall.r, 6);
    });
  });

  describe('grid validation', () => {
    it('rejects a grid with a single row', () => {
      expect(() => buildSlabGeometry(gridOf({ rows: 1, cols: 4 }))).toThrow(/rows/);
    });

    it('rejects a sample buffer that disagrees with the declared dimensions', () => {
      expect(() =>
        buildSlabGeometry({ ...gridOf({ rows: 4, cols: 4 }), samples: flatSamples(15) }),
      ).toThrow(/samples/);
    });

    it('rejects a non-finite elevation sample', () => {
      const samples = flatSamples(16);
      samples[7] = Number.NaN;
      expect(() => buildSlabGeometry(gridOf({ rows: 4, cols: 4, samples }))).toThrow(
        /finite/,
      );
    });

    it('rejects a grid whose cells are not a uniform size', () => {
      expect(() =>
        buildSlabGeometry({
          ...gridOf({ rows: 4, cols: 4 }),
          extent: { widthMeters: 400, depthMeters: 500 },
        }),
      ).toThrow(/uniform/);
    });

    it('rejects a vertical exaggeration that is not a positive finite number', () => {
      expect(() =>
        buildSlabGeometry(gridOf({ rows: 4, cols: 4, verticalExaggeration: 0 })),
      ).toThrow(/verticalExaggeration/);
    });
  });

  describe('renderer boundary', () => {
    it('creates no canvas and needs no WebGL context', () => {
      expect(document.querySelector('canvas')).toBeNull();
      expect(() => buildSlabGeometry(gridOf({ rows: 4, cols: 4 }))).not.toThrow();
      expect(document.querySelector('canvas')).toBeNull();
      expect(typeof WebGLRenderingContext).toBe('undefined');
    });

    it('returns a BufferGeometry rather than a scene object', () => {
      const geometry = buildSlabGeometry(gridOf({ rows: 4, cols: 4 }));
      expect(geometry.type).toBe('BufferGeometry');
      expect('isMesh' in geometry).toBe(false);
    });

    it('computes a bounding sphere so frustum culling can work', () => {
      const geometry = buildSlabGeometry(gridOf({ rows: 4, cols: 4 }));
      expect(geometry.boundingSphere).not.toBeNull();
      expect(geometry.boundingSphere?.radius).toBeGreaterThan(0);
    });

    it('does not mutate the caller-owned sample buffer', () => {
      const samples = flatSamples(16, 1155);
      const copy = new Float32Array(samples);
      buildSlabGeometry(gridOf({ rows: 4, cols: 4, samples }));
      expect(Array.from(samples)).toEqual(Array.from(copy));
    });

    it('produces an independent geometry on every call', () => {
      const options = gridOf({ rows: 4, cols: 4 });
      const first = buildSlabGeometry(options);
      const second = buildSlabGeometry(options);
      expect(first).not.toBe(second);
      expect(first.getAttribute('position')).not.toBe(second.getAttribute('position'));
    });
  });
});
