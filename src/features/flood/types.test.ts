import { describe, expect, it } from 'vitest';
import {
  allScenarios,
  DEPTH_CLASSES,
  depthClassLabel,
  scenarioId,
} from '@/features/flood/types';

describe('flood scenario domain types', () => {
  describe('DEPTH_CLASSES', () => {
    it('exposes the three thresholds published in the source study', () => {
      expect(DEPTH_CLASSES.map((c) => c.threshold)).toEqual([0.1, 0.2, 0.3]);
    });

    it('represents severe depth as a floor, not a point value', () => {
      const severe = DEPTH_CLASSES.find((c) => c.id === 'severe');
      expect(severe?.rangeLabel).toBe('>=0.3m');
    });

    it('assigns each class a non-overlapping range label', () => {
      const labels = DEPTH_CLASSES.map((c) => c.rangeLabel);
      expect(new Set(labels).size).toBe(labels.length);
    });
  });

  describe('depthClassLabel', () => {
    it('resolves a known depth class', () => {
      expect(depthClassLabel('moderate')).toBe('Moderate');
    });

    it('falls back rather than throwing on an unknown id', () => {
      expect(depthClassLabel('catastrophic' as never)).toBe('Unknown');
    });
  });

  describe('scenarioId', () => {
    it('is stable for the same scenario', () => {
      expect(scenarioId({ rainfallMm: 60, durationHours: 3 })).toBe('60mm-3h');
    });

    it('distinguishes identical rainfall at different durations', () => {
      const short = scenarioId({ rainfallMm: 80, durationHours: 1 });
      const long = scenarioId({ rainfallMm: 80, durationHours: 6 });
      expect(short).not.toBe(long);
    });
  });

  describe('allScenarios', () => {
    it('covers the full published grid of 5 rainfall depths by 3 durations', () => {
      expect(allScenarios()).toHaveLength(15);
    });

    it('yields no duplicate scenario ids', () => {
      const ids = allScenarios().map(scenarioId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
