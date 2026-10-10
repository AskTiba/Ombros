import { describe, expect, it } from 'vitest';

import { DEPTH_CLASSES, depthClassLabel } from '@/features/flood/types';

describe('DEPTH_CLASSES', () => {
  it('exposes the three thresholds published in the source study', () => {
    expect(DEPTH_CLASSES.map((c) => c.threshold)).toEqual([0.1, 0.2, 0.3]);
  });

  it('represents the deepest class as a floor, never a point value', () => {
    // "0.41 m" would be a measurement the study never took. A floor is the
    // strongest claim the data supports (ADR-003).
    const severe = DEPTH_CLASSES.find((c) => c.id === 'severe');
    expect(severe?.rangeLabel).toMatch(/^≥/);
    expect(severe?.rangeLabel).not.toMatch(/\d\.\d{2}/);
  });

  it('assigns each class a distinct band label', () => {
    const labels = DEPTH_CLASSES.map((c) => c.rangeLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('depthClassLabel', () => {
  it('resolves a known depth class to its band', () => {
    expect(depthClassLabel('moderate')).toBe('0.2–0.3 m');
  });

  it('falls back rather than throwing on an unknown id', () => {
    expect(depthClassLabel('catastrophic' as never)).toBe('Unknown');
  });
});
