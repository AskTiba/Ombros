import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SAMPLER_OPTIONS,
  sampleFrameTime,
  type FrameRateState,
  type SamplerOptions,
} from './frameRateSampler';
import type { QualityTier } from './qualityTiers';

const runWindows = (
  frameTimeMs: number,
  windows: number,
  currentTier: QualityTier = 'medium',
  options: SamplerOptions = { ...DEFAULT_SAMPLER_OPTIONS, windowFrames: 60 },
) => {
  let state: FrameRateState = { frames: 0, sumMs: 0, streak: 0 };
  let result = { fps: null as number | null, verdict: 'hold' as string };

  for (let w = 0; w < windows; w += 1) {
    for (let i = 0; i < options.windowFrames; i += 1) {
      ({ state, result } = sampleFrameTime(state, frameTimeMs, options, currentTier));
    }
  }
  return { state, result };
};

describe('sampleFrameTime', () => {
  it('accumulates frames and reports no verdict until the window fills', () => {
    const state: FrameRateState = { frames: 0, sumMs: 0, streak: 0 };

    const { state: next, result } = sampleFrameTime(state, 16.6, {
      ...DEFAULT_SAMPLER_OPTIONS,
      windowFrames: 60,
    });

    expect(next.frames).toBe(1);
    expect(next.sumMs).toBeCloseTo(16.6);
    expect(result.fps).toBeNull();
    expect(result.verdict).toBe('hold');
  });

  it('reports fps once the window is full and resets the accumulator', () => {
    const { state, result } = runWindows(16.6, 1);

    expect(result.fps).toBeCloseTo(1000 / 16.6, 0);
    expect(state.frames).toBe(0);
    expect(state.sumMs).toBe(0);
  });

  it('demotes immediately when the window measures below the fps floor', () => {
    const { result } = runWindows(1000 / 25, 1);

    expect(result.verdict).toBe('demote');
  });

  it('holds inside the hysteresis band between demote and promote thresholds', () => {
    const { result } = runWindows(1000 / 45, 1);

    expect(result.verdict).toBe('hold');
  });

  it('promotes above headroom only after the required streak of windows', () => {
    const frame = 1000 / 71;

    expect(runWindows(frame, 1).result.verdict).toBe('hold');
    expect(runWindows(frame, 1).state.streak).toBe(1);

    const partial = runWindows(frame, 2);
    expect(partial.result.verdict).toBe('hold');
    expect(partial.state.streak).toBe(2);

    const full = runWindows(frame, 3);
    expect(full.result.verdict).toBe('promote');
    expect(full.state.streak).toBe(0);
  });

  it('a demotion wins instantly over a pending promotion streak', () => {
    const options = { ...DEFAULT_SAMPLER_OPTIONS, windowFrames: 60 };
    let state: FrameRateState = { frames: 0, sumMs: 0, streak: 0 };
    let result = { fps: null as number | null, verdict: 'hold' as string };

    for (let i = 0; i < 60; i += 1) {
      ({ state } = sampleFrameTime(state, 1000 / 71, options));
    }
    expect(state.streak).toBe(1);

    for (let i = 0; i < 60; i += 1) {
      ({ state, result } = sampleFrameTime(state, 1000 / 25, options));
    }
    expect(result.verdict).toBe('demote');
    expect(state.streak).toBe(0);
  });

  it('never promotes past high or demotes past low', () => {
    expect(runWindows(1000 / 71, 3, 'high').result.verdict).toBe('hold');
    expect(runWindows(1000 / 20, 1, 'low').result.verdict).toBe('hold');
  });

  it('ships sane defaults: a nonzero hysteresis band and a streak above one', () => {
    const d = DEFAULT_SAMPLER_OPTIONS;
    expect(d.windowFrames).toBeGreaterThan(0);
    expect(d.requiredStreak).toBeGreaterThan(1);
    expect(d.demoteBelowFps).toBeLessThan(d.promoteAboveFps);
  });
});
