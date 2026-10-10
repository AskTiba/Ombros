import { describe, expect, it } from 'vitest';

import { boundsHeightMeters, boundsWidthMeters } from '@/lib/geo';
import {
  DEFAULT_CAMERA_POSITION,
  clampTargetWithin,
  studyExtentBounds,
} from '@/features/terrain/sceneNavigation';

describe('studyExtentBounds', () => {
  it('spans the real study extent on the ground', () => {
    const bounds = studyExtentBounds();
    expect(bounds.maxX - bounds.minX).toBeCloseTo(boundsWidthMeters(), 3);
    expect(bounds.maxZ - bounds.minZ).toBeCloseTo(boundsHeightMeters(), 3);
  });

  it('is centred on the origin, matching where the mesh is built', () => {
    // ADR-005 puts the origin at the study-area centroid, so the model runs
    // from -halfExtent to +halfExtent. Clamping against anything else would
    // let the target sit off one edge of the geometry.
    const bounds = studyExtentBounds();
    expect(bounds.minX).toBeCloseTo(-bounds.maxX, 6);
    expect(bounds.minZ).toBeCloseTo(-bounds.maxZ, 6);
  });

  it('is taller north-south than it is wide', () => {
    // Kampala's extent is ~19.3km by ~22.3km. Panning limits that assumed a
    // square model would let the target leave the geometry north or south
    // while still "inside" the clamp.
    const bounds = studyExtentBounds();
    expect(bounds.maxZ - bounds.minZ).toBeGreaterThan(bounds.maxX - bounds.minX);
  });
});

describe('clampTargetWithin', () => {
  const BOUNDS = { minX: -100, maxX: 100, minZ: -200, maxZ: 200 };

  it('leaves a target that is already over the extent alone', () => {
    expect(clampTargetWithin({ x: 0, y: 400, z: 0 }, BOUNDS)).toEqual({
      x: 0,
      y: 400,
      z: 0,
    });
  });

  it('pulls a target that has panned off the east edge back in', () => {
    expect(clampTargetWithin({ x: 900, y: 400, z: 0 }, BOUNDS).x).toBe(100);
  });

  it('pulls a target that has panned off the west edge back in', () => {
    expect(clampTargetWithin({ x: -900, y: 400, z: 0 }, BOUNDS).x).toBe(-100);
  });

  it('pulls a target that has panned off the north or south edge back in', () => {
    expect(clampTargetWithin({ x: 0, y: 400, z: -5000 }, BOUNDS).z).toBe(-200);
    expect(clampTargetWithin({ x: 0, y: 400, z: 5000 }, BOUNDS).z).toBe(200);
  });

  it('never touches height, which orbit controls already own', () => {
    // Pan moves the target across the ground plane. Adjusting Y here would
    // fight the polar-angle limits and make the camera bob when it hits a wall.
    expect(clampTargetWithin({ x: 5000, y: -321, z: -5000 }, BOUNDS).y).toBe(-321);
  });

  it('clamps an edge target to the edge rather than past it', () => {
    expect(clampTargetWithin({ x: 100, y: 0, z: 200 }, BOUNDS)).toEqual({
      x: 100,
      y: 0,
      z: 200,
    });
  });
});

describe('DEFAULT_CAMERA_POSITION', () => {
  it('starts high enough and near enough that relief reads', () => {
    // The framing the whole scene was tuned against: a 3/4 view over a model
    // roughly 22km across and ~1km tall.
    expect(DEFAULT_CAMERA_POSITION.y).toBeGreaterThan(10000);
    expect(
      Math.hypot(DEFAULT_CAMERA_POSITION.x, DEFAULT_CAMERA_POSITION.z),
    ).toBeGreaterThan(15000);
  });
});
