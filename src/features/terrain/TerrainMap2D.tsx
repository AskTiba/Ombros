import { useEffect, useRef, useState } from 'react';

import { FLOOD_DURATION_SECONDS, FLOOD_RAINFALL_MM } from '@/features/flood/floodBinary';
import { loadFloodScenarioOnce } from '@/features/flood/loadFlood';
import { DEPTH_CLASSES } from '@/features/flood/types';
import { FLOOD_CLASS_HEX } from '@/features/terrain/surfaceColors';

import type { DemBinaryGrid } from './demBinary';
import { loadDemGridOnce } from './loadDem';
import {
  renderTerrainMap,
  TERRAIN_MAP_MAX_WIDTH,
  type TerrainMapPixels,
} from './terrainMap';

const hours = (seconds: number): string => `${seconds / 3600} h`;

/** Which rainfall/depth event is on the map before the planner touches anything. */
const DEFAULT_RAINFALL_MM = 60;
const DEFAULT_DURATION_SECONDS = 10800;

/**
 * The accessible 2D map (ADR-002), carrying the published flood extents.
 *
 * Terrain comes from the same DEM the 3D mesh is built from; the flood layer
 * comes from McClean et al. (2021), rasterised at build time onto that same
 * grid. Because both sit on identical cells, a cell flooded here is flooded on
 * the same ground in the 3D view.
 *
 * ## What this deliberately does not claim
 *
 * The dataset publishes *extents at three depth thresholds*, not depths. So
 * the map bands the city by class and the text says "0.2–0.3 m" — never a
 * point value, never "the depth here is 0.24 m". A tool that invented that
 * number would look more precise and be less true (ERR-001).
 */
export function TerrainMap2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<DemBinaryGrid | null>(null);
  const [pixels, setPixels] = useState<TerrainMapPixels | null>(null);
  const [rainfallMm, setRainfallMm] = useState(DEFAULT_RAINFALL_MM);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
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
      setGrid(result.grid);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!grid) return;
    let cancelled = false;
    const { cols, rows } = grid;

    void loadFloodScenarioOnce(rainfallMm, durationSeconds, { cols, rows }).then(
      (result) => {
        if (cancelled) return;
        if (!result.ok) {
          setFailure(
            result.reason === 'not-found'
              ? 'The flood layer is not present. Run node scripts/fetch-flood.mjs to fetch it.'
              : result.reason === 'grid-mismatch'
                ? 'The flood layer was built on a different grid than the terrain, so it was not drawn.'
                : 'The flood layer could not be read.',
          );
          return;
        }
        setFailure(null);
        setPixels(renderTerrainMap(grid, TERRAIN_MAP_MAX_WIDTH, result.flood.flags));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [grid, rainfallMm, durationSeconds]);

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
  const [class1, class2, class3] = pixels.floodClassShares;
  const floodedPercent = Math.round((class1 + class2 + class3) * 100);
  const scenarioLabel = `${rainfallMm} mm over ${hours(durationSeconds)}`;
  const label =
    `Map of Kampala showing terrain shaded for relief, wetlands, and the flood ` +
    `extent modelled for ${scenarioLabel} of rain. ` +
    `Elevation runs from ${Math.round(pixels.minElevationMeters)} to ` +
    `${Math.round(pixels.maxElevationMeters)} metres. ` +
    `About ${wetPercent}% of the study area is water or wetland, and about ` +
    `${floodedPercent}% is modelled as flooded in this scenario, in three depth bands.`;

  return (
    <figure>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          Rainfall
          <select
            className="rounded-md border border-border bg-surface-overlay px-2 py-1 text-sm text-text-primary"
            value={rainfallMm}
            onChange={(event) => setRainfallMm(Number(event.target.value))}
          >
            {FLOOD_RAINFALL_MM.map((mm) => (
              <option key={mm} value={mm}>
                {mm} mm
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          Duration
          <select
            className="rounded-md border border-border bg-surface-overlay px-2 py-1 text-sm text-text-primary"
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(Number(event.target.value))}
          >
            {FLOOD_DURATION_SECONDS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {hours(seconds)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface-overlay">
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
        {DEPTH_CLASSES.map(({ id, rangeLabel }, index) => (
          <li key={id} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: FLOOD_CLASS_HEX[index] }}
            />
            <span>
              {rangeLabel} flooded (~{Math.round(pixels.floodClassShares[index] * 100)}%)
            </span>
          </li>
        ))}
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
        view is built on. Flood extent for {scenarioLabel} of rain, from McClean et al.
        (2021), Newcastle and Makerere Universities, released under the Open Government
        Licence. Bands are depth <em>classes</em> at 0.1, 0.2 and 0.3 m — the thresholds
        the study published — not measured depths at any one point. Terrain is a 30 m DEM,
        coarser than the 5 m the flood model ran on, so edges are indicative.
      </figcaption>
    </figure>
  );
}
