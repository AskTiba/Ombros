import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';
import { scenarioWater } from './scenarioWater';

describe('scenarioWater', () => {
  it('provides a water surface mesh config from scenario data', () => {
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

    const water = scenarioWater(scenario);
    expect(water.waterLevel).toBeGreaterThan(0);
    expect(water.elevationOffset).toBeDefined();
    expect(water.colors.water).toBeDefined();
  });
});
