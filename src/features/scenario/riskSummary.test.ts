import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';
import { summarizeRisk } from './riskSummary';

describe('summarizeRisk', () => {
  it('produces a decision-ready summary with depth class counts', () => {
    const scenario = createBaselineScenario({
      id: 'baseline-kampala-30min-20mm',
      name: '30-min, 20mm (baseline)',
      rainfallDepthMm: 20,
      durationMinutes: 30,
      label: 'Baseline: 30 min, 20 mm',
      subCounties: [
        { id: 'lc1', name: 'Makindye' },
        { id: 'lc2', name: 'Rubaga' },
      ],
    });

    const summary = summarizeRisk(scenario);
    expect(summary.totalPoints).toBe(2);
    expect(summary.depthClassCounts.shallow).toBe(1);
    expect(summary.depthClassCounts.deep).toBe(1);
    expect(summary.decisionNotes.length).toBeGreaterThan(0);
    expect(summary.topSubCounties).toBeDefined();
  });
});
