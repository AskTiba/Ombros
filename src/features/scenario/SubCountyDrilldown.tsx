import { useState } from 'react';

import { summarizeRisk } from './riskSummary';
import type { ScenarioBaseline } from './createBaselineScenario';

export interface SubCountyDrilldownProps {
  scenario: ScenarioBaseline;
}

export function SubCountyDrilldown({ scenario }: SubCountyDrilldownProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const summary = summarizeRisk(scenario);
  const subCounties = scenario.subCounties ?? [];

  const selectedStats = selected
    ? {
        total: summary.totalPoints,
        shallow: summary.depthClassCounts.shallow ?? 0,
        deep: summary.depthClassCounts.deep ?? 0,
      }
    : null;

  return (
    <section aria-label="Sub-county drilldown" className="card rise flex flex-col p-5">
      <h2 className="text-base font-semibold text-text-primary">Explore a sub-county</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Pick an area to see how many locations flood there and how deep the water gets.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {subCounties.map((sc) => (
          <button
            key={sc.id}
            type="button"
            aria-pressed={selected === sc.name}
            className="btn btn-secondary"
            onClick={() => setSelected(sc.name)}
          >
            {sc.name}
          </button>
        ))}
      </div>
      {selected && selectedStats && (
        <div
          data-testid="drilldown-stats"
          className="mt-4 rounded-lg bg-surface-overlay p-3 text-sm text-text-secondary"
        >
          <span className="font-medium text-text-primary">{selected}</span>:{' '}
          {selectedStats.total} locations total · {selectedStats.shallow} shallow ·{' '}
          {selectedStats.deep} deep
        </div>
      )}
    </section>
  );
}
