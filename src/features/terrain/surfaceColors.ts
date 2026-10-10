import { buildHillshade } from './hillshade';
import {
  buildHypsometricColors,
  hexToLinearRgb,
  type NormalizedRgb,
} from './hypsometric';
import { buildWaterMask } from './waterMask';

/**
 * Final per-vertex colour of the terrain: hypsometric tint × hillshade, with
 * water overriding both.
 *
 * ## Why compose rather than light with a lamp
 *
 * The scene's original shading came from `ambientLight` + `directionalLight`,
 * which is the right answer for a shaded *object* and the wrong one for a
 * *map*. A lit mesh asks the viewer to interpret a photograph; a cartographic
 * hillshade is a reading convention they already know from every printed
 * terrain map, and it lets a single unlit material carry the whole look with
 * no per-pixel lighting cost. It also survives `OrbitControls`: the light is
 * baked into the surface, so dragging the camera never re-lights the terrain
 * into an unrelated sun angle.
 *
 * ## The composition
 *
 *     land   = tint × (ambient + (1 − ambient) × hillshade)
 *     water  = flat water colour, unswept
 *
 * Multiplying is the standard cartographic combination — the tint carries
 * elevation (low ground dark, high ground light) and the hillshade carries
 * slope (sun-facing bright, away-facing dark) — two independent cues layered
 * into one number, which is what makes gentle relief readable on a band only
 * 192m deep.
 *
 * ## The ambient floor
 *
 * Without it, any surface angled away from the light collapses to black and
 * takes its elevation tint with it — the valleys stop being legible exactly
 * where the flood story lives. The floor caps how dark a shadow can get while
 * still letting lit slopes reach the untinted value. Pinned by test: under
 * full light the tint passes through untouched.
 *
 * ## Why water is not shaded
 *
 * Water here is either the lake or a wetland, both of which the mask already
 * judges flat. A flat surface produces one constant hillshade value, so
 * sweeping it would only darken the water uniformly and achieve nothing
 * except making it murkier. What actually distinguishes water from land to a
 * reader is *hue*, not brightness — so water gets the flat token colour and
 * every other cue stepped aside. It also means the wetland reads as water
 * rather than as valley-green, which is the whole point of the mask.
 *
 * Pure and renderer-free by the rule governing `heightfield.ts`: jsdom has no
 * WebGL, so colours that only exist inside a material could never be asserted.
 */

/** Share of the tint that survives even a fully unlit slope. */
export const TERRAIN_AMBIENT = 0.45;

/** Surface water, from `--color-water-200`. The hex is pinned to the token by test. */
export const WATER_SURFACE_HEX = '#4aa8c0';

/**
 * Surface water as a vertex colour, so it is **linear** — see
 * `hexToLinearRgb`. Three encodes it back to sRGB once at output, putting the
 * token on screen unchanged.
 */
export const WATER_SURFACE: NormalizedRgb = hexToLinearRgb(WATER_SURFACE_HEX);

/**
 * Contour lines, from `--color-terrain-contour`. Pinned to the token by test.
 *
 * Left as the CSS hex rather than linearised because it is handed to a
 * material's `color=` prop, which three encodes itself — unlike a vertex
 * attribute, where the conversion is ours to do.
 *
 * Light rather than the conventional dark brown on purpose: `hypsometric.ts`
 * pins the tint ramp's low stop to a dark green, and most of the study extent
 * sits at that end, so a dark line would land around 1.2:1 against the
 * majority of the surface — invisible on the flat ground the flood story is
 * actually about.
 */
export const CONTOUR_LINE_HEX = '#f0ead8';

/**
 * The cut face of the slab the terrain sits on, from `--color-terrain-slab`.
 * Pinned to the token by test.
 *
 * A warm stone-grey rather than a soil brown: the tint ramp already runs green
 * to khaki, so any green-leaning slab would blur into the valley it supports.
 * This sits outside both stops of the ramp in hue *and* in lightness, which is
 * what makes the terrain read as a specimen lifted out of the ground rather
 * than as a shape that simply stops.
 *
 * Like `WATER_SURFACE` this is linearised, because `slab.ts` writes it into a
 * vertex colour attribute rather than handing it to a material.
 */
export const SLAB_SURFACE_HEX = '#6f655a';

/**
 * Brightness the slab's floor keeps relative to its rim.
 *
 * The scene has no lights — the terrain's shading is baked per-vertex — so a
 * slab of one flat colour would render as a silhouette with no thickness at
 * all. A top-to-bottom falloff is camera-independent: it survives any orbit,
 * unlike a facing-based term that would need the light to follow the camera.
 * At 0.5 the floor lands near `rgb(85, 77, 68)` on screen, dark enough to read
 * as receding mass without crushing to black in the dark theme.
 */
export const SLAB_FLOOR_SHADE = 0.5;

/**
 * How much of a tint survives at a given hillshade value.
 *
 * A single scalar rather than three multiplies, so the composition exists in
 * exactly one place: `shadeLandColor` and `buildSurfaceColors` both route
 * through here, and neither can drift from the other. `buildSurfaceColors`
 * deliberately does not call `shadeLandColor`, because allocating a tuple per
 * vertex would mean 480,000 short-lived arrays on a full-resolution rebuild.
 */
const lightFactor = (hillshade: number): number => {
  const shade = hillshade < 0 ? 0 : hillshade > 1 ? 1 : hillshade;
  return TERRAIN_AMBIENT + (1 - TERRAIN_AMBIENT) * shade;
};

/**
 * Applies the hillshade to one hypsometric tint without flooding it.
 *
 * @param tint - the vertex's unswept elevation colour, 0..1 per channel.
 * @param hillshade - 0 (turned away) to 1 (facing the light).
 * @returns a new triplet, never brighter than `tint`.
 */
export function shadeLandColor(tint: NormalizedRgb, hillshade: number): NormalizedRgb {
  const factor = lightFactor(hillshade);
  return [tint[0] * factor, tint[1] * factor, tint[2] * factor];
}

export interface SurfaceColorOptions {
  /**
   * Elevation samples in metres, row-major (`row * cols + col`), row 0 north —
   * the same array `buildHeightfieldGeometry` consumed, so colour index equals
   * vertex index.
   */
  samples: Float32Array;
  rows: number;
  cols: number;
  cellXMeters: number;
  cellZMeters: number;
  /** Lower bound of the tint ramp. Pass the **original** DEM band, or a tier change re-tints the terrain mid-frame. */
  minElevationMeters: number;
  /** Upper bound of the tint ramp. */
  maxElevationMeters: number;
  /**
   * Precomputed `buildWaterMask` output, if the caller already has one.
   *
   * The mask is a full pass over the grid, so a renderer that needs the wet
   * fraction for a caption as well as the colours would otherwise pay for it
   * twice. Optional: the 3D rebuild path still computes it itself.
   */
  waterMask?: Uint8Array;
}

/**
 * Builds one RGB triplet per vertex: tint × hillshade on land, flat water
 * colour where the mask says water.
 *
 * @returns a `Float32Array` of `samples.length * 3`, every channel 0..1.
 */
export function buildSurfaceColors(options: SurfaceColorOptions): Float32Array {
  const {
    samples,
    rows,
    cols,
    cellXMeters,
    cellZMeters,
    minElevationMeters,
    maxElevationMeters,
  } = options;

  const tint = buildHypsometricColors(samples, minElevationMeters, maxElevationMeters);
  const shade = buildHillshade(samples, rows, cols, cellXMeters, cellZMeters);
  const water =
    options.waterMask ?? buildWaterMask(samples, rows, cols, cellXMeters, cellZMeters);

  const colors = new Float32Array(samples.length * 3);

  for (let i = 0; i < samples.length; i += 1) {
    const p = i * 3;
    if (water[i] === 1) {
      colors[p] = WATER_SURFACE[0];
      colors[p + 1] = WATER_SURFACE[1];
      colors[p + 2] = WATER_SURFACE[2];
    } else {
      const factor = lightFactor(shade[i]);
      colors[p] = tint[p] * factor;
      colors[p + 1] = tint[p + 1] * factor;
      colors[p + 2] = tint[p + 2] * factor;
    }
  }

  return colors;
}
