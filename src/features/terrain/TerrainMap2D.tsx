import { useEffect, useRef, useState } from 'react';

import { loadDemGridOnce } from './loadDem';
import {
  renderTerrainMap,
  TERRAIN_MAP_MAX_WIDTH,
  type TerrainMapPixels,
} from './terrainMap';

/**
 * The accessible 2D map (ADR-002).
 *
 * A canvas, not an image file: the pixels come from the same DEM the 3D mesh
 * is built from, rendered once when the grid lands. A `<canvas>` on its own is
 * invisible to assistive technology, so the element carries a real accessible
 * name built from the data it is showing, and the numbers are repeated in the
 * visible caption — the text alternative is never the *only* place the
 * elevation range appears.
 *
 * The loading and failure states are explicit because the DEM is a gitignored
 * asset: on a fresh clone it is genuinely absent, and "nothing here" is the
 * honest thing to say rather than an empty box.
 */
export function TerrainMap2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pixels, setPixels] = useState<TerrainMapPixels | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadDemGridOnce().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setFailure(
          result.reason === 'not-found'
            ? 'The terrain file is not present. Run node scripts/fetch-dem.mjs to fetch it.'
            : 'The terrain file could not be read.',
        );
        return;
      }
      setPixels(renderTerrainMap(result.grid, TERRAIN_MAP_MAX_WIDTH));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels) return;
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    canvas
      .getContext('2d')
      ?.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
  }, [pixels]);

  if (failure) {
    return (
      <p
        role="status"
        className="rounded-lg border border-border bg-surface-overlay p-4 text-sm text-text-secondary"
      >
        {failure}
      </p>
    );
  }

  if (!pixels) {
    return (
      <p
        role="status"
        className="rounded-lg border border-border bg-surface-overlay p-4 text-sm text-text-secondary"
      >
        Loading the terrain map…
      </p>
    );
  }

  const wetPercent = Math.round(pixels.waterShare * 100);
  const label =
    `Kampala terrain seen from above, shaded to show relief. ` +
    `Elevation runs from ${Math.round(pixels.minElevationMeters)} to ` +
    `${Math.round(pixels.maxElevationMeters)} metres. ` +
    `About ${wetPercent}% of the study area is water or wetland.`;

  return (
    <figure>
      <div className="overflow-hidden rounded-lg border border-border bg-surface-overlay">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          className="block h-auto w-full"
        />
      </div>
      <ul
        data-testid="terrain-legend"
        className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary"
      >
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: 'var(--color-water-100)' }}
          />
          <span>Water and wetland (~{wetPercent}%)</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-sm"
            style={{
              background:
                'linear-gradient(90deg, var(--color-terrain-low), var(--color-terrain-high))',
            }}
          />
          <span>
            {Math.round(pixels.minElevationMeters)}–
            {Math.round(pixels.maxElevationMeters)} m, shaded for relief
          </span>
        </li>
      </ul>
      <figcaption className="mt-2 text-xs text-text-secondary">
        Terrain and wetlands of the study extent, from the same elevation model the 3D
        view is built on. Shading shows where ground rises and falls; it is not a
        prediction of where water would go in a storm.
      </figcaption>
    </figure>
  );
}
