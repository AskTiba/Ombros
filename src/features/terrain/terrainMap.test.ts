import { describe, expect, it } from 'vitest';

import { rampGrid } from '@/test/demBinaryFixture';

import {
  HYPSON_SUMMIT_HEX,
  HYPSON_VALLEY_HEX,
  hexToLinearRgb,
  linearToSrgb,
} from './hypsometric';
import { WATER_SURFACE_HEX } from './surfaceColors';
import { renderTerrainMap, TERRAIN_MAP_MAX_WIDTH } from './terrainMap';

const byte = (hex: string, channel: 0 | 1 | 2): number =>
  parseInt(hex.replace('#', '').slice(channel * 2, channel * 2 + 2), 16);

describe('linearToSrgb', () => {
  it('undoes the sRGB decode that produced the linear ramp', () => {
    // The tint constants are stored linearised for the GPU. Turning them back
    // must land on the hex they were declared with, or the 2D map and the 3D
    // scene would show two different terrains from the same maths.
    for (const hex of [HYPSON_VALLEY_HEX, HYPSON_SUMMIT_HEX, WATER_SURFACE_HEX]) {
      const linear = hexToLinearRgb(hex);
      const channels: Array<0 | 1 | 2> = [0, 1, 2];
      for (const c of channels) {
        const back = Math.round(linearToSrgb(linear[c]) * 255);
        expect(Math.abs(back - byte(hex, c))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('uses the sRGB transfer curve, not a bare gamma 2.2', () => {
    // The knee sits at 0.0031308 on the linear side; below it the curve is a
    // straight line of slope 12.92. A naive pow(1/2.2) would be visibly wrong
    // in the dark end, which is exactly where the valley tint lives.
    expect(linearToSrgb(0)).toBe(0);
    expect(linearToSrgb(1)).toBeCloseTo(1, 6);
    expect(linearToSrgb(0.0031308)).toBeCloseTo(0.0031308 * 12.92, 6);
  });
});

describe('renderTerrainMap', () => {
  it('follows the study extent proportions instead of forcing a square', () => {
    // A stretched canvas misrepresents the study area — the same class of
    // error as a mislabelled scale bar.
    const grid = rampGrid(); // 90m x 60m
    const map = renderTerrainMap(grid, 90);
    expect(map.width).toBe(90);
    expect(map.height).toBe(60);
  });

  it('draws the real study extent taller than it is wide', () => {
    // Kampala is 19.3km x 22.3km; the previous placeholder drew a 3:2 box.
    const extent = { ...rampGrid(), widthMeters: 19258, depthMeters: 22336 };
    const map = renderTerrainMap(extent, TERRAIN_MAP_MAX_WIDTH);
    expect(map.width).toBe(TERRAIN_MAP_MAX_WIDTH);
    expect(map.height).toBeGreaterThan(map.width);
  });

  it('never draws a transparent pixel', () => {
    const map = renderTerrainMap(rampGrid(), 64);
    for (let i = 3; i < map.data.length; i += 4) {
      expect(map.data[i]).toBe(255);
    }
  });

  it('paints the water samples with the exact water colour', () => {
    const map = renderTerrainMap(waterGrid(), 32);
    const expected = [0, 1, 2]
      .map((c) => byte(WATER_SURFACE_HEX, c as 0 | 1 | 2))
      .join(',');
    const colours = new Set<string>();
    for (let i = 0; i < map.data.length; i += 4) {
      colours.add(`${map.data[i]},${map.data[i + 1]},${map.data[i + 2]}`);
    }
    expect(colours.has(expected)).toBe(true);
  });

  it('keeps land and water visually distinct', () => {
    const map = renderTerrainMap(waterGrid(), 32);
    const colours = new Set<string>();
    for (let i = 0; i < map.data.length; i += 4) {
      colours.add(`${map.data[i]},${map.data[i + 1]},${map.data[i + 2]}`);
    }
    expect(colours.size).toBeGreaterThan(2);
  });

  it('reports how much of the extent is water, for the text alternative', () => {
    // The accessible description has to be able to say something quantitative,
    // and how much of the city is wet is the one number a flood tool cannot omit.
    const wet = renderTerrainMap(waterGrid(), 32).waterShare;
    expect(wet).toBeGreaterThan(0.4);
    expect(wet).toBeLessThan(0.6);
    expect(renderTerrainMap(rampGrid(), 32).waterShare).toBe(0);
  });

  it('carries the DEM band through so the caption can quote it', () => {
    const map = renderTerrainMap(rampGrid(), 32);
    expect(map.minElevationMeters).toBe(1100);
    expect(map.maxElevationMeters).toBe(1210);
  });

  it('collapses to a single pixel when asked for one', () => {
    // Guards the nearest-neighbour sampling against an off-by-one that would
    // read past the end of a 1x1 output.
    const map = renderTerrainMap(rampGrid(), 1);
    expect(map.data).toHaveLength(4);
    expect(map.data[3]).toBe(255);
  });
});

/**
 * A grid whose northern half is flat and low, so the water test flags it and
 * the southern half — equally flat, but high — stays land. Half wet is a
 * known answer, which is the point.
 */
function waterGrid() {
  const cols = 16;
  const rows = 16;
  const samples = new Float32Array(rows * cols);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      samples[row * cols + col] = row < rows / 2 ? 1120 : 1200;
    }
  }
  return {
    samples,
    rows,
    cols,
    widthMeters: 450,
    depthMeters: 450,
    minElevationMeters: 1120,
    maxElevationMeters: 1200,
  };
}
