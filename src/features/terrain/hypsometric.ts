import { Color } from 'three';

/**
 * Elevation → RGB vertex tint for the terrain mesh — hypsometric colouring.
 *
 * ## Why colour as well as shading
 *
 * The study extent only has **192m** of relief (1,125.5m at the Lake Victoria
 * shoreline to 1,317.6m at Kololo Hill) across ~22km. Even with vertical
 * exaggeration, shading alone from a single light leaves gentle slopes reading
 * as a flat sheet, because a slope that turns a few degrees produces only a few
 * percent of lambertian falloff. Tinting vertices by elevation adds a second,
 * independent cue: low ground goes dark and high ground goes light, so the
 * hills read even where the light happens to graze them. Colour and shading
 * therefore disagree-proof each other.
 *
 * ## The ramp is a design token, not a scene decision (ADR-014)
 *
 * `--color-terrain-low` / `--color-terrain-high` in `globals.css` are the
 * source of truth and carry the note "the land does not retheme". Three.js
 * cannot read a CSS custom property into a material, so the hex is restated
 * here and `hypsometric.test.ts` pins the two together. Moving either one
 * without the other turns that test red.
 *
 * Pure and renderer-free by the same rule as `heightfield.ts`: jsdom has no
 * WebGL, so anything that needs a material cannot be unit tested. Mapping
 * samples to colours is data, and it stays here where it can be asserted
 * attribute by attribute.
 */

/** `[r, g, b]`, each normalised to 0..1 to match a `BufferAttribute` colour. */
export type NormalizedRgb = readonly [number, number, number];

/**
 * Lowest-elevation stop, from `--color-terrain-low`. Encoded at module load so
 * a colour is a plain number by the time geometry is built.
 */
export const HYPSON_VALLEY_HEX = '#4a7d68';

/** Highest-elevation stop, from `--color-terrain-high`. */
export const HYPSON_SUMMIT_HEX = '#ccd5a5';

/**
 * Parses a CSS hex into **linear** sRGB — the encoding a vertex colour
 * attribute has to hold.
 *
 * Three.js reads the numbers in a colour `BufferAttribute` as already living
 * in its linear working space, and encodes to sRGB exactly once, on the way
 * out to the screen. A raw hex division would therefore be encoded twice:
 * the token's 0.2902 arrives on screen as ~0.53, the ramp lifts toward white,
 * and the whole terrain flattens into pale pastel. Reaching for `THREE.Color`
 * rather than a hand-written transfer function means this tracks whatever the
 * renderer actually does, instead of drifting from it.
 *
 * This matters more than it looks. Material `color=` props need none of this —
 * three encodes those itself — so only vertex attributes come through here.
 *
 * Pure and renderer-free by the same rule as `heightfield.ts`: `Color` is a
 * value type, not a material, and jsdom has no WebGL either way.
 */
export const hexToLinearRgb = (hex: string): NormalizedRgb => {
  const color = new Color(hex);
  return [color.r, color.g, color.b];
};

export const HYPSON_VALLEY: NormalizedRgb = hexToLinearRgb(HYPSON_VALLEY_HEX);

export const HYPSON_SUMMIT: NormalizedRgb = hexToLinearRgb(HYPSON_SUMMIT_HEX);

/**
 * Builds one RGB triplet per sample, lerped from valley to summit by elevation.
 *
 * @param samples - row-major elevations in metres, exactly the array that
 *   `buildHeightfieldGeometry` consumed, so colour index equals vertex index.
 * @param minElevationMeters - lower bound of the ramp. Pass the **original**
 *   DEM band rather than a decimated grid's, or a quality-tier change would
 *   re-tint the whole terrain mid-frame.
 * @param maxElevationMeters - upper bound of the ramp.
 *
 * A zero-width band (every sample equal) resolves every vertex to the valley
 * stop rather than dividing by zero.
 */
export function buildHypsometricColors(
  samples: Float32Array,
  minElevationMeters: number,
  maxElevationMeters: number,
): Float32Array {
  const range = maxElevationMeters - minElevationMeters;
  const colors = new Float32Array(samples.length * 3);

  for (let i = 0; i < samples.length; i += 1) {
    const t = range === 0 ? 0 : (samples[i] - minElevationMeters) / range;
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    const p = i * 3;
    colors[p] = HYPSON_VALLEY[0] + (HYPSON_SUMMIT[0] - HYPSON_VALLEY[0]) * clamped;
    colors[p + 1] = HYPSON_VALLEY[1] + (HYPSON_SUMMIT[1] - HYPSON_VALLEY[1]) * clamped;
    colors[p + 2] = HYPSON_VALLEY[2] + (HYPSON_SUMMIT[2] - HYPSON_VALLEY[2]) * clamped;
  }

  return colors;
}
