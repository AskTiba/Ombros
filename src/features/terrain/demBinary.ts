/**
 * Binary format for the cached Kampala DEM.
 *
 * ## Why a custom format
 *
 * The terrain is Copernicus DEM GLO-30 at 30m, clipped to the published study
 * extent (ADR-004) and reprojected to metres (ADR-005, ADR-007). A 30m grid is
 * 643 × 746 = 479,678 samples:
 *
 * | payload  | size      |
 * | -------- | --------- |
 * | float32  | 1.83 MB   |
 * | uint16   | **0.92 MB** |
 *
 * uint16 halves the first-load payload against a ≤3MB budget that also has to
 * carry flood extents. It is safe because the observed elevation band is a few
 * hundred metres: the step is `range / 65535`, which on a 200m band is ~3mm —
 * two orders of magnitude below the 30m source resolution. Quantisation loss is
 * therefore never the reason a visual artefact appears, and no claim we make
 * depends on it (RISK-007).
 *
 * ## Format (little-endian)
 *
 * | offset | bytes | field                    |
 * | ------ | ----- | ------------------------ |
 * | 0      | 4     | magic `"OMBS"`           |
 * | 4      | 4     | version (uint32)         |
 * | 8      | 4     | cols (uint32)            |
 * | 12     | 4     | rows (uint32)            |
 * | 16     | 8     | widthMeters (float64)    |
 * | 24     | 8     | depthMeters (float64)    |
 * | 32     | 4     | minElevationMeters (f32) |
 * | 36     | 4     | maxElevationMeters (f32) |
 * | 40     | 4     | reserved (uint32)        |
 * | 44     | 4     | reserved (uint32)        |
 * | 48     | …     | payload: uint16 × rows×cols |
 *
 * The extent is stored in **metres**, not degrees, because the consumer builds
 * geometry in metres. The band is stored per file rather than fixed, so the
 * step adapts to whatever relief the DEM actually contains.
 *
 * The payload is row-major with row 0 at the **north** edge, matching
 * `buildHeightfieldGeometry` and matching raster row order (ADR-005).
 */

export const DEM_BINARY_MAGIC = 'OMBS';
export const DEM_BINARY_VERSION = 1;
export const DEM_BINARY_HEADER_BYTES = 48;

const MAX_QUANTISED_VALUE = 65_535;

/**
 * Band width at which the quantisation step would reach 1cm.
 *
 * Anything wider than this makes uint16 storage a real accuracy compromise
 * rather than a transparent one, and should prompt a uint32 payload instead.
 */
export const MAX_DEM_QUANTISATION_STEP_METERS = 0.01;

/**
 * A decoded DEM, in the exact shape `buildHeightfieldGeometry` consumes.
 *
 * Flattened rather than nested under `extent` so the value can be spread
 * straight into the builder's option object.
 */
export interface DemBinaryGrid {
  /** Row-major elevation samples in metres, row 0 at the north edge. */
  samples: Float32Array;
  rows: number;
  cols: number;
  /** East-west span in metres. */
  widthMeters: number;
  /** North-south span in metres. */
  depthMeters: number;
  /** Lowest elevation represented in the payload, in metres. */
  minElevationMeters: number;
  /** Highest elevation represented in the payload, in metres. */
  maxElevationMeters: number;
}

/**
 * Decodes a quantised DEM buffer into a heightfield grid.
 *
 * Pure and renderer-free: takes bytes, returns data. No `fetch`, no DOM, so it
 * is fully covered by unit tests in jsdom.
 *
 * Validates **structure** only — magic, version, dimensions, declared length,
 * extent, band. It deliberately does not re-check uniform cell size; that is
 * `buildHeightfieldGeometry`'s invariant (ADR-006), and asserting it twice
 * would mean two places to keep in sync.
 *
 * @throws if the buffer is not a recognised DEM, is truncated, or describes an
 * unusable grid. Every one of those would otherwise surface as a silently
 * corrupt terrain mesh instead of an error.
 */
export function readDemBinary(buffer: ArrayBuffer): DemBinaryGrid {
  if (buffer.byteLength < DEM_BINARY_HEADER_BYTES) {
    throw new Error(
      `DEM binary is truncated: ${buffer.byteLength} bytes is shorter than the ${DEM_BINARY_HEADER_BYTES}-byte header`,
    );
  }

  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== DEM_BINARY_MAGIC) {
    throw new Error(
      `DEM binary has bad magic "${magic}", expected "${DEM_BINARY_MAGIC}"`,
    );
  }

  const version = view.getUint32(4, true);
  if (version !== DEM_BINARY_VERSION) {
    throw new Error(
      `DEM binary has unsupported version ${version}, expected ${DEM_BINARY_VERSION}`,
    );
  }

  const cols = view.getUint32(8, true);
  const rows = view.getUint32(12, true);
  if (cols < 2 || rows < 2) {
    throw new Error(
      `DEM binary grid dimensions must both be at least 2, received ${cols} x ${rows}`,
    );
  }

  const widthMeters = view.getFloat64(16, true);
  const depthMeters = view.getFloat64(24, true);
  if (
    !Number.isFinite(widthMeters) ||
    !Number.isFinite(depthMeters) ||
    widthMeters <= 0 ||
    depthMeters <= 0
  ) {
    throw new Error(
      `DEM binary extent must be positive and finite, received ${widthMeters} x ${depthMeters}`,
    );
  }

  const minElevationMeters = view.getFloat32(32, true);
  const maxElevationMeters = view.getFloat32(36, true);
  if (!Number.isFinite(minElevationMeters) || !Number.isFinite(maxElevationMeters)) {
    throw new Error(
      `DEM binary elevation band must be finite, received ${minElevationMeters} to ${maxElevationMeters}`,
    );
  }
  if (maxElevationMeters < minElevationMeters) {
    throw new Error(
      `DEM binary elevation band is inverted: min ${minElevationMeters} exceeds max ${maxElevationMeters}`,
    );
  }

  const sampleCount = rows * cols;
  const declaredBytes = DEM_BINARY_HEADER_BYTES + sampleCount * 2;
  if (buffer.byteLength !== declaredBytes) {
    throw new Error(
      `DEM binary length mismatch: header declares ${sampleCount} samples (${declaredBytes} bytes) but buffer holds ${buffer.byteLength} bytes`,
    );
  }

  const range = maxElevationMeters - minElevationMeters;
  const samples = new Float32Array(sampleCount);
  const payload = new Uint16Array(buffer, DEM_BINARY_HEADER_BYTES);

  // No special case for a zero-width band is needed: `range` is 0, so every
  // product is 0 and every sample decodes to `minElevationMeters` exactly. An
  // explicit `range === 0` guard here would be dead code, and the flat-file
  // test pins the behaviour regardless.
  for (let i = 0; i < sampleCount; i += 1) {
    samples[i] = minElevationMeters + (payload[i] / MAX_QUANTISED_VALUE) * range;
  }

  return {
    samples,
    rows,
    cols,
    widthMeters,
    depthMeters,
    minElevationMeters,
    maxElevationMeters,
  };
}
