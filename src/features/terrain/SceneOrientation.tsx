import { useImperativeHandle, useRef, type Ref } from 'react';

import {
  formatScaleBarLabel,
  northRotationDeg,
  pickScaleBarMeters,
  sceneExtentCaption,
  type SceneBounds,
} from './orientation';

/**
 * The compass, scale bar and extent caption laid over the 3D viewport.
 *
 * ## Why these three
 *
 * A relief model of a city is unreadable without them. The compass says which
 * way is north once the user has orbited — the single cue that turns "a shape"
 * into "a place". The scale bar is what makes 20km look like 20km rather than
 * like a few streets. The extent caption states the real bounds so the model
 * can be tied back to the published study area.
 *
 * ## Why edge labels are absent
 *
 * Labels pinned to the four edges of the canvas would be claiming that edge is
 * north for most of the time the user is orbiting. The bounds caption is true
 * however the camera turns, which is why the overlay states the extent rather
 * than decorating its corners.
 *
 * ## Why this updates imperatively
 *
 * `OrbitControls` fires on every pointer move and every inertia frame. Routing
 * that through React state would re-render the whole scene subtree dozens of
 * times a second to move one arrow, on the mid-range Android that is the
 * target device. Instead the handle writes the style properties directly;
 * nothing above this component re-renders, and the reads never enter a render.
 *
 * `pointer-events: none` throughout, so the overlay cannot swallow the drag
 * that orbits the camera it is annotating.
 */

/** Width of the compass rose, in CSS pixels. */
const COMPASS_SIZE = 40;

export interface SceneOrientationHandle {
  /**
   * Re-aims the compass. Needs only the camera's azimuth, never layout, so it
   * is safe to call as soon as the controls exist.
   */
  aimCompass(azimuthRadians: number): void;

  /**
   * Resizes the scale bar and sets its label.
   *
   * @param metresPerPixelValue ground metres per screen pixel — see
   * `metresPerPixel`. Anything non-finite or non-positive leaves the bar
   * untouched: an unmeasured viewport is not evidence that the scene has a
   * known width.
   */
  setScale(metresPerPixelValue: number): void;
}

export interface SceneOrientationProps {
  /** Geographic bounds of the study extent, in degrees. */
  bounds: SceneBounds;
  /**
   * Returns the camera to its default framing.
   *
   * The compass is the reset control, which is the convention on Google Earth
   * and Cesium: once the user can pan, there has to be a one-gesture way back.
   * Making it the compass rather than a separate button means the affordance
   * is the thing they are already looking at to find north.
   */
  onResetView: () => void;
  ref?: Ref<SceneOrientationHandle>;
}

export function SceneOrientation({ bounds, onResetView, ref }: SceneOrientationProps) {
  const northRef = useRef<SVGGElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    aimCompass(azimuthRadians) {
      if (northRef.current) {
        northRef.current.style.transform = `rotate(${northRotationDeg(azimuthRadians)}deg)`;
      }
    },
    setScale(metresPerPixelValue) {
      if (!Number.isFinite(metresPerPixelValue) || metresPerPixelValue <= 0) return;

      const meters = pickScaleBarMeters(metresPerPixelValue);
      if (barRef.current) {
        barRef.current.style.width = `${meters / metresPerPixelValue}px`;
      }
      if (labelRef.current) {
        labelRef.current.textContent = formatScaleBarLabel(meters);
      }
    },
  }));

  return (
    <div
      className="absolute inset-0"
      // Inline rather than the `pointer-events-none` utility: this is a
      // correctness requirement, not a style, and an inline declaration cannot
      // be purged or fail to load.
      style={{ pointerEvents: 'none' }}
      role="group"
      aria-label="Map orientation"
    >
      {/*
        A real button so it is reachable and activatable by keyboard — the
        scene's only navigation control that is. `pointer-events: auto` is the
        override that lifts it out of the overlay's own `none`; done inline
        rather than as a utility class because a leak here would silently
        disable the only way back out of a panned view.
      */}
      <button
        type="button"
        onClick={onResetView}
        style={{ pointerEvents: 'auto' }}
        className="absolute right-2 top-2 cursor-pointer rounded-full p-1 text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Reset the view to north up over the whole study extent"
      >
        <svg
          width={COMPASS_SIZE}
          height={COMPASS_SIZE}
          viewBox="0 0 48 48"
          role="img"
          aria-label="North arrow — turns to match the camera"
        >
          <circle cx="24" cy="24" r="21" className="fill-surface-raised" opacity="0.85" />
          {/*
          Rotated by `update` rather than re-rendered. `transform-box: view-box`
          pins the origin to the SVG's own coordinate system, so `rotate` turns
          the rose about its centre instead of about the top-left corner of the
          page.
        */}
          <g
            ref={northRef}
            data-testid="north-arrow"
            style={{ transformBox: 'view-box', transformOrigin: '24px 24px' }}
          >
            <path d="M24 7 L29.5 27 L24 23.5 L18.5 27 Z" className="fill-current" />
            <text
              x="24"
              y="40"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              className="fill-current"
            >
              N
            </text>
          </g>
        </svg>
      </button>

      <div className="absolute inset-x-3 bottom-3 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <span
            ref={barRef}
            data-testid="scale-bar"
            aria-hidden="true"
            className="block h-[7px] border-x-2 border-b-2 border-text-primary transition-[width] duration-150 ease-out"
            style={{ width: 0 }}
          />
          <span
            ref={labelRef}
            data-testid="scale-bar-label"
            className="text-xs font-medium tabular-nums text-text-secondary"
          >
            —
          </span>
        </div>
        <p className="text-[10px] leading-tight tabular-nums text-text-secondary sm:text-right">
          {sceneExtentCaption(bounds)}
        </p>
      </div>
    </div>
  );
}
