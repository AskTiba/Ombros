import { boundsHeightMeters, boundsWidthMeters } from '@/lib/geo';

/**
 * Where the camera is allowed to go, and where it starts.
 *
 * Orbit, dolly and pan are three different moves. Orbit swings around a pivot,
 * dolly travels toward it, and pan *slides the pivot itself* — which is the
 * move that lets you bring a zoomed-off part of the model back into frame,
 * the way you drag a globe around. Without it the pivot is welded to the
 * centre and zooming in walks the camera at the centre while everything else
 * leaves the frame with no way back.
 *
 * Pan is therefore on, but bounded. An unclamped pivot can be dragged so far
 * that the model is entirely off-canvas, and the only recovery is hunting for
 * a reset control — on a phone, with one thumb. The clamp keeps the pivot
 * over the study extent, so "panned away" can never mean "gone".
 */

/** Where the camera starts: a 3/4 view over a ~22km model. */
export const DEFAULT_CAMERA_POSITION = { x: 0, y: 15000, z: 19000 } as const;

export interface ModelBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * The ground the model covers, centred on the origin exactly as
 * `buildHeightfieldGeometry` places it (ADR-005).
 */
export const studyExtentBounds = (): ModelBounds => {
  const halfWidth = boundsWidthMeters() / 2;
  const halfDepth = boundsHeightMeters() / 2;
  return { minX: -halfWidth, maxX: halfWidth, minZ: -halfDepth, maxZ: halfDepth };
};

export interface TargetPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Pulls a panned target back over the study extent.
 *
 * Height is deliberately untouched: pan is a ground-plane move, and adjusting
 * Y here would fight the polar-angle limits OrbitControls already enforce and
 * make the camera bob the moment it met a wall.
 */
export const clampTargetWithin = (
  target: TargetPoint,
  bounds: ModelBounds,
): TargetPoint => ({
  x: Math.min(Math.max(target.x, bounds.minX), bounds.maxX),
  y: target.y,
  z: Math.min(Math.max(target.z, bounds.minZ), bounds.maxZ),
});
