import { describe, expect, it } from 'vitest';

import type { GeoPackagePolygon } from './geoPackageGeometry';
import {
  FLOOD_THRESHOLD_COUNT,
  packFloodFlags,
  rasterizeFlood,
  unpackFloodFlags,
} from './rasterizeFlood';

const extent = { west: 0, south: 0, east: 4, north: 4 };

/** Cheap order-sensitive hash, so a 480k-element round trip costs one pass. */
const checksum = (bytes: Uint8Array): number => {
  let hash = 0;
  for (let i = 0; i < bytes.length; i += 1) hash = (hash * 31 + bytes[i]) | 0;
  return hash;
};

const polygon = (...rings: number[][]): GeoPackagePolygon => ({
  rings: rings.map((r) => Float64Array.from(r)),
  envelope: { minx: 0, maxx: 0, miny: 0, maxy: 0 },
});

/** A ring as a closed loop of x,y pairs. */
const loop = (coords: number[]): number[] => [...coords, coords[0], coords[1]];

describe('rasterizeFlood', () => {
  it('fills the cell whose centre the polygon covers', () => {
    // Cell centres on a 4x4 grid over 0..4 are at 0.5, 1.5, 2.5, 3.5 — and
    // row 0 is the north edge (ADR-005), so row r sits at lat 3.5 - r. The
    // centre (1.5, 1.5) is therefore row 2, column 1.
    const flags = rasterizeFlood({
      cols: 4,
      rows: 4,
      extent,
      polygons: [polygon(loop([1, 1, 2, 1, 2, 2, 1, 2]))],
      bit: 1,
    });
    expect(flags[2 * 4 + 1]).toBe(1); // centre (1.5, 1.5)
    expect(flags[0]).toBe(0); // centre (0.5, 3.5) is north of the polygon
  });

  it('leaves cells whose centres fall outside, even if an edge clips them', () => {
    // A polygon stopping short of a cell must not spill into it: the model
    // answers "is the middle of this 30m cell flooded?", not "does any of it
    // overlap?" — otherwise every extent grows by a cell and the numbers stop
    // matching the published study.
    const flags = rasterizeFlood({
      cols: 4,
      rows: 4,
      extent,
      polygons: [polygon(loop([0, 0, 1.4, 0, 1.4, 1, 0, 1]))],
      bit: 1,
    });
    expect(flags[3 * 4 + 0]).toBe(1); // centre (0.5, 0.5) inside
    expect(flags[3 * 4 + 1]).toBe(0); // centre (1.5, 0.5) outside — edge stops at 1.4
  });

  it('does not flood a hole', () => {
    // Later rings of a GeoPackage polygon are interior rings. Even-odd
    // crossing counts them out; treating every ring as solid would paint
    // islands inside flood patches as dry.
    const flags = rasterizeFlood({
      cols: 4,
      rows: 4,
      extent,
      polygons: [polygon(loop([0, 0, 4, 0, 4, 4, 0, 4]), loop([1, 1, 1, 3, 3, 3, 3, 1]))],
      bit: 1,
    });
    expect(flags[3 * 4 + 0]).toBe(1); // (0.5, 0.5) inside the ring, outside the hole
    expect(flags[2 * 4 + 1]).toBe(0); // (1.5, 1.5) inside the hole
    expect(flags[0 * 4 + 3]).toBe(1); // (3.5, 3.5) inside the ring, outside the hole
  });

  it('clips a polygon that runs off the study extent', () => {
    const flags = rasterizeFlood({
      cols: 4,
      rows: 4,
      extent,
      polygons: [polygon(loop([-2, -2, 6, -2, 6, 6, -2, 6]))],
      bit: 1,
    });
    expect(flags.every((f) => f === 1)).toBe(true);
  });

  it('sets only the bit it was given', () => {
    const flags = rasterizeFlood({
      cols: 4,
      rows: 4,
      extent,
      polygons: [polygon(loop([0, 0, 4, 0, 4, 4, 0, 4]))],
      bit: 4,
    });
    expect(flags[0]).toBe(4);
    expect(flags[0] & 1).toBe(0);
  });

  it('rejects a bit outside the three thresholds instead of writing a fourth', () => {
    // A stray fourth bit would corrupt every scenario packed after it, and
    // nothing downstream would notice.
    expect(() =>
      rasterizeFlood({
        cols: 4,
        rows: 4,
        extent,
        polygons: [polygon(loop([0, 0, 4, 0, 4, 4, 0, 4]))],
        bit: 8,
      }),
    ).toThrow();
  });

  it('returns an empty grid when given nothing to draw', () => {
    const flags = rasterizeFlood({ cols: 4, rows: 4, extent, polygons: [], bit: 1 });
    expect(flags).toHaveLength(16);
    expect(flags.every((f) => f === 0)).toBe(true);
  });
});

describe('packFloodFlags', () => {
  it('stores every cell in three bits', () => {
    const flags = Uint8Array.from([7, 1, 0, 5, 3, 2, 4, 6, 0, 0]);
    const packed = packFloodFlags(flags);
    expect(packed).toHaveLength(Math.ceil((flags.length * FLOOD_THRESHOLD_COUNT) / 8));
    expect(unpackFloodFlags(packed, flags.length)).toEqual(flags);
  });

  it('round-trips the real grid size', () => {
    // 643 x 746 at three bits is 179,880 bytes per scenario — the number the
    // payload budget is measured against (RISK-008).
    const flags = new Uint8Array(643 * 746);
    for (let i = 0; i < flags.length; i += 1) flags[i] = i % 8;
    const packed = packFloodFlags(flags);
    expect(packed).toHaveLength(179880);
    // A cell-by-cell deep compare of 480k elements is what made this test
    // take five seconds; a checksum plus a few spot checks proves the same
    // thing for a round trip.
    expect(checksum(unpackFloodFlags(packed, flags.length))).toBe(checksum(flags));
    expect(unpackFloodFlags(packed, flags.length)[643 * 746 - 1]).toBe(
      flags[flags.length - 1],
    );
    expect(unpackFloodFlags(packed, flags.length)[0]).toBe(flags[0]);
  });

  it('refuses to pack a cell carrying a fourth threshold bit', () => {
    // Masking it off would hide the bug that produced it.
    expect(() => packFloodFlags(Uint8Array.from([0b11111111]))).toThrow(/threshold/i);
  });
});
