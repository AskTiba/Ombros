import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  HYPSON_SUMMIT,
  HYPSON_SUMMIT_HEX,
  HYPSON_VALLEY,
  HYPSON_VALLEY_HEX,
  buildHypsometricColors,
} from './hypsometric';

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const luminance = ([r, g, b]: readonly [number, number, number]) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

const triples = (colors: Float32Array): [number, number, number][] => {
  const out: [number, number, number][] = [];
  for (let i = 0; i < colors.length; i += 3) {
    out.push([colors[i], colors[i + 1], colors[i + 2]]);
  }
  return out;
};

// Stops round-trip through a Float32Array, so they cannot be compared with
// toEqual against the float64 hex division — only to within float32 precision.
const expectClose = (actual: readonly number[], expected: readonly number[]) => {
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 6));
};

describe('buildHypsometricColors', () => {
  it('emits three floats per vertex, all inside 0..1', () => {
    const samples = new Float32Array([1100, 1150, 1210]);

    const colors = buildHypsometricColors(samples, 1100, 1210);

    expect(colors).toHaveLength(samples.length * 3);
    for (const channel of colors) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it('maps the lowest elevation to the valley stop and the highest to the summit stop', () => {
    const samples = new Float32Array([1100, 1210]);

    const [low, high] = triples(buildHypsometricColors(samples, 1100, 1210));

    expectClose(low, HYPSON_VALLEY);
    expectClose(high, HYPSON_SUMMIT);
  });

  it('gets lighter as elevation rises, so relief reads without shading', () => {
    const samples = new Float32Array([1100, 1140, 1170, 1210]);

    const shades = triples(buildHypsometricColors(samples, 1100, 1210)).map(luminance);

    for (let i = 1; i < shades.length; i += 1) {
      expect(shades[i]).toBeGreaterThan(shades[i - 1]);
    }
  });

  it('degrades to a single flat colour on a zero-width band instead of dividing by zero', () => {
    const samples = new Float32Array([1200, 1200, 1200]);

    const colors = buildHypsometricColors(samples, 1200, 1200);
    const [first, second] = triples(colors);

    expectClose(first, HYPSON_VALLEY);
    expectClose(second, HYPSON_VALLEY);
    for (const channel of colors) {
      expect(Number.isFinite(channel)).toBe(true);
    }
  });
});

/**
 * The land does not retheme (ADR-014), so `--color-terrain-low` and
 * `--color-terrain-high` in `globals.css` are the source of truth for the
 * ramp. jsdom cannot resolve custom properties into a material, so the hex is
 * restated here — this contract is what keeps the mesh tint and the design
 * token from drifting apart.
 */
describe('terrain ramp token contract', () => {
  const css = read('../../styles/globals.css');

  it('pins the valley stop to --color-terrain-low', () => {
    expect(css).toContain(`--color-terrain-low: ${HYPSON_VALLEY_HEX};`);
  });

  it('pins the summit stop to --color-terrain-high', () => {
    expect(css).toContain(`--color-terrain-high: ${HYPSON_SUMMIT_HEX};`);
  });
});
