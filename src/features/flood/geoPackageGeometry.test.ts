import { describe, expect, it } from 'vitest';

import { readGeoPackagePolygon } from './geoPackageGeometry';

/**
 * Builds a GeoPackage binary geometry blob around a WKB polygon.
 *
 * Header per the GeoPackage spec: `"GP"` magic, version, flags (bit 0 = byte
 * order of the header, bits 1–3 = envelope indicator), srs_id, then the
 * envelope. Indicator 1 means a 32-byte XY envelope follows the 8-byte
 * fixed part.
 */
function gpkgPolygon(rings: number[][]): Uint8Array {
  const wkbParts: Buffer[] = [];
  wkbParts.push(Buffer.from([1])); // little-endian
  wkbParts.push(Buffer.from([3, 0, 0, 0])); // wkbPolygon
  wkbParts.push(Buffer.from([rings.length, 0, 0, 0]));
  for (const ring of rings) {
    wkbParts.push(Buffer.from([ring.length / 2, 0, 0, 0]));
    for (let i = 0; i < ring.length; i += 2) {
      const point = Buffer.alloc(16);
      point.writeDoubleLE(ring[i], 0);
      point.writeDoubleLE(ring[i + 1], 8);
      wkbParts.push(point);
    }
  }
  const wkb = Buffer.concat(wkbParts);

  let minx = Infinity;
  let maxx = -Infinity;
  let miny = Infinity;
  let maxy = -Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 2) {
      minx = Math.min(minx, ring[i]);
      maxx = Math.max(maxx, ring[i]);
      miny = Math.min(miny, ring[i + 1]);
      maxy = Math.max(maxy, ring[i + 1]);
    }
  }
  const envelope = Buffer.alloc(32);
  envelope.writeDoubleLE(minx, 0);
  envelope.writeDoubleLE(maxx, 8);
  envelope.writeDoubleLE(miny, 16);
  envelope.writeDoubleLE(maxy, 24);

  const header = Buffer.alloc(8);
  header.write('GP', 0, 'ascii');
  header[2] = 0; // version
  header[3] = 3; // little-endian header + envelope indicator 1
  header.writeInt32LE(4326, 4);

  return new Uint8Array(Buffer.concat([header, envelope, wkb]));
}

const SQUARE = [
  [0, 0, 1, 0, 1, 1, 0, 1, 0, 0],
  [0.25, 0.25, 0.25, 0.75, 0.75, 0.75, 0.75, 0.25, 0.25, 0.25],
];

describe('readGeoPackagePolygon', () => {
  it('reads the exterior ring as flat x,y pairs', () => {
    const polygon = readGeoPackagePolygon(gpkgPolygon([[0, 0, 1, 0, 1, 1, 0, 1, 0, 0]]));
    expect(polygon.rings).toHaveLength(1);
    expect(Array.from(polygon.rings[0])).toEqual([0, 0, 1, 0, 1, 1, 0, 1, 0, 0]);
  });

  it('keeps holes as separate rings so they are not flooded', () => {
    // The source has 12,374 rings across 12,229 polygons — holes are rare but
    // real, and a rasterizer that merged rings would paint them as land.
    const polygon = readGeoPackagePolygon(gpkgPolygon(SQUARE));
    expect(polygon.rings).toHaveLength(2);
    expect(polygon.rings[1]).toHaveLength(10);
  });

  it('exposes the envelope without re-reading the ring vertices', () => {
    const polygon = readGeoPackagePolygon(gpkgPolygon(SQUARE));
    expect(polygon.envelope).toEqual({ minx: 0, maxx: 1, miny: 0, maxy: 1 });
  });

  it('rejects a blob that is not a GeoPackage geometry', () => {
    expect(() => readGeoPackagePolygon(new Uint8Array(64))).toThrow(/geo.?package/i);
  });

  it('rejects a geometry type it cannot rasterize', () => {
    // Every one of the 12,229 features is WKB type 3 (Polygon). Anything else
    // would silently drop features if allowed through.
    const bytes = gpkgPolygon([[0, 0, 1, 0, 1, 1, 0, 1, 0, 0]]);
    bytes[41] = 4; // wkbLineString — the type field, one byte past the byte-order flag
    expect(() => readGeoPackagePolygon(bytes)).toThrow(/polygon/i);
  });

  it('rejects a truncated blob instead of reading past the buffer', () => {
    const bytes = gpkgPolygon([[0, 0, 1, 0, 1, 1, 0, 1, 0, 0]]);
    expect(() => readGeoPackagePolygon(bytes.slice(0, 60))).toThrow();
  });
});
