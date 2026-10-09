import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';
import { exportReport } from './exportReport';

describe('exportReport', () => {
  it('exports report as JSON with metadata', () => {
    const scenario = createBaselineScenario({
      id: 'baseline-a',
      name: '30-min, 20mm',
      rainfallDepthMm: 20,
      durationMinutes: 30,
      label: 'Baseline A',
      subCounties: [
        { id: 'lc1', name: 'Makindye' },
        { id: 'lc2', name: 'Rubaga' },
      ],
    });

    const json = exportReport(scenario, {
      shallowMaxM: 0.3,
      deepMinM: 0.4,
      format: 'json',
    });
    const parsed = JSON.parse(json);
    expect(parsed.reportTitle).toBe('Risk report — baseline-a');
    expect(parsed.decisionReady).toBe(true);
    expect(parsed.exportedAt).toBeDefined();
  });

  it('exports report as CSV', () => {
    const scenario = createBaselineScenario({
      id: 'baseline-a',
      name: '30-min, 20mm',
      rainfallDepthMm: 20,
      durationMinutes: 30,
      label: 'Baseline A',
      subCounties: [
        { id: 'lc1', name: 'Makindye' },
        { id: 'lc2', name: 'Rubaga' },
      ],
    });

    const csv = exportReport(scenario, {
      shallowMaxM: 0.3,
      deepMinM: 0.4,
      format: 'csv',
    });
    expect(csv).toContain('pointId');
    expect(csv).toContain('riskClass');
  });
});
