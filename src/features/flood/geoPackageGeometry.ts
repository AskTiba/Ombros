/**
 * GeoPackage geometry blob → polygon rings.
 *
 * A GeoPackage stores geometry as an SQLite BLOB with a small binary header
 * followed by OGC WKB. SQLite itself is `node:sqlite`'s job in the fetch
 * script; everything *inside* the blob is parsed here, where it is pure,
 * dependency-free and testable.
 *
 * Only WKB type 3 (Polygon) is accepted. That is not an arbitrary restriction:
 * all 12,229 features in the McClean et al. (2021) package are polygons, and
 * silently letting a MultiPolygon through would drop every part after the
 * first — flooding the map with a fraction of the published extent and no
 * error to show for it.
 */

export interface GeoPackageEnvelope {
  minx: number;
  maxx: number;
  miny: number;
  maxy: number;
}

export interface GeoPackagePolygon {
  /**
   * Ring vertices as flat `[x0, y0, x1, y1, …]` in EPSG:4326.
   * Ring 0 is the exterior; later rings are holes.
   */
  rings: ReadonlyArray<Float64Array>;
  /** The envelope from the blob header, without re-reading the vertices. */
  envelope: GeoPackageEnvelope;
}

/** Envelope sizes in bytes, by GeoPackage envelope indicator (flags bits 1–3). */
const ENVELOPE_BYTES: Readonly<Record<number, number>> = {
  0: 0,
  1: 32,
  2: 48,
  3: 48,
  4: 64,
};

const fail = (message: string): never => {
  throw new Error(`Not a GeoPackage polygon geometry: ${message}`);
};

const need = (bytes: Uint8Array, end: number): void => {
  if (bytes.length < end) fail(`truncated blob (${bytes.length} bytes, need ${end})`);
};

/**
 * Reads one GeoPackage polygon blob.
 *
 * @throws if the blob is not a GeoPackage geometry, is truncated, or holds a
 *   geometry type other than Polygon.
 */
export function readGeoPackagePolygon(bytes: Uint8Array): GeoPackagePolygon {
  need(bytes, 8);
  if (bytes[0] !== 0x47 || bytes[1] !== 0x50) fail('missing the "GP" magic');

  // Bit 0 is the byte order of the header's own integers; bits 1–3 the
  // envelope indicator. Only little-endian is published, but branch rather
  // than assume.
  const flags = bytes[3];
  const little = (flags & 1) === 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const indicator = (flags >> 1) & 0x07;
  const envelopeBytes = ENVELOPE_BYTES[indicator];
  if (envelopeBytes === undefined) fail(`unknown envelope indicator ${indicator}`);
  const wkbStart = 8 + envelopeBytes;
  need(bytes, wkbStart + 9);

  const envelope: GeoPackageEnvelope = {
    minx: 0,
    maxx: 0,
    miny: 0,
    maxy: 0,
  };
  if (indicator >= 1) {
    envelope.minx = view.getFloat64(8, little);
    envelope.maxx = view.getFloat64(16, little);
    envelope.miny = view.getFloat64(24, little);
    envelope.maxy = view.getFloat64(32, little);
  }

  const wkbLittle = bytes[wkbStart] === 1;
  const wkbView = view;
  const wkbOffset = wkbStart;
  const type = wkbView.getUint32(wkbOffset + 1, wkbLittle);
  if (type !== 3) fail(`WKB type ${type} is not a Polygon`);

  const ringCount = wkbView.getUint32(wkbOffset + 5, wkbLittle);
  let cursor = wkbOffset + 9;
  const rings: Float64Array[] = [];

  for (let ring = 0; ring < ringCount; ring += 1) {
    need(bytes, cursor + 4);
    const pointCount = wkbView.getUint32(cursor, wkbLittle);
    cursor += 4;
    need(bytes, cursor + pointCount * 16);
    const coords = new Float64Array(pointCount * 2);
    for (let i = 0; i < pointCount; i += 1) {
      coords[i * 2] = wkbView.getFloat64(cursor, wkbLittle);
      coords[i * 2 + 1] = wkbView.getFloat64(cursor + 8, wkbLittle);
      cursor += 16;
    }
    rings.push(coords);
  }

  if (rings.length === 0) fail('polygon has no rings');
  return { rings, envelope };
}
