import { describe, expect, it } from 'vitest';

import {
  FLOOD_BINARY_HEADER_BYTES,
  FLOOD_BINARY_MAGIC,
  FLOOD_RAINFALL_MM,
  FLOOD_THRESHOLDS_METERS,
  decodeFloodBinary,
  encodeFloodBinary,
  floodBinaryUrl,
} from './floodBinary';

const meta = {
  cols: 4,
  rows: 3,
  west: 32.511,
  south: 0.207,
  east: 32.684,
  north: 0.409,
  rainfallMm: 60,
  durationSeconds: 10800,
};

const flags = Uint8Array.from([1, 2, 4, 7, 0, 0, 5, 3, 6, 0, 1, 0]);

describe('floodBinary', () => {
  it('round-trips the metadata and every cell', () => {
    const decoded = decodeFloodBinary(encodeFloodBinary(meta, flags));
    expect(decoded.cols).toBe(meta.cols);
    expect(decoded.rows).toBe(meta.rows);
    expect(decoded.west).toBe(meta.west);
    expect(decoded.north).toBe(meta.north);
    expect(decoded.rainfallMm).toBe(60);
    expect(decoded.durationSeconds).toBe(10800);
    expect(decoded.flags).toEqual(flags);
  });

  it('stays at three bits per cell so the payload budget holds', () => {
    // The budget in RISK-008 is measured on real bytes, so the format is
    // pinned: 60 bytes of header plus ceil(cols*rows*3/8).
    const encoded = encodeFloodBinary(
      { ...meta, cols: 643, rows: 746 },
      new Uint8Array(643 * 746),
    );
    expect(encoded).toHaveLength(FLOOD_BINARY_HEADER_BYTES + 179880);
    expect(encoded.length).toBe(179940);
  });

  it('refuses a file that is not ours', () => {
    const bytes = encodeFloodBinary(meta, flags);
    bytes[0] = 0x58;
    expect(() => decodeFloodBinary(bytes)).toThrow(/magic/i);
  });

  it('refuses a version it does not understand', () => {
    const bytes = encodeFloodBinary(meta, flags);
    new DataView(bytes.buffer).setUint32(4, 99, true);
    expect(() => decodeFloodBinary(bytes)).toThrow(/version/i);
  });

  it('refuses a payload too short for its own stated grid', () => {
    // A header claiming 643x746 over a stub payload would otherwise read
    // whatever followed it as flood data.
    const bytes = encodeFloodBinary(meta, flags);
    new DataView(bytes.buffer).setUint32(8, 643, true);
    new DataView(bytes.buffer).setUint32(12, 746, true);
    expect(() => decodeFloodBinary(bytes)).toThrow(/short/i);
  });

  it('refuses a file missing the three published thresholds', () => {
    const bytes = encodeFloodBinary(meta, flags);
    bytes[56] = 2;
    expect(() => decodeFloodBinary(bytes)).toThrow(/threshold/i);
  });

  it('refuses a header shorter than the header', () => {
    expect(() => decodeFloodBinary(new Uint8Array(10))).toThrow(/truncated/i);
  });

  it('names all five rainfall depths and three thresholds the study published', () => {
    expect([...FLOOD_RAINFALL_MM]).toEqual([20, 40, 60, 80, 100]);
    expect([...FLOOD_THRESHOLDS_METERS]).toEqual([0.1, 0.2, 0.3]);
  });

  it('derives the URL from the scenario, not from a lookup table', () => {
    expect(floodBinaryUrl(60, 10800)).toBe('/data/kampala-flood-60-10800.bin');
  });

  it('produces the magic in the first four bytes', () => {
    const encoded = encodeFloodBinary(meta, flags);
    expect(new TextDecoder().decode(encoded.subarray(0, 4))).toBe(FLOOD_BINARY_MAGIC);
  });
});
