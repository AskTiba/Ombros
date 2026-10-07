import type { ScenarioBaseline } from './createBaselineScenario';

export interface RiskSummary {
  totalPoints: number;
  depthClassCounts: Record<string, number>;
  topSubCounties: Array<{ name: string; count: number }>;
  decisionNotes: string[];
}

export function summarizeRisk(scenario: ScenarioBaseline): RiskSummary {
  const depthClassCounts: Record<string, number> = {};
  const subCountyCounts: Record<string, number> = {};

  for (const point of scenario.extent) {
    depthClassCounts[point.depthClass] = (depthClassCounts[point.depthClass] ?? 0) + 1;
    const sc = scenario.tableSnapshot().rows.find((r) => r.pointId === point.id);
    const name = (sc?.['sub-county'] as string) ?? '—';
    subCountyCounts[name] = (subCountyCounts[name] ?? 0) + 1;
  }

  const topSubCounties = Object.entries(subCountyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  const decisionNotes = [
    `Total assessment points: ${scenario.extent.length}`,
    `Predominant depth class: ${
      Object.entries(depthClassCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'n/a'
    }`,
  ];

  return {
    totalPoints: scenario.extent.length,
    depthClassCounts,
    topSubCounties,
    decisionNotes,
  };
}
