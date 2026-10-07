import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';

describe('createBaselineScenario', () => {
  it('creates a deterministic baseline with a known flood depth class set', () => {
    const scenario = createBaselineScenario({
      id: 'baseline-kampala-30min-20mm',
      name: '30-min, 20mm (baseline)',
      rainfallDepthMm: 20,
      durationMinutes: 30,
      label: 'Baseline: 30 min, 20 mm',
    });

    expect(scenario.id).toBe('baseline-kampala-30min-20mm');
    expect(scenario.depthClasses).toContainEqual({
      depthMeters: 0.15,
      name: 'shallow',
    });
    expect(scenario.depthClasses).toContainEqual({
      depthMeters: 0.5,
      name: 'deep',
    });
    expect(scenario.extent).toHaveLength(2);
    expect(scenario.extent[0].coords.coordinates).toHaveLength(2);
    expect(new Set(scenario.extent.map((p) => p.depthClass)).size).toBeGreaterThan(0);
    expect(scenario.extent.every((p) => Number.isFinite(p.depthMeters))).toBe(true);
  });

  it('exposes a stable snapshot string suitable for regression testing', () => {
    const a = createBaselineScenario({
      id: 'baseline-a',
      name: '30-min, 20mm',
      rainfallDepthMm: 20,
      durationMinutes: 30,
      label: 'Baseline A',
    });
    const b = createBaselineScenario({
      id: 'baseline-a',
      name: '30-min, 20mm',
      rainfallDepthMm: 20,
      durationMinutes: 30,
      label: 'Baseline A',
    });

    expect(a.toSnapshot()).toBe(b.toSnapshot());
  });
});
