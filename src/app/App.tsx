import { lazy } from 'react';

import { SceneFallback } from '@/features/terrain/SceneFallback';
import { SceneGate } from '@/features/terrain/SceneGate';
import { createBaselineScenario } from '@/features/scenario/createBaselineScenario';
import { Scenario2D } from '@/features/scenario/Scenario2D';

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
});

export function App() {
  return (
    <main className="min-h-dvh bg-surface-base text-text-primary">
      <header className="border-b border-white/10 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Ombros</h1>
        <p className="text-sm text-text-secondary">Flood risk intelligence for Kampala</p>
      </header>
      <section className="px-6 py-4">
        <Scenario2D scenario={BASELINE_SCENARIO} />
      </section>
      <SceneGate
        scene={TerrainScene}
        fallback={<SceneFallback />}
        loading={
          <p role="status" className="grid min-h-[60dvh] place-items-center p-6">
            Loading 3D scene…
          </p>
        }
      />
    </main>
  );
}
