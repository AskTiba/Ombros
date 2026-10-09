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
      className="card rise flex flex-col p-5"
    >
      <h2 className="text-base font-semibold text-text-primary">Decision-ready report</h2>
      <p className="mt-1 text-sm text-text-secondary">
        A one-page summary of every modelled flood location — ready to hand to a planner,
        insurer, or funding body.
      </p>
      <p className="mt-3 text-sm text-text-primary">{result.reportTitle}</p>
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
        {result.items.map((item) => (
          <li
            key={item.pointId}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm"
          >
            <span className="font-medium text-text-primary">{item.pointId}</span>
            <span className="text-text-secondary">
              {item.riskClass} · {item.depthMeters.toFixed(2)}m · {item.subCounty}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleExport}
        className="btn btn-primary mt-4 self-start"
      >
        Export report (JSON)
      </button>
    </section>
  );
}
