import { lazy } from 'react';

import { SceneFallback } from '@/features/terrain/SceneFallback';
import { SceneGate } from '@/features/terrain/SceneGate';
import { createBaselineScenario } from '@/features/scenario/createBaselineScenario';
import { TerrainMap2D } from '@/features/terrain/TerrainMap2D';
import { riskSummaryCard } from '@/features/scenario/riskSummaryCard';
import { SubCountyDrilldown } from '@/features/scenario/SubCountyDrilldown';
import { riskReport } from '@/features/scenario/riskReport';
import { Hero } from './Hero';

const TerrainScene = lazy(() =>
  import('@/features/terrain/TerrainScene').then((module) => ({
    default: module.TerrainScene,
  })),
);

const BASELINE_SCENARIO = createBaselineScenario({
  id: 'baseline-kampala-30min-20mm',
  name: '30-min, 20mm (baseline)',
  rainfallDepthMm: 20,
  durationMinutes: 30,
  label: 'Baseline: 30 min, 20 mm',
  subCounties: [
    { id: 'lc1', name: 'Makindye' },
    { id: 'lc2', name: 'Rubaga' },
  ],
});

export function App() {
  return (
    <div className="min-h-dvh bg-surface-base text-text-primary">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header
        data-testid="app-header"
        className="sticky top-0 z-10 border-b border-border bg-surface-base/80 backdrop-blur-md"
      >
        <div className="mx-auto flex w-full max-w-5xl items-baseline gap-3 px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight">Ombros</h1>
          <p className="hidden text-sm text-text-secondary sm:block">
            Flood risk intelligence for Kampala
          </p>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6"
      >
        <Hero />
        {riskSummaryCard({ scenario: BASELINE_SCENARIO })}
        {/*
          A flood map, attributed. ADR-001 forbids implementing our own
          hydrodynamic solver — it does not forbid showing published modelling.
          This extent is McClean et al. (2021), ingested at build time; the
          caption says so, and the bands are the study's own three depth
          thresholds rather than depths we interpolated.
        */}
        <section aria-label="Kampala flood extent map" className="card rise p-5">
          <h3 className="text-base font-semibold text-text-primary">
            Modelled flood extent
          </h3>
          <div className="mt-3">
            <TerrainMap2D />
          </div>
        </section>
        {/*
          Mid-page rather than trailing the report: the 2D map stays the primary
          accessible path directly above it (ADR-002), while the scene sits where
          it reads as part of the analysis instead of an appendix. It still comes
          after the decision numbers, so the page leads with capability, not
          rendering (RISK-006).
        */}
        <SceneGate
          scene={TerrainScene}
          fallback={<SceneFallback />}
          loading={
            <p role="status" className="grid min-h-[60dvh] place-items-center p-6">
              Loading 3D scene…
            </p>
          }
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <SubCountyDrilldown scenario={BASELINE_SCENARIO} />
          {riskReport({ scenario: BASELINE_SCENARIO, shallowMaxM: 0.3, deepMinM: 0.4 })}
        </div>
      </main>
    </div>
  );
}
