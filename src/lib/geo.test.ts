import { describe, expect, it } from 'vitest';
import {
  boundsHeightMeters,
  boundsWidthMeters,
  containsLonLat,
  KAMPALA_BOUNDS,
  lonLatToNdc,
} from '@/lib/geo';

describe('geo', () => {
  describe('bounds dimensions', () => {
    it('reports a study area taller than it is wide', () => {
      // Kampala's published extent is ~0.202 deg N-S but only ~0.173 deg E-W.
      // Asserting the true relationship guards against a swapped bounds pair.
      expect(boundsHeightMeters()).toBeGreaterThan(boundsWidthMeters());
    });

    it('produces plausible metric dimensions for Kampala', () => {
      // Rough sanity check: the bounds span roughly 19km E-W by 22km N-S.
      expect(boundsWidthMeters()).toBeGreaterThan(15_000);
      expect(boundsWidthMeters()).toBeLessThan(25_000);
      expect(boundsHeightMeters()).toBeGreaterThan(18_000);
      expect(boundsHeightMeters()).toBeLessThan(28_000);
    });
  });

  describe('lonLatToNdc', () => {
    it('maps the south-west corner to the NDC origin', () => {
      const ndc = lonLatToNdc({
        lon: KAMPALA_BOUNDS.west,
        lat: KAMPALA_BOUNDS.south,
      });
      expect(ndc.x).toBeCloseTo(-1, 10);
      expect(ndc.y).toBeCloseTo(-1, 10);
    });

    it('maps the north-east corner to the NDC far plane', () => {
      const ndc = lonLatToNdc({
        lon: KAMPALA_BOUNDS.east,
        lat: KAMPALA_BOUNDS.north,
      });
      expect(ndc.x).toBeCloseTo(1, 10);
      expect(ndc.y).toBeCloseTo(1, 10);
    });

    it('maps the bounds centre to the origin', () => {
      const ndc = lonLatToNdc({
        lon: (KAMPALA_BOUNDS.east + KAMPALA_BOUNDS.west) / 2,
        lat: (KAMPALA_BOUNDS.south + KAMPALA_BOUNDS.north) / 2,
      });
      expect(ndc.x).toBeCloseTo(0, 10);
      expect(ndc.y).toBeCloseTo(0, 10);
    });

    it('increases x eastward', () => {
      const west = lonLatToNdc({ lon: 32.55, lat: 0.3 });
      const east = lonLatToNdc({ lon: 32.65, lat: 0.3 });
      expect(east.x).toBeGreaterThan(west.x);
    });

    it('increases y northward so north maps to +1', () => {
      const south = lonLatToNdc({ lon: 32.6, lat: 0.25 });
      const north = lonLatToNdc({ lon: 32.6, lat: 0.35 });
      expect(north.y).toBeGreaterThan(south.y);
    });

    it('keeps every output inside NDC for in-bounds input', () => {
      const ndc = lonLatToNdc({ lon: 32.6, lat: 0.35 });
      expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1);
    });
  });

  describe('containsLonLat', () => {
    it('accepts a point inside Kampala', () => {
      expect(containsLonLat({ lon: 32.5825, lat: 0.3476 })).toBe(true);
    });

    it('accepts points on the boundary', () => {
      expect(
        containsLonLat({ lon: KAMPALA_BOUNDS.west, lat: KAMPALA_BOUNDS.south }),
      ).toBe(true);
    });

    it('rejects a point outside the study extent', () => {
      expect(containsLonLat({ lon: 36.8219, lat: -1.2921 })).toBe(false);
    });

    it('rejects a point north of the extent', () => {
      expect(containsLonLat({ lon: 32.6, lat: 0.5 })).toBe(false);
    });
  });
});
