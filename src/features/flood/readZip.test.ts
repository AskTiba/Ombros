import { deflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { readZipEntry } from './readZip';

/**
 * Builds a real single-entry ZIP — end-of-central-directory, central directory
 * record and local file header, in that layout — compressed with deflate.
 *
 * Written by hand rather than by a library so the reader is exercised against
 * the structure it has to parse in the wild, not against its own inverse.
 */
function buildZip(name: string, contents: Uint8Array, store = false): Uint8Array {
  const payload = store ? Buffer.from(contents) : deflateRawSync(Buffer.from(contents));
  const nameBytes = Buffer.from(name, 'utf8');
  const method = store ? 0 : 8;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(contents.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(contents.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);

  const localBlock = Buffer.concat([local, nameBytes, payload]);
  const centralBlock = Buffer.concat([central, nameBytes]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralBlock.length, 12);
  eocd.writeUInt32LE(localBlock.length, 16);
  eocd.writeUInt16LE(0, 20);

  return new Uint8Array(Buffer.concat([localBlock, centralBlock, eocd]));
}

const ENTRIES: Array<[string, string, boolean]> = [
  ['readme.html', '<html>hello</html>', false],
  ['data/flood_extents.gpkg', 'not really a gpkg', true],
];

describe('readZipEntry', () => {
  it.each(ENTRIES)('reads %s back byte for byte', (name, contents, store) => {
    const zip = buildZip(name, Buffer.from(contents), store);
    const read = readZipEntry(zip, name);
    expect(read).toEqual(Buffer.from(contents));
  });

  it('finds an entry in a nested path', () => {
    const zip = buildZip('a/b/c/d.txt', Buffer.from('deep'));
    expect(readZipEntry(zip, 'a/b/c/d.txt').toString()).toBe('deep');
  });

  it('reports a missing entry by name rather than throwing a bounds error', () => {
    const zip = buildZip('present.txt', Buffer.from('x'));
    expect(() => readZipEntry(zip, 'absent.txt')).toThrow(/absent\.txt/);
  });

  it('rejects a buffer that is not a zip', () => {
    expect(() => readZipEntry(new Uint8Array(64), 'anything')).toThrow(/zip/i);
  });

  it('rejects a truncated archive instead of reading past the end', () => {
    const zip = buildZip('x.txt', Buffer.from('hello'));
    expect(() => readZipEntry(zip.slice(0, 20), 'x.txt')).toThrow();
  });
});
