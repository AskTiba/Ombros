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

/**
 * WGS84 ellipsoid.
 *
 * Deliberately not a sphere of mean radius. Over Kampala's extent a sphere
 * (R = 6,371,008.8m) is 125m too long north-south while being 21m too short
 * east-west — errors of opposite sign, so the two axes drift apart by ~146m
 * over 22km. The terrain mesh is built in metres (ADR-005) and this tool
 * reports distances and exposed population, so that much systematic error is a
 * correctness bug rather than a rounding concern.
 */
const WGS84_SEMI_MAJOR_AXIS_M = 6_378_137.0;
const WGS84_FLATTENING = 1 / 298.257223563;
const WGS84_ECCENTRICITY_SQUARED =
  2 * WGS84_FLATTENING - WGS84_FLATTENING * WGS84_FLATTENING;

const DEGREES_TO_RADIANS = Math.PI / 180;

const assertValidLatitude = (lat: number): void => {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`latitude must be a finite value in [-90, 90], received ${lat}`);
  }
};

/**
 * Metres per degree of latitude at `lat`, on the WGS84 meridian.
 *
 * Uses the meridional radius of curvature M(φ) = a(1−e²)/(1−e²sin²φ)^1.5.
 * Varies by only ~0.6% from pole to equator, so a city's extent can be scaled
 * with a single mid-latitude value.
 */
export const metresPerDegreeLatitude = (lat: number): number => {
  assertValidLatitude(lat);
  const sin = Math.sin(lat * DEGREES_TO_RADIANS);
  const meridionalRadius =
    (WGS84_SEMI_MAJOR_AXIS_M * (1 - WGS84_ECCENTRICITY_SQUARED)) /
    Math.pow(1 - WGS84_ECCENTRICITY_SQUARED * sin * sin, 1.5);
  return meridionalRadius * DEGREES_TO_RADIANS;
};

/**
 * Metres per degree of longitude at `lat`, on the WGS84 parallel.
 *
 * Uses the prime-vertical radius N(φ) = a/(1−e²sin²φ)^0.5, then contracts by
 * cos(φ). This is why the caller's latitude is required: a degree of longitude
 * is ~78.8km at 45° but ~111.3km at the equator, so a latitude-independent
 * constant would misplace everything by a third of a kilometre per degree.
 */
export const metresPerDegreeLongitude = (lat: number): number => {
  assertValidLatitude(lat);
  const radians = lat * DEGREES_TO_RADIANS;
  const sin = Math.sin(radians);
  const primeVerticalRadius =
    WGS84_SEMI_MAJOR_AXIS_M / Math.sqrt(1 - WGS84_ECCENTRICITY_SQUARED * sin * sin);
  return primeVerticalRadius * Math.cos(radians) * DEGREES_TO_RADIANS;
};

const KAMPALA_MID_LATITUDE = (KAMPALA_BOUNDS.north + KAMPALA_BOUNDS.south) / 2;

/** East-west span of the study extent in metres. */
export const boundsWidthMeters = (): number =>
  metresPerDegreeLongitude(KAMPALA_MID_LATITUDE) *
  (KAMPALA_BOUNDS.east - KAMPALA_BOUNDS.west);

/** North-south span of the study extent in metres. */
export const boundsHeightMeters = (): number =>
  metresPerDegreeLatitude(KAMPALA_MID_LATITUDE) *
  (KAMPALA_BOUNDS.north - KAMPALA_BOUNDS.south);

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
