import type { ReactNode } from 'react';

import { applyRiskThresholds } from './riskThresholds';
import type { ScenarioBaseline } from './createBaselineScenario';

export interface RiskReportProps {
  scenario: ScenarioBaseline;
  shallowMaxM: number;
  deepMinM: number;
}

export function riskReport({
  scenario,
  shallowMaxM,
  deepMinM,
}: RiskReportProps): ReactNode {
  const result = applyRiskThresholds(scenario, {
    shallowMaxM,
    deepMinM,
  });
  return (
    <section
      aria-label="Risk report"
      data-testid="risk-report"
      className="rounded-md border border-white/10 bg-surface-raised/40 p-4 text-xs text-text-secondary"
    >
      <h2 className="text-sm font-medium text-text-primary">Decision-ready report</h2>
      <p>{result.reportTitle}</p>
      <ul className="list-disc pl-5">
        {result.items.map((item) => (
          <li key={item.pointId}>
            {item.pointId}: {item.riskClass} ({item.depthMeters.toFixed(2)}m) —{' '}
            {item.subCounty}
          </li>
        ))}
      </ul>
    </section>
  );
}
