import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';

describe('createBaselineScenario with sub-county metadata', () => {
  it('includes sub-county labels and a stable table snapshot', () => {
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

    expect(scenario.subCounties).toBeDefined();
    expect(scenario.subCounties?.map((s) => s.name)).toContain('Makindye');
    expect(scenario.tableSnapshot().rows).toHaveLength(scenario.extent.length);
    expect(scenario.tableSnapshot().headers).toContain('depth (m)');
    expect(scenario.tableSnapshot().rows[0]).toHaveProperty('subCounty');
  });
});
