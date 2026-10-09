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
    <section aria-label="Sub-county drilldown" className="space-y-3 p-4">
      <h2 className="text-sm font-medium text-text-primary">Explore a sub-county</h2>
      <p className="text-xs text-text-secondary">
        Pick an area to see how many locations flood there and how deep the water gets.
      </p>
      <div className="flex flex-wrap gap-2">
        {subCounties.map((sc) => (
          <button
            key={sc.id}
            type="button"
            aria-pressed={selected === sc.name}
            className="rounded border border-border px-3 py-1 text-xs"
            onClick={() => setSelected(sc.name)}
          >
            {sc.name}
          </button>
        ))}
      </div>
      {selected && selectedStats && (
        <div data-testid="drilldown-stats" className="text-xs text-text-secondary">
          {selected}: {selectedStats.total} locations total · {selectedStats.shallow}{' '}
          shallow · {selectedStats.deep} deep
        </div>
      )}
    </section>
  );
}
