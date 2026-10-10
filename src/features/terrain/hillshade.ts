/**
 * Analytic hillshade — cartographic shaded relief computed from the DEM.
 *
 * ## Why bake it instead of lighting the mesh
 *
 * The scene previously used one `directionalLight` over a `roughness 0.95`
 * material. That is a studio still-life rig: the shading depends on where the
 * camera orbits to, so turning the model changed how the terrain was lit and
 * the result read as a sculpted object rather than as a map. Real shaded-relief
 * cartography does the opposite — the sun is fixed at the **north-west**, by
 * long-standing convention, and the shading is a property of the *ground*, not
 * of the viewer. It also survives being rotated: a NW-lit hill still reads as a
 * hill from any angle.
 *
 * Baking into vertex colours is what makes an unlit material viable, so the
 * terrain needs no scene lights at all and the colour a planner sees is the
 * colour the data implies.
 *
 * ## The maths
 *
 * Surface normal for `y = f(x, z)` is `(-∂f/∂x, 1, -∂f/∂z)`, normalised. The
 * light is a unit vector from the surface toward the sun at compass azimuth
 * `az` and altitude `alt`:
 *
 *     L = (sin az · cos alt,  sin alt,  −cos az · cos alt)
 *
 * with **−cos az** because north is `-Z` in the model space of ADR-005. The
 * lambert term `dot(N, L)` is clamped to `0..1`.
 *
 * On flat ground `N = (0,1,0)`, so the value collapses to `sin(alt)` — that is
 * a testable invariant, and it is what the "flat ground" test asserts.
 *
 * Pure and renderer-free by the rule that governs `heightfield.ts`: jsdom has
 * no WebGL, so shading that only exists inside a material could never be unit
 * tested. This is data, and it stays here where it can be asserted.
 */

/** Compass azimuth of the light, degrees clockwise from north (cartographic NW). */
export const HILLSHADE_AZIMUTH_DEG = 315;

/** Sun elevation above the horizon, degrees. 45° is the shaded-relief standard. */
export const HILLSHADE_ALTITUDE_DEG = 45;

/**
 * East-west and north-south elevation gradients, in metres of rise per metre
 * of ground, one entry per sample.
 *
 * Central differences, clamped at the edges rather than skipped, so the border
 * rows and columns carry a real value instead of a default. Extracted because
 * `waterMask.ts` needs exactly this field: slope is the magnitude of it. One
 * definition of the derivative means hillshade and the water test cannot drift
 * apart into two subtly different terrains.
 */
export function buildSurfaceGradients(
  samples: Float32Array,
  rows: number,
  cols: number,
  cellXMeters: number,
  cellZMeters: number,
): { gradientsX: Float32Array; gradientsZ: Float32Array } {
  const gradientsX = new Float32Array(samples.length);
  const gradientsZ = new Float32Array(samples.length);

  for (let row = 0; row < rows; row += 1) {
    const rowUp = row > 0 ? row - 1 : row;
    const rowDown = row < rows - 1 ? row + 1 : row;
    const rowSpan = (rowDown - rowUp) * cellZMeters;

    for (let col = 0; col < cols; col += 1) {
      const colLeft = col > 0 ? col - 1 : col;
      const colRight = col < cols - 1 ? col + 1 : col;
      const colSpan = (colRight - colLeft) * cellXMeters;

      const index = row * cols + col;
      // A single-row or single-column grid has no span to differentiate across;
      // treat it as flat rather than dividing by zero.
      gradientsX[index] =
        colSpan > 0
          ? (samples[row * cols + colRight] - samples[row * cols + colLeft]) / colSpan
          : 0;
      gradientsZ[index] =
        rowSpan > 0
          ? (samples[rowDown * cols + col] - samples[rowUp * cols + col]) / rowSpan
          : 0;
    }
  }

  return { gradientsX, gradientsZ };
}

/**
 * Computes one shaded-relief value per sample.
 *
 * @param samples - row-major elevations in metres, row 0 north (the same array
 *   `buildHeightfieldGeometry` consumes, so index equals vertex index).
 * @param cellXMeters - east-west cell size; the gradient is per *metre*, so
 *   this is what keeps a non-square grid from being shaded as if it were.
 * @param cellZMeters - north-south cell size.
 * @returns one value in `0..1` per sample, `samples.length` long.
 */
export function buildHillshade(
  samples: Float32Array,
  rows: number,
  cols: number,
  cellXMeters: number,
  cellZMeters: number,
): Float32Array {
  const altitude = (HILLSHADE_ALTITUDE_DEG * Math.PI) / 180;
  const azimuth = (HILLSHADE_AZIMUTH_DEG * Math.PI) / 180;

  // Unit vector pointing from the ground toward the sun.
  const lightX = Math.sin(azimuth) * Math.cos(altitude);
  const lightY = Math.sin(altitude);
  const lightZ = -Math.cos(azimuth) * Math.cos(altitude);

  const { gradientsX, gradientsZ } = buildSurfaceGradients(
    samples,
    rows,
    cols,
    cellXMeters,
    cellZMeters,
  );
  const shade = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i += 1) {
    let normalX = -gradientsX[i];
    const normalY = 1;
    let normalZ = -gradientsZ[i];

    const length = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ);
    normalX /= length;
    normalZ /= length;

    const lambert = normalX * lightX + normalY * lightY + normalZ * lightZ;
    shade[i] = lambert < 0 ? 0 : lambert > 1 ? 1 : lambert;
  }

  return shade;
}
