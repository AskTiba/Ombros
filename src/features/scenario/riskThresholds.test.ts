import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';
import { applyRiskThresholds } from './riskThresholds';

describe('applyRiskThresholds', () => {
  it('classifies points by depth thresholds and produces a decision-ready report', () => {
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

    const result = applyRiskThresholds(scenario, { shallowMaxM: 0.3, deepMinM: 0.4 });
    expect(result.reportTitle).toBe('Risk report — baseline-a');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toHaveProperty('riskClass');
    expect(result.decisionReady).toBe(true);
  });
});
