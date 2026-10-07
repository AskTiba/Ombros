import type { QualityTier } from './qualityTiers';

/**
 * Quality-tier policy for the running scene (Unit 1d).
 *
 * Two numbers decide whether the device earns its tier: the fps floor below
 * which the scene is visibly wrong, and a headroom above which promotion is
 * affordable. Both are chosen so the hysteresis band is real: a device sitting
 * between 30 and 55fps is left alone rather than flapped.
 *
 * Demotion is immediate — a full 60-frame window at ~25fps is two and a half
 * seconds of sustained under-performance, not a blip — while promotion waits
 * for `requiredStreak` consecutive agreeing windows, because a surge of
 * headroom is often a moment where nothing complex was on screen.
 */

export type TierVerdict = 'promote' | 'demote' | 'hold';

export interface SamplerOptions {
  /** Frames per window before the frame rate is judged. */
  windowFrames: number;
  /** Sustained fps below this demotes one tier. */
  demoteBelowFps: number;
  /** Sustained fps above this can promote one tier, one notch at a time. */
  promoteAboveFps: number;
  /** Consecutive qualifying windows required before a promotion acts. */
  requiredStreak: number;
}

export const DEFAULT_SAMPLER_OPTIONS: SamplerOptions = {
  windowFrames: 60,
  demoteBelowFps: 30,
  promoteAboveFps: 55,
  requiredStreak: 3,
};

export interface FrameRateState {
  frames: number;
  sumMs: number;
  streak: number;
}

export interface FrameRateMeasure {
  /** Average fps of the just-closed window, or null mid-window. */
  fps: number | null;
  verdict: TierVerdict;
}

/**
 * Feeds one frame's duration into the sampler (pure — returns a new state).
 *
 * `frameTimeMs` is the R3F `useFrame` delta scaled to milliseconds and must be
 * positive. The verdict is only meaningful on windows (every `windowFrames`
 * calls); mid-window the fps is null and the verdict is always `hold`.
 */
export function sampleFrameTime(
  state: FrameRateState,
  frameTimeMs: number,
  options: SamplerOptions = DEFAULT_SAMPLER_OPTIONS,
  currentTier: QualityTier = 'medium',
): { state: FrameRateState; result: FrameRateMeasure } {
  const accumulating: FrameRateState = {
    frames: state.frames + 1,
    sumMs: state.sumMs + frameTimeMs,
    streak: state.streak,
  };

  if (accumulating.frames < options.windowFrames) {
    return {
      state: accumulating,
      result: { fps: null, verdict: 'hold' },
    };
  }

  const fps = accumulating.frames / (accumulating.sumMs / 1000);
  const underFloor = fps < options.demoteBelowFps;
  const aboveHeadroom = fps > options.promoteAboveFps;

  let verdict: TierVerdict = 'hold';
  let streak: number = 0;

  if (underFloor && currentTier !== 'low') {
    verdict = 'demote';
  } else if (aboveHeadroom && currentTier !== 'high') {
    streak = accumulating.streak + 1;
    if (streak >= options.requiredStreak) {
      verdict = 'promote';
      streak = 0;
    }
  }

  return {
    state: { frames: 0, sumMs: 0, streak },
    result: { fps, verdict },
  };
}
