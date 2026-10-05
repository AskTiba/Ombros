import { describe, expect, it } from 'vitest';
import {
  boundsHeightMeters,
  boundsWidthMeters,
  containsLonLat,
  KAMPALA_BOUNDS,
  lonLatToNdc,
  metresPerDegreeLatitude,
  metresPerDegreeLongitude,
} from '@/lib/geo';

describe('geo', () => {
  describe('bounds dimensions', () => {
    it('reports a study area taller than it is wide', () => {
      // Kampala's published extent is ~0.202 deg N-S but only ~0.173 deg E-W.
      // Asserting the true relationship guards against a swapped bounds pair.
      expect(boundsHeightMeters()).toBeGreaterThan(boundsWidthMeters());
    });

    it('produces plausible metric dimensions for Kampala', () => {
      // The WGS84 extent is ~19.26km E-W by ~22.34km N-S.
      expect(boundsWidthMeters()).toBeGreaterThan(19_000);
      expect(boundsWidthMeters()).toBeLessThan(19_500);
      expect(boundsHeightMeters()).toBeGreaterThan(22_000);
      expect(boundsHeightMeters()).toBeLessThan(22_700);
    });

    it('does not inherit the sphere model error on the north-south axis', () => {
      // Guards a regression back to EARTH_RADIUS_M. That constant produced
      // 22,461m here — 125m too long. The value is pinned so the sphere
      // approximation cannot quietly return.
      expect(boundsHeightMeters()).toBeCloseTo(22_336.0, 0);
    });

    it('does not inherit the sphere model error on the east-west axis', () => {
      expect(boundsWidthMeters()).toBeCloseTo(19_258.0, 0);
    });
  });

  describe('metresPerDegree', () => {
    // Reference values from the WGS84 ellipsoid. A sphere of mean radius is
    // wrong by ~0.56% north-south and ~0.11% east-west over Kampala's extent,
    // and in opposite directions, so the two axes drift apart by ~146m over
    // 22km. That matters when the terrain grid is built in metres (ADR-005)
    // and distances are reported to planners.
    it('reports the correct metres per degree of latitude at the equator', () => {
      expect(metresPerDegreeLatitude(0)).toBeCloseTo(110_574.276, 2);
    });

    it('reports the correct metres per degree of latitude at Kampala', () => {
      expect(metresPerDegreeLatitude(0.308)).toBeCloseTo(110_574.34, 1);
    });

    it('reports the correct metres per degree of longitude at the equator', () => {
      expect(metresPerDegreeLongitude(0)).toBeCloseTo(111_319.491, 2);
    });

    it('reports the correct metres per degree of longitude at 45 degrees', () => {
      // The sphere model cannot express this: it is latitude-independent.
      expect(metresPerDegreeLongitude(45)).toBeCloseTo(78_846.835, 2);
    });

    it('contracts east-west metres per degree toward the poles', () => {
      expect(metresPerDegreeLongitude(0)).toBeGreaterThan(metresPerDegreeLongitude(30));
      expect(metresPerDegreeLongitude(30)).toBeGreaterThan(metresPerDegreeLongitude(60));
    });

    it('varies latitude metres per degree far less than longitude', () => {
      // Meridian radius is nearly constant over a city's extent; the parallel
      // radius shrinks with cos(lat). Only the longitude axis needs the
      // caller's latitude.
      const equator = metresPerDegreeLatitude(0);
      const kampala = metresPerDegreeLatitude(0.308);
      expect(Math.abs(kampala - equator) / equator).toBeLessThan(0.001);
    });

    it('rejects a latitude outside the valid range', () => {
      expect(() => metresPerDegreeLatitude(91)).toThrow(/latitude/);
      expect(() => metresPerDegreeLongitude(-91)).toThrow(/latitude/);
    });

    it('produces bounds dimensions that agree with the per-degree helpers', () => {
      const midLat = (KAMPALA_BOUNDS.north + KAMPALA_BOUNDS.south) / 2;
      const latSpan = KAMPALA_BOUNDS.north - KAMPALA_BOUNDS.south;
      const lonSpan = KAMPALA_BOUNDS.east - KAMPALA_BOUNDS.west;
      expect(boundsHeightMeters()).toBeCloseTo(
        metresPerDegreeLatitude(midLat) * latSpan,
        3,
      );
      expect(boundsWidthMeters()).toBeCloseTo(
        metresPerDegreeLongitude(midLat) * lonSpan,
        3,
      );
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
