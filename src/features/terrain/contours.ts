import { BufferAttribute, BufferGeometry } from 'three';

/**
 * Contour lines — the cartographic signal that turns a shaded blob into a
 * *survey*.
 *
 * ## Why contours at all
 *
 * Owner feedback on the scene was that it read as "random clay artwork":
 * nothing about it said *measured ground*. Hillshade alone cannot, because a
 * smooth DEM under a smooth ramp still looks like something modelled by hand.
 * Iso-elevation lines are the convention that says the surface was surveyed,
 * and — unlike the shading — they carry quantitative meaning: the spacing
 * between them is the steepness, in metres, readable without a legend.
 *
 * ## Interval
 *
 * 20m over a 192m band gives ~10 lines. Finer than that and a 30m grid starts
 * drawing stair-stepped noise rather than terrain; coarser and the hills stop
 * being distinguishable from each other. Pinned by test.
 *
 * ## Contouring the mesh, not the grid
 *
 * Each cell of `buildHeightfieldGeometry` is drawn as **two triangles**, split
 * on the corner-to-corner diagonal — not as the bilinear patch that marching
 * squares normally assumes. Those two surfaces agree along the cell edges and
 * the diagonal, and disagree everywhere in between by `twist/4`, where
 * `twist = a + d − b − c`. Measured on the shipped DEM that divergence reaches
 * 11.96m at stride 4, 5.05m at stride 2 and 2.41m at stride 1 — up to 48 model
 * units once exaggerated.
 *
 * Contouring the bilinear patch therefore drops the line *inside* the mesh for
 * the whole length of a cell, where the depth test rejects it. That was not
 * theoretical: bilinear contours rendered 417 pixels of the 974×541 canvas,
 * against 9,557 once corrected — effectively invisible, and the reason the
 * layer looked absent.
 *
 * So each cell is processed as its two actual triangles. A level plane crosses
 * a triangle in exactly two points (or none), both of which lie on triangle
 * edges — and an edge is shared with the neighbouring triangle, so its height
 * is unambiguous. The resulting segments lie *in* the surface, exactly where
 * they belong.
 *
 * ## The ambiguous cells resolve themselves
 *
 * Marching squares normally needs a special rule for saddles — the case where
 * all four corners alternate around the level and two answers are valid —
 * which is why implementations carry a centre-test table. Here the diagonal
 * settles it: the two triangles are cut by that diagonal, so each reports its
 * own two crossings and the pairing follows from the geometry. Cases 6 and 9
 * fall out as ordinary triangles. No table, no centre mean, no branch.
 *
 * ## Nothing has to float
 *
 * Coincident geometry ties the depth buffer, so the naive expectation is that
 * the lines win or lose on the last bit of rasteriser rounding. Measured, they
 * lost 96% of the time — 393 visible pixels — and lifting the layer clear did
 * fix it (12m of lift reached 9,071), but at the cost of lines hovering above
 * the ground they describe, by up to 6px on a gentle slope.
 *
 * The real fault was **draw order**, not geometry. `WebGLRenderer` sorts opaque
 * objects front-to-back, so the contour layer could be submitted before the
 * terrain it sits on, write its depth first, and then be overwritten by a
 * surface at the same depth. Marking the lines `renderOrder = 1` in
 * `TerrainScene` and giving the terrain a two-quantum `polygonOffset` takes
 * lift-free contours to 8,699 pixels — 96% of the fully-lifted figure, with the
 * lines exactly on the surface. That is why this module applies no offset of
 * its own: the depth fight belongs to the renderer, not to the geometry.
 *
 * Pure and renderer-free by the rule governing `heightfield.ts`: jsdom has no
 * WebGL, so line geometry that only exists inside a material could never be
 * asserted.
 */

/** Elevation between successive contour lines, in metres. */
export const CONTOUR_INTERVAL_METERS = 20;

export interface ContourOptions {
  /**
   * Elevation samples in metres, row-major (`row * cols + col`), row 0 north —
   * the same array `buildHeightfieldGeometry` consumed.
   */
  samples: Float32Array;
  rows: number;
  cols: number;
  extent: { widthMeters: number; depthMeters: number };
  /** Multiplier applied to relief. Must match the mesh's, or lines float off it. */
  verticalExaggeration?: number;
  /** Subtracted before exaggeration. Must match the mesh's. */
  baseElevationMeters?: number;
}

/**
 * One triangle's pair of crossing points, in cell-space coordinates.
 *
 * Reused across every cell and level rather than allocated per triangle: a
 * full-resolution rebuild visits ~4.3M cells, and an object literal inside
 * that loop would spend the frame budget on garbage collection.
 */
const segment = { count: 0, firstT: 0, firstS: 0, secondT: 0, secondS: 0 };

/**
 * Records where a level plane crosses the edge `p → q`, if it crosses at all.
 *
 * Both endpoints are cell-space `(t, s)` with `t` running east and `s` running
 * south, so the crossing is a plain linear interpolation between them.
 * Comparison is `>=`, matching `buildHeightfieldGeometry`'s assumption that a
 * corner exactly on the level counts as above it — which also guarantees the
 * denominator is non-zero whenever the labels differ: two ends on opposite
 * sides of the level cannot be equal.
 *
 * Every triangle's edges cross an even number of times, so `segment.count`
 * only ever lands on 0 or 2; a corner sitting exactly on a level still
 * produces a consistent boolean labelling around the cycle.
 */
function recordCrossing(
  level: number,
  fromT: number,
  fromS: number,
  fromHeight: number,
  toT: number,
  toS: number,
  toHeight: number,
): void {
  if (fromHeight >= level === toHeight >= level) return;

  const u = (level - fromHeight) / (toHeight - fromHeight);
  const t = fromT + (toT - fromT) * u;
  const s = fromS + (toS - fromS) * u;

  if (segment.count === 0) {
    segment.firstT = t;
    segment.firstS = s;
  } else {
    segment.secondT = t;
    segment.secondS = s;
  }
  segment.count += 1;
}

/**
 * Builds line geometry for every contour line in the grid.
 *
 * Returns a `BufferGeometry` whose `position` attribute holds consecutive
 * vertex pairs, which is what `THREE.LineSegments` draws — one draw call for
 * every contour in the model.
 *
 * A grid with no level crossing (flat, or a band narrower than one interval)
 * yields an empty `position` attribute rather than a degenerate line.
 */
export function buildContourGeometry(options: ContourOptions): BufferGeometry {
  const {
    samples,
    rows,
    cols,
    extent,
    verticalExaggeration = 1,
    baseElevationMeters = 0,
  } = options;

  const positions: number[] = [];

  if (samples.length > 0 && rows >= 2 && cols >= 2) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < samples.length; i += 1) {
      const value = samples[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }

    // Start at the first level strictly above the minimum: a line at exactly
    // the lowest elevation would trace the basin rim rather than describe it.
    const firstLevel =
      Math.floor(min / CONTOUR_INTERVAL_METERS) * CONTOUR_INTERVAL_METERS +
      CONTOUR_INTERVAL_METERS;
    const levelCount =
      firstLevel > max ? 0 : Math.floor((max - firstLevel) / CONTOUR_INTERVAL_METERS) + 1;

    const halfWidth = extent.widthMeters / 2;
    const halfDepth = extent.depthMeters / 2;
    const stepX = extent.widthMeters / (cols - 1);
    const stepZ = extent.depthMeters / (rows - 1);

    /** Grid column → model `x`, matching `buildHeightfieldGeometry` exactly. */
    const toX = (gridColumn: number): number => -halfWidth + gridColumn * stepX;
    /** Grid row → model `z`. */
    const toZ = (gridRow: number): number => -halfDepth + gridRow * stepZ;

    for (let levelIndex = 0; levelIndex < levelCount; levelIndex += 1) {
      const level = firstLevel + levelIndex * CONTOUR_INTERVAL_METERS;
      const y = (level - baseElevationMeters) * verticalExaggeration;

      for (let row = 0; row < rows - 1; row += 1) {
        for (let col = 0; col < cols - 1; col += 1) {
          const northWest = samples[row * cols + col];
          const northEast = samples[row * cols + col + 1];
          const southWest = samples[(row + 1) * cols + col];
          const southEast = samples[(row + 1) * cols + col + 1];

          // Cell space: northWest (0,0), northEast (1,0), southWest (0,1),
          // southEast (1,1). These two triangles must match the index buffer in
          // `heightfield.ts` — (northWest, southWest, northEast) and
          // (northEast, southWest, southEast), split on northEast↔southWest —
          // or the contours describe a surface the viewer is not looking at.

          // First triangle: northWest → southWest → northEast.
          segment.count = 0;
          recordCrossing(level, 0, 0, northWest, 0, 1, southWest);
          recordCrossing(level, 0, 1, southWest, 1, 0, northEast);
          recordCrossing(level, 1, 0, northEast, 0, 0, northWest);
          if (segment.count === 2) {
            positions.push(toX(col + segment.firstT), y, toZ(row + segment.firstS));
            positions.push(toX(col + segment.secondT), y, toZ(row + segment.secondS));
          }

          // Second triangle: northEast → southWest → southEast.
          segment.count = 0;
          recordCrossing(level, 1, 0, northEast, 0, 1, southWest);
          recordCrossing(level, 0, 1, southWest, 1, 1, southEast);
          recordCrossing(level, 1, 1, southEast, 1, 0, northEast);
          if (segment.count === 2) {
            positions.push(toX(col + segment.firstT), y, toZ(row + segment.firstS));
            positions.push(toX(col + segment.secondT), y, toZ(row + segment.secondS));
          }
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeBoundingSphere();
  return geometry;
}
