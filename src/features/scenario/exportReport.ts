import { applyRiskThresholds } from './riskThresholds';
import type { ScenarioBaseline } from './createBaselineScenario';

export interface ExportOptions {
  shallowMaxM: number;
  deepMinM: number;
  format: 'json' | 'csv';
}

export function exportReport(scenario: ScenarioBaseline, options: ExportOptions): string {
  const result = applyRiskThresholds(scenario, {
    shallowMaxM: options.shallowMaxM,
    deepMinM: options.deepMinM,
  });
  if (options.format === 'csv') {
    const headers = ['pointId', 'depthMeters', 'riskClass', 'subCounty'];
    const rows = result.items.map((item) => {
      const fields = [
        item.pointId,
        item.depthMeters.toFixed(2),
        item.riskClass,
        item.subCounty,
      ];
      return fields.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',');
    });
    return [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n');
  }
  return JSON.stringify(
    {
      ...result,
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}
