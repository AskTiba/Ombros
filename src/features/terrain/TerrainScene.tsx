import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';

import { buildHeightfieldGeometry } from '@/features/terrain/heightfield';
import {
  loadDemGrid,
  type DemLoadFailure,
  type DemLoadResult,
} from '@/features/terrain/loadDem';
import type { DemBinaryGrid } from '@/features/terrain/demBinary';

/**
 * Single disclosed vertical exaggeration (ADR-005): a number that can be
 * stated in the UI here and in the generated risk report later.
 */
export const VERTICAL_EXAGGERATION = 2;

export function TerrainScene() {
  const [result, setResult] = useState<DemLoadResult | null>(null);

  useEffect(() => {
    let alive = true;
    loadDemGrid().then((outcome) => {
      if (alive) setResult(outcome);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (result === null) {
    return <p role="status">Loading Kampala elevation data…</p>;
  }

  if (!result.ok) {
    return <DemFailure reason={result.reason} />;
  }

  return <TerrainCanvas grid={result.grid} />;
}

function DemFailure({ reason }: { reason: DemLoadFailure }) {
  return (
    <section
      role="alert"
      className="grid min-h-[60dvh] place-items-center p-6"
      aria-label="Elevation data unavailable"
    >
      <div className="max-w-prose space-y-3 text-center">
        <h2 className="text-base font-medium text-text-secondary">
          Elevation data unavailable
        </h2>
        {reason === 'not-found' && (
          <p className="text-sm text-text-secondary">
            The DEM asset is missing. Run{' '}
            <code className="rounded bg-surface-raised px-1 py-0.5">
              node scripts/fetch-dem.mjs
            </code>{' '}
            to fetch it.
          </p>
        )}
        {reason === 'corrupt' && (
          <p className="text-sm text-text-secondary">
            The elevation file is corrupt or unreadable and cannot be displayed.
          </p>
        )}
        {reason === 'network' && (
          <p className="text-sm text-text-secondary">
            The elevation file could not be downloaded. Check your connection and try
            again.
          </p>
        )}
      </div>
    </section>
  );
}

function TerrainCanvas({ grid }: { grid: DemBinaryGrid }) {
  const geometry = useMemo(
    () =>
      buildHeightfieldGeometry({
        samples: grid.samples,
        rows: grid.rows,
        cols: grid.cols,
        extent: {
          widthMeters: grid.widthMeters,
          depthMeters: grid.depthMeters,
        },
        verticalExaggeration: VERTICAL_EXAGGERATION,
        baseElevationMeters: grid.minElevationMeters,
      }),
    [grid],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <section
      aria-label="3D terrain of Kampala"
      className="grid min-h-[60dvh] place-items-center"
    >
      <Canvas
        camera={{ position: [0, 8000, 18000], fov: 50, near: 100, far: 60000 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[6000, 10000, 6000]} intensity={1.4} />
        <mesh geometry={geometry}>
          <meshStandardMaterial color="#8f9b6b" roughness={0.95} metalness={0} />
        </mesh>
      </Canvas>
      <p className="pb-4 text-center text-xs text-text-secondary">
        Vertical exaggeration ×{VERTICAL_EXAGGERATION} — terrain from Copernicus DEM
        GLO-30 at 30m
      </p>
    </section>
  );
}
