import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

import { buildHeightfieldGeometry } from '@/features/terrain/heightfield';
import {
  loadDemGrid,
  type DemLoadFailure,
  type DemLoadResult,
} from '@/features/terrain/loadDem';
import type { DemBinaryGrid } from '@/features/terrain/demBinary';
import { decimateGrid } from '@/features/terrain/decimateGrid';
import {
  DEFAULT_SAMPLER_OPTIONS,
  sampleFrameTime,
  type FrameRateState,
} from '@/features/terrain/frameRateSampler';
import {
  TIER_CONFIGS,
  adjustTier,
  selectInitialTier,
  type QualityTier,
} from '@/features/terrain/qualityTiers';
import { readDeviceSignals } from '@/features/terrain/deviceSignals';

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
  const [tier, setTier] = useState<QualityTier>(() =>
    selectInitialTier(readDeviceSignals()),
  );

  const tierGrid = useMemo(
    () => decimateGrid(grid, TIER_CONFIGS[tier].stride),
    [grid, tier],
  );

  const geometry = useMemo(
    () =>
      buildHeightfieldGeometry({
        samples: tierGrid.samples,
        rows: tierGrid.rows,
        cols: tierGrid.cols,
        extent: {
          widthMeters: tierGrid.widthMeters,
          depthMeters: tierGrid.depthMeters,
        },
        verticalExaggeration: VERTICAL_EXAGGERATION,
        baseElevationMeters: tierGrid.minElevationMeters,
      }),
    [tierGrid],
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
        dpr={[1, TIER_CONFIGS[tier].maxPixelRatio]}
      >
        <QualitySampler tier={tier} onTierChange={setTier} />
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
      <p
        data-testid="tier-disclosure"
        aria-live="polite"
        className="pb-4 text-center text-xs text-text-secondary"
      >
        Rendering quality: {tier} — adjusted to your device and connection
      </p>
    </section>
  );
}

/**
 * Lives inside the Canvas and owns the frame loop's half of tier adaptation.
 * Every `useFrame` tick feeds the sampler with the real frame time; when a
 * verdict fires, `onTierChange` re-derives the geometry at the new stride. The
 * tier is read through a ref kept current in an effect because R3F subscribes
 * the callback once per mount — writing the ref during render would be the
 * concurrent-unsafe alternative.
 */
function QualitySampler({
  tier,
  onTierChange,
}: {
  tier: QualityTier;
  onTierChange: (tier: QualityTier) => void;
}) {
  const tierRef = useRef(tier);
  const samplerState = useRef<FrameRateState>({ frames: 0, sumMs: 0, streak: 0 });

  useEffect(() => {
    tierRef.current = tier;
  }, [tier]);

  useFrame((_state, delta) => {
    const { state, result } = sampleFrameTime(
      samplerState.current,
      delta * 1000,
      DEFAULT_SAMPLER_OPTIONS,
      tierRef.current,
    );
    samplerState.current = state;

    if (result.verdict === 'promote') {
      onTierChange(adjustTier(tierRef.current, 1));
    } else if (result.verdict === 'demote') {
      onTierChange(adjustTier(tierRef.current, -1));
    }
  });

  return null;
}
