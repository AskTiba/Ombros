import type { ReactNode } from 'react';

import { applyRiskThresholds } from './riskThresholds';
import { exportReport } from './exportReport';
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
  const handleExport = () => {
    const json = exportReport(scenario, {
      shallowMaxM,
      deepMinM,
      format: 'json',
    });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scenario.id}-report.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
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
      <button
        type="button"
        onClick={handleExport}
        className="rounded border border-white/10 px-3 py-1 text-xs text-text-primary"
      >
        Export JSON
      </button>
    </section>
  );
}
