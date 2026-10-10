import { describe, expect, it } from 'vitest';

import { KAMPALA_BOUNDS } from '@/lib/geo';
import {
  SCALE_BAR_MAX_WIDTH_PX,
  SCALE_BAR_STEPS_METERS,
  formatLatitude,
  formatLongitude,
  formatScaleBarLabel,
  metresPerPixel,
  northRotationDeg,
  pickScaleBarMeters,
  sceneExtentCaption,
} from '@/features/terrain/orientation';

/**
 * `metresPerPixel` with a vertical field of view of 90°, so `tan(fov/2) === 1`
 * and the frustum height at the target is exactly `2 * distance`. Height 100px
 * then divides cleanly.
 */
const HEAD_ON = { verticalFovDegrees: 90, viewportHeightPx: 100 };

describe('northRotationDeg', () => {
  it('leaves north up when the camera sits due south', () => {
    // OrbitControls measures azimuth from +Z, which is south. Looking north,
    // north is already up the screen, so the arrow must not turn.
    expect(northRotationDeg(0)).toBe(0);
  });

  it('turns clockwise as the camera swings east', () => {
    // Azimuth +90° puts the camera due east, looking west — and north is then
    // to the right of the screen. A clockwise rotation of the arrow matches.
    expect(northRotationDeg(Math.PI / 2)).toBeCloseTo(90, 6);
  });

  it('turns the other way when the camera swings west', () => {
    expect(northRotationDeg(-Math.PI / 2)).toBeCloseTo(270, 6);
  });

  it('wraps a full turn back to north-up', () => {
    expect(northRotationDeg(Math.PI * 2)).toBeCloseTo(0, 6);
    expect(northRotationDeg(Math.PI * 3)).toBeCloseTo(180, 6);
  });

  it('always returns a rotation a CSS transform accepts', () => {
    // A negative angle is valid CSS, but normalising keeps the property stable
    // across frames and avoids `-0`.
    for (const radians of [-7.9, -Math.PI, -0.001, 0, 6.3, 100]) {
      const degrees = northRotationDeg(radians);
      expect(degrees).toBeGreaterThanOrEqual(0);
      expect(degrees).toBeLessThan(360);
      expect(Object.is(degrees, -0)).toBe(false);
    }
  });
});

describe('metresPerPixel', () => {
  it('is the frustum height at the target divided by the viewport height', () => {
    // At 90° the frustum half-height equals the distance, so the full frustum
    // is 2 * distance metres over `viewportHeightPx` pixels.
    expect(metresPerPixel({ ...HEAD_ON, distanceMeters: 5000 })).toBeCloseTo(100, 6);
  });

  it('grows as the camera pulls back', () => {
    const near = metresPerPixel({ ...HEAD_ON, distanceMeters: 5000 });
    const far = metresPerPixel({ ...HEAD_ON, distanceMeters: 10000 });
    expect(far).toBeCloseTo(near * 2, 6);
  });

  it('shrinks on a taller viewport', () => {
    const short = metresPerPixel({ ...HEAD_ON, distanceMeters: 5000 });
    const tall = metresPerPixel({
      ...HEAD_ON,
      viewportHeightPx: 200,
      distanceMeters: 5000,
    });
    expect(tall).toBeCloseTo(short / 2, 6);
  });

  it('measures a horizontal line, so the view angle does not enter', () => {
    // The bar lies across the screen, perpendicular to the view direction, so
    // the foreshortening term that would apply to a line running *into* the
    // screen is absent. That is what keeps one number valid at any orbit.
    const steeper = metresPerPixel({
      verticalFovDegrees: 30,
      viewportHeightPx: 100,
      distanceMeters: 5000,
    });
    const shallower = metresPerPixel({
      verticalFovDegrees: 70,
      viewportHeightPx: 100,
      distanceMeters: 5000,
    });
    expect(steeper).toBeLessThan(shallower);
    expect(steeper).toBeCloseTo((2 * 5000 * Math.tan((15 * Math.PI) / 180)) / 100, 6);
  });
});

describe('pickScaleBarMeters', () => {
  it('offers a ladder of round ground distances', () => {
    expect(SCALE_BAR_STEPS_METERS[0]).toBeLessThan(
      SCALE_BAR_STEPS_METERS[SCALE_BAR_STEPS_METERS.length - 1],
    );
    for (const step of SCALE_BAR_STEPS_METERS) expect(step).toBeGreaterThan(0);
  });

  it('keeps the bar within its width budget at the default framing', () => {
    // ~20km of extent over ~900px at the shipped camera distance.
    const meters = pickScaleBarMeters(22);
    expect(meters / 22).toBeLessThanOrEqual(SCALE_BAR_MAX_WIDTH_PX);
  });

  it('steps up as the view zooms out', () => {
    // A larger metres-per-pixel means each metre covers less screen, so the
    // bar must claim more metres to stay legible.
    expect(pickScaleBarMeters(5)).toBeLessThan(pickScaleBarMeters(50));
    expect(pickScaleBarMeters(50)).toBeLessThan(pickScaleBarMeters(500));
  });

  it('steps down to the smallest rung when zoomed in', () => {
    // Extreme zoom-in: even the smallest step overflows, so it takes that one
    // rather than returning nothing.
    expect(pickScaleBarMeters(0.01)).toBe(SCALE_BAR_STEPS_METERS[0]);
  });

  it('never returns a distance that would overflow the width budget', () => {
    for (const mpp of [0.5, 1, 3, 10, 22, 40, 90, 200, 800]) {
      const meters = pickScaleBarMeters(mpp);
      const widthPx = meters / mpp;
      // Overflow is only tolerated on the smallest rung, where nothing larger
      // would fit either.
      if (meters !== SCALE_BAR_STEPS_METERS[0]) {
        expect(widthPx).toBeLessThanOrEqual(SCALE_BAR_MAX_WIDTH_PX);
      }
    }
  });
});

describe('formatScaleBarLabel', () => {
  it('reads in whole kilometres once the rung is large enough', () => {
    expect(formatScaleBarLabel(1000)).toBe('1 km');
    expect(formatScaleBarLabel(2000)).toBe('2 km');
    expect(formatScaleBarLabel(50000)).toBe('50 km');
  });

  it('reads in metres below a kilometre', () => {
    expect(formatScaleBarLabel(10)).toBe('10 m');
    expect(formatScaleBarLabel(500)).toBe('500 m');
  });
});

describe('coordinate labels', () => {
  it('labels a northern latitude with N', () => {
    expect(formatLatitude(0.3081)).toBe('0.308°N');
  });

  it('labels a southern latitude with S', () => {
    expect(formatLatitude(-1.5)).toBe('1.500°S');
  });

  it('labels an eastern longitude with E', () => {
    // The study extent's eastern edge, so the label is pinned to real data
    // rather than to a value whose third decimal sits on a rounding boundary.
    expect(formatLongitude(32.684)).toBe('32.684°E');
  });

  it('states the study extent the model is cut from', () => {
    // Three decimals of a degree is ~110m of latitude: finer than the 30m DEM
    // could support, coarser would invite a precision claim we cannot make.
    expect(sceneExtentCaption(KAMPALA_BOUNDS)).toBe('0.207°N–0.409°N, 32.511°E–32.684°E');
  });
});
