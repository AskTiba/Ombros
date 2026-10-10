import { BufferAttribute, BufferGeometry } from 'three';

/**
 * Terrain heightfield → `THREE.BufferGeometry`, with no renderer attached.
 *
 * ## Why this is a pure function
 *
 * jsdom has no WebGL context, so anything that reaches for `WebGLRenderer`
 * cannot be unit tested. Keeping geometry construction free of the renderer is
 * what lets the terrain — and, by the same rule, the flood surface and the
 * building extrusions — be verified attribute by attribute in CI. The renderer
 * boundary lives in the R3F component, never here.
 *
 * ## Coordinate space (ADR-005)
 *
 * Metres, Y-up, origin at the study-area centroid. Not normalised device
 * coordinates: the terrain has ~1,000m of relief across ~20km, so vertical
 * exaggeration is mandatory for the hills to be visible, and it has to be a
 * single disclosed number that can be stated in the UI and in the generated
 * risk report. In NDC that ratio would be entangled with the projection.
 *
 * - `+X` = east, `+Z` = south (north is `-Z`)
 * - vertex index = `row * cols + col`
 * - row 0 is the **northern** edge, matching image/raster row order
 *
 * Terrain is Copernicus DEM GLO-30 at 30m over the published study extent
 * (ADR-004). Flood extents are vector threshold classes, not depth rasters
 * (ADR-003, ERR-001) — so this module only ever claims elevation.
 */

export interface HeightfieldExtent {
  /** East-west span of the grid on the ground plane, in metres. */
  widthMeters: number;
  /** North-south span of the grid on the ground plane, in metres. */
  depthMeters: number;
}

export interface HeightfieldOptions {
  /**
   * Elevation samples in metres, row-major (`row * cols + col`), row 0 north.
   * Must be exactly `rows * cols` long and entirely finite.
   */
  samples: Float32Array;
  rows: number;
  cols: number;
  extent: HeightfieldExtent;
  /**
   * Multiplier applied to relief after the base shift. Defaults to 1 — no
   * hidden exaggeration. Call sites pass an explicit value and surface it.
   */
  verticalExaggeration?: number;
  /**
   * Subtracted before exaggeration so the model can sit near `y = 0`. True
   * elevations stay available in `samples` for the risk readout. Defaults to 0.
   */
  baseElevationMeters?: number;
}

/**
 * Permitted relative difference between the x and z cell sizes.
 *
 * Cell dims are derived as `round(extent / cell) + 1`, so integer rounding
 * always leaves a little drift. At the 30m Kampala grid (643 × 746) the drift
 * is ~0.05%; 0.5% absorbs that while still rejecting any grid that would
 * genuinely stretch the terrain north-south.
 */
export const MAX_CELL_SIZE_DRIFT = 0.005;

/** Largest vertex count addressable by a 16-bit index buffer. */
const MAX_UINT16_VERTICES = 65_536;

/**
 * Validates a grid before any geometry is built from it.
 *
 * Shared with `slab.ts`, which wraps the same grid into a solid: a slab built
 * from an invalid grid would corrupt the model in exactly the ways this guards
 * against, so it must not be a second, quieter copy of the same rules.
 *
 * @throws if rows/cols are not integers >= 2, the extent is not positive, the
 * cells are not uniform, the samples length disagrees with the dimensions, any
 * sample is non-finite, the exaggeration is not positive-finite, or the base
 * elevation is not finite.
 */
export const validateHeightfield = (
  options: HeightfieldOptions,
): Required<HeightfieldOptions> => {
  const {
    samples,
    rows,
    cols,
    extent,
    verticalExaggeration = 1,
    baseElevationMeters = 0,
  } = options;

  if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
    throw new Error(
      `heightfield rows and cols must be integers, received ${rows} x ${cols}`,
    );
  }
  if (rows < 2) {
    throw new Error(`heightfield needs at least 2 rows to form a quad, received ${rows}`);
  }
  if (cols < 2) {
    throw new Error(`heightfield needs at least 2 cols to form a quad, received ${cols}`);
  }

  const { widthMeters, depthMeters } = extent;
  if (
    !Number.isFinite(widthMeters) ||
    !Number.isFinite(depthMeters) ||
    widthMeters <= 0 ||
    depthMeters <= 0
  ) {
    throw new Error(
      `heightfield extent must be positive and finite, received ${widthMeters} x ${depthMeters}`,
    );
  }

  // Uniform cell size is the invariant that matters. The study extent is
  // ~19,258m E-W by ~22,336m N-S (ADR-007), so `rows === cols` would force two
  // different cell sizes and stretch the terrain north-south. Uniform cells
  // do not.
  const cellX = widthMeters / (cols - 1);
  const cellZ = depthMeters / (rows - 1);
  const drift = Math.abs(cellX - cellZ) / Math.max(cellX, cellZ);
  if (drift > MAX_CELL_SIZE_DRIFT) {
    throw new Error(
      `heightfield cells must be uniform, received ${cellX.toFixed(3)}m x ${cellZ.toFixed(3)}m`,
    );
  }

  if (samples.length !== rows * cols) {
    throw new Error(
      `heightfield samples length ${samples.length} does not match rows * cols ${rows * cols}`,
    );
  }
  for (let i = 0; i < samples.length; i += 1) {
    if (!Number.isFinite(samples[i])) {
      throw new Error(`heightfield sample ${i} is not finite`);
    }
  }

  if (!Number.isFinite(verticalExaggeration) || verticalExaggeration <= 0) {
    throw new Error(
      `heightfield verticalExaggeration must be a positive finite number, received ${verticalExaggeration}`,
    );
  }
  if (!Number.isFinite(baseElevationMeters)) {
    throw new Error(
      `heightfield baseElevationMeters must be a finite number, received ${baseElevationMeters}`,
    );
  }

  return { samples, rows, cols, extent, verticalExaggeration, baseElevationMeters };
};

/**
 * Builds an indexed terrain mesh from an elevation grid.
 *
 * @throws if the grid is degenerate, non-uniform, mis-sized, or contains a
 * non-finite elevation. Every one of those would otherwise surface as a
 * silently corrupt mesh rather than an error.
 */
export function buildHeightfieldGeometry(options: HeightfieldOptions): BufferGeometry {
  const { samples, rows, cols, extent, verticalExaggeration, baseElevationMeters } =
    validateHeightfield(options);

  const vertexCount = rows * cols;
  const lastCol = cols - 1;
  const lastRow = rows - 1;

  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  const halfWidth = extent.widthMeters / 2;
  const halfDepth = extent.depthMeters / 2;
  const stepX = extent.widthMeters / lastCol;
  const stepZ = extent.depthMeters / lastRow;

  for (let row = 0; row < rows; row += 1) {
    const z = -halfDepth + row * stepZ;
    // Three uploads textures with flipY = true, so v = 0 is the southern edge.
    const v = 1 - row / lastRow;
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const p = index * 3;
      positions[p] = -halfWidth + col * stepX;
      positions[p + 1] = (samples[index] - baseElevationMeters) * verticalExaggeration;
      positions[p + 2] = z;
      const t = index * 2;
      uvs[t] = col / lastCol;
      uvs[t + 1] = v;
    }
  }

  // A 30m grid over the study extent is 479,678 vertices. Writing those into a
  // Uint16Array wraps past index 65,535 and produces a corrupt mesh with no
  // error thrown anywhere, so the index width is chosen explicitly.
  const IndexArray = vertexCount > MAX_UINT16_VERTICES ? Uint32Array : Uint16Array;
  const indices = new IndexArray(lastRow * lastCol * 6);

  let cursor = 0;
  for (let row = 0; row < lastRow; row += 1) {
    for (let col = 0; col < lastCol; col += 1) {
      const a = row * cols + col;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      // Wound so the geometric normal points +Y, i.e. counter-clockwise seen
      // from above. Reversed winding renders terrain invisible from above
      // rather than failing loudly.
      indices[cursor] = a;
      indices[cursor + 1] = c;
      indices[cursor + 2] = b;
      indices[cursor + 3] = b;
      indices[cursor + 4] = c;
      indices[cursor + 5] = d;
      cursor += 6;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
