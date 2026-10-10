/**
 * Orientation and scale readouts for the 3D scene.
 *
 * Pure arithmetic, deliberately free of three.js and of the DOM. Everything
 * here is a function of numbers the camera already knows, so it can be pinned
 * in CI — including the two conventions that are easy to get backwards and
 * impossible to spot once they are: which way the north arrow turns, and
 * whether the scale bar is measuring a line that the view angle foreshortens.
 */

/**
 * Screen rotation, in degrees, that puts north up for a given camera azimuth.
 *
 * `OrbitControls` measures azimuth from `+Z`, which this scene's coordinate
 * convention (ADR-005) makes south — so azimuth 0 already looks north and the
 * arrow stands still. Turning the camera east (+90°) leaves north to the right
 * of the screen, which is a clockwise rotation, so the sign is positive.
 *
 * Normalised to `[0, 360)` so the CSS property is stable frame to frame.
 */
export const northRotationDeg = (azimuthRadians: number): number => {
  const degrees = (azimuthRadians * 180) / Math.PI;
  const wrapped = ((degrees % 360) + 360) % 360;
  // `-0 % 360` is `-0`, which stringifies to "0" anyway but should not exist.
  return Object.is(wrapped, -0) ? 0 : wrapped;
};

/** Ground distances the scale bar may offer, in metres. */
export const SCALE_BAR_STEPS_METERS = [
  10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
] as const;

/**
 * Widest the scale bar may grow, in pixels, before a shorter step is used.
 *
 * The bar is an annotation in the corner of a busy scene: past ~140px it stops
 * being a glanceable cue and starts competing with the terrain.
 */
export const SCALE_BAR_MAX_WIDTH_PX = 140;

export interface MetresPerPixelOptions {
  /** Distance from the camera to its target, in model units (metres). */
  distanceMeters: number;
  /** Vertical field of view, in degrees. */
  verticalFovDegrees: number;
  /** Height of the drawing surface, in CSS pixels. */
  viewportHeightPx: number;
}

/**
 * Ground metres covered by one screen pixel.
 *
 * The scale bar runs across the screen — perpendicular to the view direction —
 * so the term that foreshortens a line running *into* the scene does not
 * apply, and the frustum height at the target distance is the whole answer.
 * That is what keeps a single number valid at any orbit angle, including
 * straight overhead.
 *
 * Note this measures the horizontal plane only. The scene exaggerates relief
 * vertically (ADR-005) and a horizontal bar must not inherit that.
 */
export const metresPerPixel = ({
  distanceMeters,
  verticalFovDegrees,
  viewportHeightPx,
}: MetresPerPixelOptions): number => {
  const halfFovRadians = (verticalFovDegrees * Math.PI) / 180 / 2;
  const frustumHeightMeters = 2 * distanceMeters * Math.tan(halfFovRadians);
  return frustumHeightMeters / viewportHeightPx;
};

/**
 * The longest rung of the ladder that still fits the width budget, so the bar
 * claims as many whole metres as it can without becoming the loudest thing on
 * screen. Falls back to the shortest rung when even that overflows — a bar
 * that is merely too long still tells you the scale, where no bar tells you
 * nothing.
 */
export const pickScaleBarMeters = (metresPerPixelValue: number): number => {
  let chosen: (typeof SCALE_BAR_STEPS_METERS)[number] = SCALE_BAR_STEPS_METERS[0];
  for (const step of SCALE_BAR_STEPS_METERS) {
    if (step / metresPerPixelValue <= SCALE_BAR_MAX_WIDTH_PX) chosen = step;
  }
  return chosen;
};

/** Three decimals is ~110m of latitude: finer than a 30m DEM can support. */
const COORDINATE_DECIMALS = 3;

// The hemisphere suffix carries the sign, so the magnitude is labelled —
// `-1.500°S` would be saying "south" twice and would not fit the overlay.
export const formatLatitude = (degrees: number): string =>
  `${Math.abs(degrees).toFixed(COORDINATE_DECIMALS)}°${degrees >= 0 ? 'N' : 'S'}`;

export const formatLongitude = (degrees: number): string =>
  `${Math.abs(degrees).toFixed(COORDINATE_DECIMALS)}°${degrees >= 0 ? 'E' : 'W'}`;

/** "2 km" for 2000, "500 m" for 500 — whole units only, never a decimal. */
export const formatScaleBarLabel = (meters: number): string =>
  meters >= 1000 && meters % 1000 === 0 ? `${meters / 1000} km` : `${meters} m`;

export interface SceneBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * The study extent the model is cut from, stated once on the overlay.
 *
 * A caption rather than four edge labels: the camera orbits, so a label pinned
 * to the top of the canvas would be claiming that edge is north for most of
 * the time it is on screen. The bounds themselves are true however you turn.
 */
export const sceneExtentCaption = (bounds: SceneBounds): string =>
  `${formatLatitude(bounds.south)}–${formatLatitude(bounds.north)}, ` +
  `${formatLongitude(bounds.west)}–${formatLongitude(bounds.east)}`;
