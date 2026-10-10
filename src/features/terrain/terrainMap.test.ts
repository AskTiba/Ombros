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

describe('renderTerrainMap with a flood raster', () => {
  it('paints flooded cells with the flood colour rather than the terrain', () => {
    const grid = rampGrid();
    const dry = renderTerrainMap(grid, 32);
    const flags = new Uint8Array(grid.samples.length).fill(1);
    const wet = renderTerrainMap(grid, 32, flags);

    const distinct = new Set<string>();
    for (let i = 0; i < wet.data.length; i += 4) {
      distinct.add(`${wet.data[i]},${wet.data[i + 1]},${wet.data[i + 2]}`);
    }
    // A whole-canvas flood must not reproduce the dry palette pixel for pixel.
    const dryColours = new Set<string>();
    for (let i = 0; i < dry.data.length; i += 4) {
      dryColours.add(`${dry.data[i]},${dry.data[i + 1]},${dry.data[i + 2]}`);
    }
    expect([...distinct].some((c) => !dryColours.has(c))).toBe(true);
  });

  it('lets the deepest class win, so the bands stack instead of overwriting', () => {
    const grid = rampGrid();
    const flags = new Uint8Array(grid.samples.length);
    flags[0] = 0b001;
    flags[1] = 0b011;
    flags[2] = 0b111;
    const map = renderTerrainMap(grid, 32, flags);

    const at = (index: number) => {
      const row = Math.floor(index / grid.cols);
      const col = index % grid.cols;
      // Map the source cell into output pixels the same way the renderer does.
      const x = Math.floor((col + 0.5) * (map.width / grid.cols));
      const y = Math.floor((row + 0.5) * (map.height / grid.rows));
      const i = (y * map.width + x) * 4;
      return [map.data[i], map.data[i + 1], map.data[i + 2]].join(',');
    };

    expect(at(0)).not.toBe(at(2));
    expect(at(1)).not.toBe(at(2));
  });

  it('reports the share of the city in each depth class', () => {
    // The legend has to be able to say how much of the study area each band
    // covers — a colour with no quantity is decoration.
    const grid = rampGrid();
    const flags = new Uint8Array(grid.samples.length);
    for (let i = 0; i < flags.length; i += 4) flags[i] = 1;
    for (let i = 0; i < flags.length; i += 100) flags[i] = 4;

    const shares = renderTerrainMap(grid, 32, flags).floodClassShares;
    expect(shares[0] + shares[1] + shares[2]).toBeGreaterThan(0.2);
    expect(shares[0]).toBeGreaterThan(0.1);
    expect(shares[2]).toBeGreaterThan(0);
  });

  it('reports nothing flooded when given no raster', () => {
    expect(renderTerrainMap(rampGrid(), 32).floodClassShares).toEqual([0, 0, 0]);
  });

  it('ignores a raster built on a different grid rather than misreading it', () => {
    // The loader rejects this case; refusing to paint is the belt to that
    // braces, and stops a short buffer walking off its end.
    const grid = rampGrid();
    const short = new Uint8Array(3);
    expect(() => renderTerrainMap(grid, 32, short)).not.toThrow();
    expect(renderTerrainMap(grid, 32, short).floodClassShares).toEqual([0, 0, 0]);
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
