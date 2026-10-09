import type { ReactNode } from 'react';

import { summarizeRisk } from './riskSummary';
import type { ScenarioBaseline } from './createBaselineScenario';

export interface RiskSummaryCardProps {
  scenario: ScenarioBaseline;
}

export function riskSummaryCard({ scenario }: RiskSummaryCardProps): ReactNode {
  const summary = summarizeRisk(scenario);
  const threshold = (name: string) =>
    scenario.depthClasses.find((depthClass) => depthClass.name === name)?.depthMeters;

  const shallow = summary.depthClassCounts.shallow ?? 0;
  const deep = summary.depthClassCounts.deep ?? 0;
  const shallowThreshold = threshold('shallow');
  const deepThreshold = threshold('deep');

  return (
    <section
      aria-label="Risk summary"
      data-testid="risk-summary-card"
      className="rounded-md border border-border bg-surface-raised p-4 text-sm text-text-secondary"
    >
      <h2 className="text-sm font-medium text-text-primary">Decision-ready summary</h2>
      <p>
        {summary.totalPoints} points · {shallow} shallow
        {shallowThreshold !== undefined ? ` (≥ ${shallowThreshold} m)` : ''} · {deep} deep
        {deepThreshold !== undefined ? ` (≥ ${deepThreshold} m)` : ''}
      </p>
      <p className="mt-1 text-xs">
        Each point is one modelled flood location. Shallow means water about ankle deep;
        deep means knee deep or more.
      </p>
    </section>
  );
}
