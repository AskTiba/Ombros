import type { ReactNode } from 'react';

import { summarizeRisk } from './riskSummary';
import { Kpi } from './Kpi';
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

  return (
    <section
      aria-label="Risk summary"
      data-testid="risk-summary-card"
      className="card rise p-5"
    >
      <h2 className="text-base font-semibold text-text-primary">
        Decision-ready summary
      </h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Kpi value={summary.totalPoints} label="flood points" />
        <Kpi
          value={shallow}
          label="shallow"
          threshold={threshold('shallow')}
          swatch="var(--color-water-100)"
        />
        <Kpi
          value={deep}
          label="deep"
          threshold={threshold('deep')}
          swatch="var(--color-water-300)"
        />
      </div>
      <p className="mt-4 border-t border-border pt-3 text-xs text-text-secondary">
        Each point is one modelled flood location. Shallow means water about ankle deep;
        deep means knee deep or more.
      </p>
    </section>
  );
}
