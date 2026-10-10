/**
 * Water / wetland mask — which samples of the DEM are standing water.
 *
 * ## Why this exists at all
 *
 * The rendered scene used to paint every elevation with the same hypsometric
 * ramp, so the ~33 km² of Lake Victoria, Murchison Bay and the Nakivubo
 * wetland system in the south-east corner of the extent were drawn as dark
 * green *land*, complete with hillshade relief across them. The single most
 * recognisable feature in the study area — the thing that makes Kampala
 * Kampala — was the one part of the model that read as nonsense.
 *
 * ## The discriminator, and why these two numbers
 *
 * Water is identified as **flat *and* low**. Neither term works alone:
 *
 * - Slope alone would paint any flat plain blue.
 * - Elevation alone would paint the sloping shore below 1,140m blue, which is
 *   110,731 samples — three times the actual water area.
 *
 * Measured against the shipped DEM before these constants were chosen:
 *
 * | elevation band | samples  | share below 0.10° |
 * | -------------- | -------- | ----------------- |
 * | 1,130–1,140 m  | 76,031   | **47.8%**         |
 * | 1,140–1,150 m  | 34,700   | 0.3%              |
 * | every band above | —      | ~0.0%             |
 *
 * 98.5% of *all* sub-0.10° samples in the grid sit at or below 1,140m, and
 * there is no flat ground anywhere above it — so the two terms together
 * separate water from shore with no overlap in either direction.
 *
 * Cross-checked against sources rather than inferred from the raster alone:
 * the ILEC World Lake Database records Lake Victoria at **1,134 m** with a
 * northern limit of **0°21′N**, against a measured median of **1,133.0 m** for
 * our flat region and `KAMPALA_BOUNDS.south` of 0.207°N. See the Pre-flight
 * Data Verification Log.
 *
 * The mask deliberately does **not** name individual wetlands — that would
 * need per-feature coordinates verified separately, and none are held.
 *
 * Pure and renderer-free, like everything else in this folder.
 */

import { buildSurfaceGradients } from './hillshade';

/**
 * Steepest ground still considered water.
 *
 * A water surface is level, so its slope is the DEM's own noise floor. 0.10°
 * over a 30m cell is 52mm of rise — above that, something is actually standing
 * up out of the water.
 */
export const WATER_MAX_SLOPE_DEG = 0.1;

/**
 * Highest elevation still considered water/wetland.
 *
 * Sits 6m above the 1,134m lake level to absorb geoid and quantisation spread,
 * and — decisively — 10m below the first band that contains any flat ground.
 */
export const WATER_MAX_ELEVATION_METERS = 1140;

/**
 * `tan(WATER_MAX_SLOPE_DEG)` squared, so a sample's gradient magnitude can be
 * tested without taking a square root or an arctangent.
 *
 * A gradient magnitude *is* `tan(slope)`, so `atan` is monotonic over the
 * positive range and the comparison is equivalent:
 *
 *     sqrt(gx² + gz²) ≤ tan(limit)   ⟺   gx² + gz² ≤ tan²(limit)
 *
 * Worth the algebra: measured on the shipped DEM at full resolution, the
 * `Math.hypot` + `Math.atan` form cost 357ms per rebuild against 37ms for the
 * entire hillshade, because both functions are slow library calls. This form
 * is a multiply and a compare. Rebuilds happen on every quality-tier change,
 * which is exactly when the frame budget is already under pressure.
 */
const WATER_MAX_SLOPE_TAN_SQUARED = Math.tan((WATER_MAX_SLOPE_DEG * Math.PI) / 180) ** 2;

/**
 * Flags each sample as water (1) or land (0).
 *
 * @param samples - row-major elevations in metres, row 0 north.
 * @param cellXMeters - east-west cell size in metres.
 * @param cellZMeters - north-south cell size in metres.
 * @returns a `Uint8Array` of `samples.length`, every entry 0 or 1.
 */
export function buildWaterMask(
  samples: Float32Array,
  rows: number,
  cols: number,
  cellXMeters: number,
  cellZMeters: number,
): Uint8Array {
  const { gradientsX, gradientsZ } = buildSurfaceGradients(
    samples,
    rows,
    cols,
    cellXMeters,
    cellZMeters,
  );

  const mask = new Uint8Array(samples.length);

  for (let i = 0; i < samples.length; i += 1) {
    const gradientX = gradientsX[i];
    const gradientZ = gradientsZ[i];
    const isFlat =
      gradientX * gradientX + gradientZ * gradientZ <= WATER_MAX_SLOPE_TAN_SQUARED;
    mask[i] = isFlat && samples[i] <= WATER_MAX_ELEVATION_METERS ? 1 : 0;
  }

  return mask;
}
