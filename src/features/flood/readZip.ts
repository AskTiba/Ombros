/**
 * The smallest ZIP reader that can pull one file out of an archive.
 *
 * The McClean et al. (2021) package is published as a `.zip` containing a
 * GeoPackage, and Node has no built-in ZIP support. The alternatives were all
 * worse: shelling out to `unzip` assumes a binary that is not on every
 * developer's machine, and `python3` is no more guaranteed. This is the
 * archive format's three fixed structures, read straight — end of central
 * directory, central directory record, local file header — which is less code
 * than the dependency it replaces.
 *
 * It deliberately does not write, does not handle ZIP64, and does not read
 * from disk: the fetch script downloads into memory and needs one entry.
 */

import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

const u16 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] | (bytes[offset + 1] << 8);

const u32 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>>
  0;

const badZip = (message: string): never => {
  throw new Error(`Not a readable zip: ${message}`);
};

/**
 * Extracts one entry from an in-memory ZIP archive.
 *
 * @throws if the buffer is not a ZIP, is truncated, or does not contain `name`.
 */
export function readZipEntry(archive: Uint8Array, name: string): Buffer {
  // The end-of-central-directory record is the last thing in the file, found
  // by scanning backwards for its signature (max comment length is 64KB).
  const eocd = findEocd(archive);
  const centralOffset = u32(archive, eocd + 16);
  const entryCount = u16(archive, eocd + 10);

  let cursor = centralOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (cursor + 46 > archive.length) badZip('central directory is truncated');
    if (u32(archive, cursor) !== CENTRAL_SIGNATURE)
      badZip('bad central directory record');

    const method = u16(archive, cursor + 10);
    const compressedSize = u32(archive, cursor + 20);
    const nameLength = u16(archive, cursor + 28);
    const extraLength = u16(archive, cursor + 30);
    const commentLength = u16(archive, cursor + 32);
    const localOffset = u32(archive, cursor + 42);

    // Copy before handing to Buffer: `subarray` views stay `ArrayBufferLike`,
    // which Buffer's overloads reject.
    const entryName = new TextDecoder().decode(
      archive.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    if (entryName === name) {
      return readLocal(archive, localOffset, method, compressedSize);
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`Zip entry not found: ${name}`);
}

function findEocd(archive: Uint8Array): number {
  if (archive.length < 22) badZip('shorter than an end-of-directory record');
  const lowest = Math.max(0, archive.length - 22 - 0xffff);
  for (let i = archive.length - 22; i >= lowest; i -= 1) {
    if (u32(archive, i) === EOCD_SIGNATURE) return i;
  }
  return badZip('no end-of-directory record');
}

function readLocal(
  archive: Uint8Array,
  offset: number,
  method: number,
  compressedSize: number,
): Buffer {
  if (offset + 30 > archive.length) badZip('local header is truncated');
  if (u32(archive, offset) !== LOCAL_SIGNATURE) badZip('bad local file header');

  const nameLength = u16(archive, offset + 26);
  const extraLength = u16(archive, offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const end = start + compressedSize;
  if (end > archive.length) badZip('entry data runs past the end of the archive');

  const payload = Buffer.from(new Uint8Array(archive.subarray(start, end)));
  if (method === 0) return payload;
  if (method !== 8) badZip(`unsupported compression method ${method}`);
  return inflateRawSync(payload);
}
