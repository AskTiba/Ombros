import { useEffect, useMemo, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { BufferAttribute } from 'three';

import { buildHeightfieldGeometry } from '@/features/terrain/heightfield';
import { CONTOUR_LINE_HEX, buildSurfaceColors } from '@/features/terrain/surfaceColors';
import { SLAB_DEPTH_METERS, buildSlabGeometry } from '@/features/terrain/slab';
import { buildContourGeometry } from '@/features/terrain/contours';
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
 *
 * The study extent carries only **192m** of relief across ~22km — 1,125.5m at
 * the Lake Victoria shoreline up to 1,317.6m at Kololo Hill. At ×2 that is a
 * 1.72% height-to-depth ratio, which reads as a flat sheet however the scene
 * is lit. ×4 brings it to 3.4%: hills read as hills while staying one
 * disclosed number rather than a hidden fudge.
 *
 * Deliberately not much higher. The DEM is smooth in absolute terms — 0.65m
 * RMS high-frequency deviation — but at cell scale that is *larger* than the
 * 0.26m regional step, so exaggeration amplifies cell noise faster than it
 * amplifies the hills you are trying to show. Past roughly ×6 the shading
 * starts following DEM noise instead of topography and the city turns into a
 * bed of spikes. `TerrainScene.test.tsx` pins the caption to this constant, so
 * geometry and disclosure cannot drift apart.
 */
export const VERTICAL_EXAGGERATION = 4;

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

  const geometry = useMemo(() => {
    const built = buildHeightfieldGeometry({
      samples: tierGrid.samples,
      rows: tierGrid.rows,
      cols: tierGrid.cols,
      extent: {
        widthMeters: tierGrid.widthMeters,
        depthMeters: tierGrid.depthMeters,
      },
      verticalExaggeration: VERTICAL_EXAGGERATION,
      // The original band, not the decimated grid's: a quality-tier change
      // must not slide the terrain's base height or re-tint it mid-frame.
      baseElevationMeters: grid.minElevationMeters,
    });
    built.setAttribute(
      'color',
      new BufferAttribute(
        // Hypsometric tint × hillshade, with water overridden — see
        // `surfaceColors`. Shading is baked here rather than thrown by a lamp:
        // the cartographic reading convention survives orbiting, where a
        // directional light would re-light the terrain into whatever sun angle
        // the camera happens to face.
        buildSurfaceColors({
          samples: tierGrid.samples,
          rows: tierGrid.rows,
          cols: tierGrid.cols,
          cellXMeters: tierGrid.widthMeters / (tierGrid.cols - 1),
          cellZMeters: tierGrid.depthMeters / (tierGrid.rows - 1),
          minElevationMeters: grid.minElevationMeters,
          maxElevationMeters: grid.maxElevationMeters,
        }),
        3,
      ),
    );
    return built;
  }, [tierGrid, grid.minElevationMeters, grid.maxElevationMeters]);

  /*
   * Contours at the *tier's* resolution, not the DEM's, for two reasons.
   * Lines built from the full grid would float off a decimated mesh, since the
   * mesh's own surface at stride 4 is the 120m grid, not the 30m one — a
   * contour has to lie on the thing it describes. And it keeps the cost
   * proportional to what the device is already being asked to draw: measured
   * on the shipped DEM, 34k/71k/147k line vertices at strides 4/2/1, against a
   * mesh of 30k/120k/480k — lines are always the cheaper of the two.
   */
  const contourGeometry = useMemo(
    () =>
      buildContourGeometry({
        samples: tierGrid.samples,
        rows: tierGrid.rows,
        cols: tierGrid.cols,
        extent: {
          widthMeters: tierGrid.widthMeters,
          depthMeters: tierGrid.depthMeters,
        },
        verticalExaggeration: VERTICAL_EXAGGERATION,
        baseElevationMeters: grid.minElevationMeters,
      }),
    [tierGrid, grid.minElevationMeters],
  );

  /*
   * The cut face under every edge, built from the *same* tier grid and the same
   * base and exaggeration as the terrain — so each wall's rim lands exactly on
   * the boundary vertex it descends from, with no seam to z-fight over. The
   * floor is derived inside `buildSlabGeometry` from this grid's own lowest
   * sample, which guarantees it clears whatever ground is actually being drawn
   * at the current quality tier.
   */
  const slabGeometry = useMemo(
    () =>
      buildSlabGeometry({
        samples: tierGrid.samples,
        rows: tierGrid.rows,
        cols: tierGrid.cols,
        extent: {
          widthMeters: tierGrid.widthMeters,
          depthMeters: tierGrid.depthMeters,
        },
        verticalExaggeration: VERTICAL_EXAGGERATION,
        baseElevationMeters: grid.minElevationMeters,
      }),
    [tierGrid, grid.minElevationMeters],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      contourGeometry.dispose();
      slabGeometry.dispose();
    };
  }, [geometry, contourGeometry, slabGeometry]);

  /*
   * Vertical centre of the whole model: the terrain's relief, plus the slab
   * that hangs below it. Framing on the surface alone clipped the base off the
   * bottom of the canvas, which showed as a rim a few pixels deep instead of a
   * solid base. The grid's own band — not the tier's — so a quality change
   * never slides the camera.
   */
  const sceneCentreY =
    ((grid.maxElevationMeters - grid.minElevationMeters - SLAB_DEPTH_METERS) *
      VERTICAL_EXAGGERATION) /
    2;

  return (
    <section aria-label="3D terrain of Kampala" className="card overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">Kampala in 3D</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Relief that shapes where water collects. Drag to orbit, scroll to zoom.
        </p>
      </div>
      {/*
        The viewport owns an explicit height so the R3F container can never
        collapse to zero, and the gradient behind the (transparent) canvas
        lifts the terrain out of a flat page-coloured void. It reads through
        var(), so the scene follows the OS theme with no JS.
      */}
      <div className="scene-viewport relative h-[60dvh] min-h-[340px]">
        <Canvas
          camera={{ position: [0, 15000, 19000], fov: 50, near: 100, far: 60000 }}
          dpr={[1, TIER_CONFIGS[tier].maxPixelRatio]}
          /*
            `flat` swaps r3f's default ACES filmic curve for no tone mapping at
            all. ACES exists to compress HDR highlights into a displayable
            range, which is right for a photoreal scene and wrong for a map:
            it desaturates and darkens mid-tones, so the tokens pinned in
            `globals.css` would never actually reach the screen. A survey
            drawing is meant to reproduce its colours, not interpret them.
          */
          flat
        >
          <QualitySampler tier={tier} onTierChange={setTier} />
          {/*
            A three-quarter view rather than the near-ground grazing angle that
            foreshortened the relief away, with orbit so the parallax is
            discoverable. Pan is off so the terrain cannot be dragged off-screen
            with no way back; polar angle is clamped above the horizon so the
            underside is never visible.
          */}
          {/*
            Vertical centre of the whole model — the terrain's relief plus the
            slab that now hangs below it. Targeting the surface alone clipped
            the base off the bottom of the canvas: measured at 206 visible rim
            pixels against a model that reaches 200 units lower.
          */}
          <OrbitControls
            target={[0, sceneCentreY, 0]}
            enableDamping
            dampingFactor={0.08}
            enablePan={false}
            minDistance={6000}
            maxDistance={45000}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2.2}
          />
          {/*
            No lights: the shading is already in the vertex colours. An unlit
            material reads them straight through, which keeps the cartographic
            hillshade fixed to the terrain instead of swinging with the camera
            — and costs nothing per pixel, which is the budget that matters on
            a mid-range Android over mobile data.
          */}
          <mesh geometry={geometry}>
            {/*
              `vertexColors` carries the baked tint × hillshade; white keeps it
              unmultiplied. The polygon offset pushes the terrain a few depth
              quanta *away* from the camera — the standard decal trick — so the
              contours drawn on top of it win the depth test without being
              lifted off the surface they describe.
            */}
            <meshBasicMaterial
              vertexColors
              color="#ffffff"
              polygonOffset
              polygonOffsetFactor={1}
              polygonOffsetUnits={2}
            />
          </mesh>
          {/*
            The slab: four walls and a floor that close the heightfield into a
            solid. Without it the DEM just stops at the study extent and reads
            as a shape lying on the page rather than as a specimen cut out of
            the ground. Its colours are baked in `slab.ts` for the same reason
            the terrain's are — there are no lights to shape it.
          */}
          <mesh geometry={slabGeometry}>
            <meshBasicMaterial vertexColors color="#ffffff" />
          </mesh>
          {/*
            The layer that makes the surface read as *surveyed* ground rather
            than a shaped solid. One draw call for every contour in the model —
            `buildContourGeometry` emits consecutive vertex pairs, which is
            exactly what LineSegments consumes.

            `renderOrder` matters: three.js sorts opaque objects front-to-back,
            so without it the lines can be drawn *before* the terrain, write
            their depth first, and then be overwritten by the surface sitting
            at the same depth. Pinned by measurement — an out-of-order layer
            showed 393px against 9,041 once ordered.
          */}
          <lineSegments geometry={contourGeometry} renderOrder={1}>
            <lineBasicMaterial color={CONTOUR_LINE_HEX} />
          </lineSegments>
        </Canvas>
      </div>
      <div className="space-y-1 border-t border-border px-4 py-3 text-center">
        <p className="text-xs text-text-secondary">
          Vertical exaggeration ×{VERTICAL_EXAGGERATION} — terrain from Copernicus DEM
          GLO-30 at 30m
        </p>
        <p
          data-testid="tier-disclosure"
          aria-live="polite"
          className="text-xs text-text-secondary"
        >
          Rendering quality: {tier} — adjusted to your device and connection
        </p>
      </div>
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
