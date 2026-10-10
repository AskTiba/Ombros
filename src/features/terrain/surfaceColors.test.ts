import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildHypsometricColors } from './hypsometric';
import {
  CONTOUR_LINE_HEX,
  TERRAIN_AMBIENT,
  WATER_SURFACE_HEX,
  buildSurfaceColors,
  shadeLandColor,
} from './surfaceColors';
import { WATER_MAX_ELEVATION_METERS } from './waterMask';

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

/** Midpoint of a flat surface's shade, which is exactly `sin(altitude)`. */
const FLAT_SHADE = Math.sin((45 * Math.PI) / 180);

const triples = (colors: Float32Array): [number, number, number][] => {
  const out: [number, number, number][] = [];
  for (let i = 0; i < colors.length; i += 3) {
    out.push([colors[i], colors[i + 1], colors[i + 2]]);
  }
  return out;
};

const expectClose = (actual: readonly number[], expected: readonly number[]) => {
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 5));
};

/** A 3×3 grid of one elevation: zero slope everywhere, so shade is constant. */
const flatGrid = (elevation: number): Float32Array => new Float32Array(9).fill(elevation);

const flatOptions = (elevation: number, min: number, max: number) => ({
  samples: flatGrid(elevation),
  rows: 3,
  cols: 3,
  cellXMeters: 30,
  cellZMeters: 30,
  minElevationMeters: min,
  maxElevationMeters: max,
});

describe('shadeLandColor', () => {
  const tint: readonly [number, number, number] = [0.6, 0.7, 0.5];

  it('leaves the tint untouched under full light', () => {
    expectClose(shadeLandColor(tint, 1), tint);
  });

  it('scales the tint to the ambient floor under no light', () => {
    expectClose(shadeLandColor(tint, 0), [
      tint[0] * TERRAIN_AMBIENT,
      tint[1] * TERRAIN_AMBIENT,
      tint[2] * TERRAIN_AMBIENT,
    ]);
  });

  it('keeps a hillshade within 0..1 from ever brightening the tint', () => {
    const lit = shadeLandColor(tint, 1);
    for (let i = 0; i < 3; i += 1) {
      expect(lit[i]).toBeGreaterThanOrEqual(0);
      expect(shadeLandColor(tint, 0)[i]).toBeLessThanOrEqual(lit[i]);
    }
    expect(shadeLandColor(tint, 0.5)[0]).toBeLessThan(shadeLandColor(tint, 0.9)[0]);
  });

  it('exposes an ambient floor between 0 and 1', () => {
    expect(TERRAIN_AMBIENT).toBeGreaterThan(0);
    expect(TERRAIN_AMBIENT).toBeLessThan(1);
  });
});

describe('buildSurfaceColors', () => {
  it('emits three floats per vertex, all inside 0..1', () => {
    const colors = buildSurfaceColors(flatOptions(1250, 1125.5, 1317.6));

    expect(colors).toHaveLength(9 * 3);
    for (const channel of colors) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it('paints flat ground below the water line the flat water colour', () => {
    const colors = buildSurfaceColors(flatOptions(1100, 1125.5, 1317.6));
    const [r, g, b] = triples(colors)[0];
    const value = Number.parseInt(WATER_SURFACE_HEX.slice(1), 16);

    // Linear, not the raw hex division. Three reads a vertex attribute as
    // already in its linear working space and encodes to sRGB once at output,
    // so writing the hex digits straight in would encode twice and put a
    // washed-out pastel on screen instead of `--color-water-200`.
    const linear = [16, 8, 0].map((shift) => {
      const encoded = ((value >> shift) & 255) / 255;
      return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
    });
    expectClose([r, g, b], linear);

    // Every water vertex carries the identical colour — no hillshade swept in.
    for (const triple of triples(colors)) expectClose(triple, [r, g, b]);
  });

  it('shades flat ground above the water line instead of flooding it', () => {
    const colors = buildSurfaceColors(flatOptions(1250, 1125.5, 1317.6));
    const tint = triples(buildHypsometricColors(flatGrid(1250), 1125.5, 1317.6));

    expectClose(triples(colors)[0], shadeLandColor(tint[0], FLAT_SHADE));
    expectClose(triples(colors)[8], shadeLandColor(tint[8], FLAT_SHADE));
  });

  it('darkens land relative to its unswept tint, so shading is actually doing work', () => {
    const raw = triples(buildHypsometricColors(flatGrid(1250), 1125.5, 1317.6));
    const composed = triples(buildSurfaceColors(flatOptions(1250, 1125.5, 1317.6)));

    for (let i = 0; i < composed.length; i += 1) {
      expect(composed[i][0]).toBeLessThan(raw[i][0]);
      expect(composed[i][1]).toBeLessThan(raw[i][1]);
      expect(composed[i][2]).toBeLessThan(raw[i][2]);
    }
  });

  it('splits land from water by elevation alone on an otherwise identical surface', () => {
    const water = buildSurfaceColors(
      flatOptions(WATER_MAX_ELEVATION_METERS - 1, 1100, 1300),
    );
    const land = buildSurfaceColors(
      flatOptions(WATER_MAX_ELEVATION_METERS + 1, 1100, 1300),
    );

    const [waterTriple] = triples(water);
    const [landTriple] = triples(land);
    for (let i = 0; i < 3; i += 1) {
      expect(landTriple[i]).not.toBeCloseTo(waterTriple[i], 3);
    }
  });

  it('stays finite and in range across both ends of the elevation band', () => {
    for (const elevation of [1125.5, 1317.6]) {
      const colors = buildSurfaceColors(flatOptions(elevation, 1125.5, 1317.6));
      for (const channel of colors) {
        expect(Number.isFinite(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });
});

/**
 * `--color-water-200` in `globals.css` is the source of truth for surface
 * water. jsdom cannot resolve a custom property into a material, so the hex is
 * restated here — this contract is what keeps the mesh and the token from
 * drifting apart, mirroring the terrain ramp contract in `hypsometric.test.ts`.
 */
describe('surface colour token contract', () => {
  const css = read('../../styles/globals.css');

  it('pins the water surface to --color-water-200', () => {
    expect(css).toContain(`--color-water-200: ${WATER_SURFACE_HEX};`);
  });

  it('pins the contour line to --color-terrain-contour', () => {
    expect(css).toContain(`--color-terrain-contour: ${CONTOUR_LINE_HEX};`);
  });
});
