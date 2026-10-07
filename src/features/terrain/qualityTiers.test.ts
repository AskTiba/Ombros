import { describe, expect, it } from 'vitest';

import { decimateGrid } from './decimateGrid';
import {
  TIER_CONFIGS,
  adjustTier,
  selectInitialTier,
  type DeviceSignals,
} from './qualityTiers';

describe('selectInitialTier', () => {
  it('defaults to medium when no signal is available', () => {
    expect(selectInitialTier({})).toBe('medium');
  });

  it('demotes to low when the user asked to save data', () => {
    expect(selectInitialTier({ saveData: true })).toBe('low');
    expect(selectInitialTier({ saveData: false, deviceMemoryGb: 16 })).toBe('medium');
  });

  it('demotes to low on slow connection types but keeps medium on 3g', () => {
    expect(selectInitialTier({ effectiveType: 'slow-2g' })).toBe('low');
    expect(selectInitialTier({ effectiveType: '2g' })).toBe('low');
    expect(selectInitialTier({ effectiveType: '3g' })).toBe('medium');
    expect(selectInitialTier({ effectiveType: '4g' })).toBe('medium');
  });

  it('demotes to low at 2GB of device memory and allows medium at 4GB', () => {
    expect(selectInitialTier({ deviceMemoryGb: 2 })).toBe('low');
    expect(selectInitialTier({ deviceMemoryGb: 4 })).toBe('medium');
    expect(selectInitialTier({ deviceMemoryGb: 16 })).toBe('medium');
  });

  it('lets the worst signal win when signals disagree', () => {
    expect(selectInitialTier({ deviceMemoryGb: 16, saveData: true })).toBe('low');
    expect(selectInitialTier({ deviceMemoryGb: 2, effectiveType: '4g' })).toBe('low');
    expect(selectInitialTier({ deviceMemoryGb: 4, effectiveType: 'slow-2g' })).toBe(
      'low',
    );
  });

  it('never claims high on capability signals alone', () => {
    const bestPossible: DeviceSignals = {
      deviceMemoryGb: 16,
      effectiveType: '4g',
      saveData: false,
    };

    expect(selectInitialTier(bestPossible)).toBe('medium');
  });
});

describe('TIER_CONFIGS', () => {
  it('maps every tier to an integer stride of at least 1 and a usable pixel-ratio cap', () => {
    for (const tier of ['high', 'medium', 'low'] as const) {
      const config = TIER_CONFIGS[tier];
      expect(Number.isInteger(config.stride)).toBe(true);
      expect(config.stride).toBeGreaterThanOrEqual(1);
      expect(config.maxPixelRatio).toBeGreaterThanOrEqual(1);
    }
  });

  it('spreads strides across the scene so each tier decimates the full grid differently', () => {
    const source = {
      samples: new Float32Array(15).fill(1100),
      rows: 5,
      cols: 3,
      widthMeters: 60,
      depthMeters: 120,
      minElevationMeters: 1100,
      maxElevationMeters: 1100,
    };

    const high = decimateGrid(source, TIER_CONFIGS.high.stride);
    const medium = decimateGrid(source, TIER_CONFIGS.medium.stride);
    const low = decimateGrid(source, TIER_CONFIGS.low.stride);

    expect(high.rows * high.cols).toBe(source.rows * source.cols);
    expect(medium.rows * medium.cols).toBeLessThan(high.rows * high.cols);
    expect(low.rows * low.cols).toBeLessThan(medium.rows * medium.cols);
    expect(low.rows).toBeGreaterThanOrEqual(2);
    expect(low.cols).toBeGreaterThanOrEqual(2);
  });
});

describe('adjustTier', () => {
  it('moves one notch in the requested direction and clamps at the ends', () => {
    expect(adjustTier('low', -1)).toBe('low');
    expect(adjustTier('low', 1)).toBe('medium');
    expect(adjustTier('medium', 1)).toBe('high');
    expect(adjustTier('high', 1)).toBe('high');
    expect(adjustTier('high', -1)).toBe('medium');
    expect(adjustTier('medium', -1)).toBe('low');
  });
});
