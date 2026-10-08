import type { ScenarioBaseline } from './createBaselineScenario';

export interface RiskThresholds {
  shallowMaxM: number;
  deepMinM: number;
}

export interface RiskItem {
  pointId: string;
  depthMeters: number;
  riskClass: 'low' | 'medium' | 'high';
  subCounty: string;
}

export interface RiskReport {
  reportTitle: string;
  items: RiskItem[];
  decisionReady: boolean;
}

export function applyRiskThresholds(
  scenario: ScenarioBaseline,
  thresholds: RiskThresholds,
): RiskReport {
  const table = scenario.tableSnapshot();
  const items: RiskItem[] = scenario.extent.map((p, i) => {
    const depth = p.depthMeters;
    let riskClass: 'low' | 'medium' | 'high' = 'low';
    if (depth >= thresholds.deepMinM) riskClass = 'high';
    else if (depth > thresholds.shallowMaxM) riskClass = 'medium';
    else riskClass = 'low';
    const sc = (table.rows[i]?.['sub-county'] as string) ?? '—';
    return {
      pointId: p.id,
      depthMeters: depth,
      riskClass,
      subCounty: sc,
    };
  });
  return {
    reportTitle: `Risk report — ${scenario.id}`,
    items,
    decisionReady: true,
  };
}
