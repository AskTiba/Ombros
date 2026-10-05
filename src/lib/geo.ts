/**
 * Kampala spatial constants and geo helpers.
 *
 * Bounds are the published extent of the McClean et al. (2021) flood dataset
 * (NERC EIDC, DOI 10.5285/e53dea2e-cb25-4f0f-b5f9-937eecf15aff).
 */

export const KAMPALA_BOUNDS = {
  south: 0.207,
  west: 32.511,
  north: 0.409,
  east: 32.684,
} as const;

export interface LonLat {
  lon: number;
  lat: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export const boundsWidthMeters = (): number =>
  toRad(KAMPALA_BOUNDS.east - KAMPALA_BOUNDS.west) * EARTH_RADIUS_M;

export const boundsHeightMeters = (): number =>
  toRad(KAMPALA_BOUNDS.north - KAMPALA_BOUNDS.south) * EARTH_RADIUS_M;

/**
 * Normalized device coordinates for a lon/lat within the study bounds.
 * y is flipped so north maps to +1, matching WebGL NDC.
 */
export const lonLatToNdc = ({ lon, lat }: LonLat): { x: number; y: number } => ({
  x: ((lon - KAMPALA_BOUNDS.west) / (KAMPALA_BOUNDS.east - KAMPALA_BOUNDS.west)) * 2 - 1,
  y:
    ((lat - KAMPALA_BOUNDS.south) / (KAMPALA_BOUNDS.north - KAMPALA_BOUNDS.south)) * 2 -
    1,
});

export const containsLonLat = ({ lon, lat }: LonLat): boolean =>
  lon >= KAMPALA_BOUNDS.west &&
  lon <= KAMPALA_BOUNDS.east &&
  lat >= KAMPALA_BOUNDS.south &&
  lat <= KAMPALA_BOUNDS.north;
