import type { ReactNode } from 'react';

import { summarizeRisk } from './riskSummary';
import type { ScenarioBaseline } from './createBaselineScenario';

export interface RiskSummaryCardProps {
  scenario: ScenarioBaseline;
}

export function riskSummaryCard({ scenario }: RiskSummaryCardProps): ReactNode {
  const summary = summarizeRisk(scenario);
  return (
    <section
      aria-label="Risk summary"
      data-testid="risk-summary-card"
      className="rounded-md border border-border bg-surface-raised p-4 text-sm text-text-secondary"
    >
      <h2 className="text-sm font-medium text-text-primary">Decision-ready summary</h2>
      <p>
        {summary.totalPoints} points • shallow: {summary.depthClassCounts.shallow ?? 0} •
        deep: {summary.depthClassCounts.deep ?? 0}
      </p>
    </section>
  );
}
