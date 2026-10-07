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
      <h2 className="text-sm font-medium text-text-primary">Drilldown</h2>
      <div className="flex flex-wrap gap-2">
        {subCounties.map((sc) => (
          <button
            key={sc.id}
            type="button"
            className="rounded border border-white/10 px-3 py-1 text-xs"
            onClick={() => setSelected(sc.name)}
          >
            {sc.name}
          </button>
        ))}
      </div>
      {selected && selectedStats && (
        <div data-testid="drilldown-stats" className="text-xs text-text-secondary">
          {selected}: total {selectedStats.total} • shallow {selectedStats.shallow} • deep{' '}
          {selectedStats.deep}
        </div>
      )}
    </section>
  );
}
