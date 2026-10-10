import { BufferAttribute, BufferGeometry } from 'three';
import { validateHeightfield, type HeightfieldOptions } from './heightfield';
import { hexToLinearRgb } from './hypsometric';
import { SLAB_FLOOR_SHADE, SLAB_SURFACE_HEX } from './surfaceColors';

/**
 * The terrain's cut slab — four walls and a floor that close the heightfield
 * into a solid object, with no renderer attached.
 *
 * ## Why the model needs a base
 *
 * The DEM is a surface, not a solid: without walls the terrain simply ends at
 * the study extent, which is what made it read as a shape floating on the page
 * rather than as a specimen lifted out of the ground. A cut face under every
 * edge turns the same data into an object with mass, and it gives the eye a
 * horizontal reference for how far the relief actually rises.
 *
 * ## Why a pure function
 *
 * Same rule as `heightfield.ts`: jsdom has no WebGL, so a slab that only exists
 * inside a material could never be asserted. The geometry is built here and
 * handed to the R3F component, which is the only place a renderer appears.
 *
 * ## Coordinate space (ADR-005)
 *
 * Shared with the heightfield, and it must be — the two are built from the same
 * grid and are drawn as one object. `+X` east, `+Z` south, row 0 north, and the
 * same base shift and exaggeration, so a wall top lands exactly on the terrain
 * vertex it descends from.
 *
 * ## The floor sits below the whole grid
 *
 * `floorY` is derived from the **global** minimum, not from the boundary. The
 * lake occupies the grid's interior, so a floor measured from the edge would
 * end up above the water and the terrain would poke through the bottom of its
 * own slab — visible as a hole the moment the camera drops to the horizon.
 *
 * ## Colour
 *
 * The scene has no lights: the terrain's shading is baked per-vertex, so the
 * slab has to bring its own. A single flat colour would render as a
 * silhouette, so each wall is shaded from `SLAB_SURFACE_HEX` at its rim down to
 * `SLAB_FLOOR_SHADE` of that at the floor. The falloff is vertical rather than
 * facing-based on purpose — a facing term needs a light, and a camera-locked
 * light would make the base change brightness as you orbit.
 *
 * Pure and renderer-free: no canvas, no `WebGLRenderer`, no scene object.
 */

/** How far the slab drops below the lowest sample of the grid, in true metres. */
export const SLAB_DEPTH_METERS = 50;

export interface SlabOptions extends HeightfieldOptions {
  /**
   * Slab thickness below the grid's lowest elevation, in true metres, scaled by
   * `verticalExaggeration` exactly as the terrain is. Defaults to
   * `SLAB_DEPTH_METERS`.
   */
  depthMeters?: number;
}

/**
 * Builds the slab that closes an elevation grid into a solid.
 *
 * @throws if the grid is invalid — same rules as `heightfield.ts`, shared
 * rather than reimplemented — or if `depthMeters` is not a positive finite
 * number. Either would otherwise surface as a corrupt or holed slab.
 */
export function buildSlabGeometry(options: SlabOptions): BufferGeometry {
  const { samples, rows, cols, extent, verticalExaggeration, baseElevationMeters } =
    validateHeightfield(options);

  const { depthMeters = SLAB_DEPTH_METERS } = options;
  if (!Number.isFinite(depthMeters) || depthMeters <= 0) {
    throw new Error(
      `slab depthMeters must be a positive finite number, received ${depthMeters}`,
    );
  }

  // `validateHeightfield` has already proven every sample finite, so a plain
  // scan is safe and costs one pass over the grid.
  let minElevation = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    if (samples[i] < minElevation) minElevation = samples[i];
  }
  const floorY =
    (minElevation - depthMeters - baseElevationMeters) * verticalExaggeration;

  const halfWidth = extent.widthMeters / 2;
  const halfDepth = extent.depthMeters / 2;
  const stepX = extent.widthMeters / (cols - 1);
  const stepZ = extent.depthMeters / (rows - 1);

  // Boundary sample indices walked N -> E -> S -> W so each corner is visited
  // exactly once. Length is 2*(rows + cols) - 4: one wall segment per boundary
  // edge, which is what keeps a non-square grid closed at all four sides.
  const loop: number[] = [];
  for (let col = 0; col < cols; col += 1) loop.push(col);
  for (let row = 1; row < rows; row += 1) loop.push(row * cols + (cols - 1));
  for (let col = cols - 2; col >= 0; col -= 1) loop.push((rows - 1) * cols + col);
  for (let row = rows - 2; row >= 1; row -= 1) loop.push(row * cols);

  const segments = loop.length;
  // Two rings (rim and floor) plus four dedicated corners for the floor face.
  const vertexCount = segments * 2 + 4;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  const [surfaceR, surfaceG, surfaceB] = hexToLinearRgb(SLAB_SURFACE_HEX);

  for (let i = 0; i < segments; i += 1) {
    const sample = loop[i];
    const row = Math.floor(sample / cols);
    const col = sample % cols;
    const x = -halfWidth + col * stepX;
    const z = -halfDepth + row * stepZ;
    const rimY = (samples[sample] - baseElevationMeters) * verticalExaggeration;

    // Vertical falloff across this wall's own height. The rim is always above
    // the floor by at least depthMeters * verticalExaggeration, so the
    // denominator cannot vanish.
    const span = rimY - floorY;
    const shadeAt = (y: number): number =>
      1 - ((rimY - y) / span) * (1 - SLAB_FLOOR_SHADE);

    const rim = i * 2 * 3;
    positions[rim] = x;
    positions[rim + 1] = rimY;
    positions[rim + 2] = z;
    const base = (i * 2 + 1) * 3;
    positions[base] = x;
    positions[base + 1] = floorY;
    positions[base + 2] = z;

    // Vertex colours are read as already-linear, so the sRGB token is encoded
    // once here — see `hypsometric.hexToLinearRgb`.
    const rimShade = shadeAt(rimY);
    colors[rim] = surfaceR * rimShade;
    colors[rim + 1] = surfaceG * rimShade;
    colors[rim + 2] = surfaceB * rimShade;

    const floorShade = shadeAt(floorY);
    colors[base] = surfaceR * floorShade;
    colors[base + 1] = surfaceG * floorShade;
    colors[base + 2] = surfaceB * floorShade;
  }

  // Four corners for the floor face, wound so its normal points -Y (down).
  const floorFace = segments * 2;
  const corners: readonly (readonly [number, number])[] = [
    [-halfWidth, -halfDepth], // north-west
    [halfWidth, -halfDepth], // north-east
    [halfWidth, halfDepth], // south-east
    [-halfWidth, halfDepth], // south-west
  ];
  for (let i = 0; i < corners.length; i += 1) {
    const p = (floorFace + i) * 3;
    positions[p] = corners[i][0];
    positions[p + 1] = floorY;
    positions[p + 2] = corners[i][1];
    colors[p] = surfaceR * SLAB_FLOOR_SHADE;
    colors[p + 1] = surfaceG * SLAB_FLOOR_SHADE;
    colors[p + 2] = surfaceB * SLAB_FLOOR_SHADE;
  }

  // Two triangles per wall segment plus two for the floor. Uint32 throughout:
  // the index count is O(rows + cols), so it cannot approach 65,536 for any
  // grid a DEM can produce, and WebGL2 addresses 32-bit indices natively —
  // which is what the scene already requires.
  const indices = new Uint32Array(segments * 6 + 6);
  let cursor = 0;
  for (let i = 0; i < segments; i += 1) {
    const rimA = i * 2;
    const rimB = ((i + 1) % segments) * 2;
    const floorA = rimA + 1;
    const floorB = rimB + 1;
    // A -> B -> C follows the N -> E -> S -> W walk, which winds each wall so
    // its normal faces away from the slab's centre.
    indices[cursor] = rimA;
    indices[cursor + 1] = rimB;
    indices[cursor + 2] = floorB;
    indices[cursor + 3] = rimA;
    indices[cursor + 4] = floorB;
    indices[cursor + 5] = floorA;
    cursor += 6;
  }
  indices[cursor] = floorFace;
  indices[cursor + 1] = floorFace + 1;
  indices[cursor + 2] = floorFace + 2;
  indices[cursor + 3] = floorFace;
  indices[cursor + 4] = floorFace + 2;
  indices[cursor + 5] = floorFace + 3;

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
