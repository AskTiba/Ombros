/**
 * Quality tiers: what the scene renders with, not what the data says.
 *
 * A tier is a display configuration — grid stride for decimation and a device
 * pixel ratio cap. The elevation numbers a risk readout reports must always
 * come from the full-resolution grid (see `decimateGrid`).
 *
 * Initial selection is heuristic and deliberately conservative: capability
 * signals can only demote (worst signal wins) and can never claim `high`.
 * Per the roadmap, `high` is reached only through *measured* performance —
 * a runtime frame-rate sampler promotes into it — because a marketing-grade
 * signal like 16GB of RAM says nothing about the GPU actually drawing the
 * scene. With no signal (Firefox and Safari expose neither `deviceMemory` nor
 * `connection`), the honest default is `medium`: not penalising devices we
 * know nothing about, and not spending pixels we have not earned.
 */

export type QualityTier = 'high' | 'medium' | 'low';

export type EffectiveConnectionType = 'slow-2g' | '2g' | '3g' | '4g';

export interface TierConfig {
  /** Grid stride passed to `decimateGrid` — 1 keeps full resolution. */
  stride: number;
  /** Upper bound applied to `window.devicePixelRatio` for the canvas. */
  maxPixelRatio: number;
}

export const TIER_CONFIGS: Record<QualityTier, TierConfig> = {
  high: { stride: 1, maxPixelRatio: 2 },
  medium: { stride: 2, maxPixelRatio: 1.5 },
  low: { stride: 4, maxPixelRatio: 1 },
};

export interface DeviceSignals {
  /** `navigator.deviceMemory` in gigabytes (Chromium only; absent elsewhere). */
  deviceMemoryGb?: number;
  /** `navigator.connection.effectiveType` (Chromium mobile). */
  effectiveType?: EffectiveConnectionType;
  /** `navigator.connection.saveData` — the user asking not to spend data. */
  saveData?: boolean;
}

const TIER_RANK: Record<QualityTier, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const connectionVote = (
  type: EffectiveConnectionType | undefined,
): QualityTier | null => {
  if (type === 'slow-2g' || type === '2g') return 'low';
  if (type === '3g') return 'medium';
  return null;
};

const memoryVote = (gb: number | undefined): QualityTier | null => {
  if (gb === undefined) return null;
  if (gb <= 2) return 'low';
  if (gb <= 4) return 'medium';
  return null;
};

/**
 * Heuristic first tier for a device we have not yet measured.
 *
 * Every available signal votes; the worst vote wins. No signal path returns
 * `high` — that tier is reserved for runtime-measured performance.
 */
export function selectInitialTier(signals: DeviceSignals): QualityTier {
  const votes: QualityTier[] = ['medium'];

  if (signals.saveData === true) votes.push('low');
  const onConnection = connectionVote(signals.effectiveType);
  if (onConnection) votes.push(onConnection);
  const onMemory = memoryVote(signals.deviceMemoryGb);
  if (onMemory) votes.push(onMemory);

  return votes.reduce((worst, vote) =>
    TIER_RANK[vote] < TIER_RANK[worst] ? vote : worst,
  );
}

const TIER_LADDER: QualityTier[] = ['low', 'medium', 'high'];

/**
 * Steps one tier toward the given direction, clamped at the ends — the
 * runtime sampler's single-notched path. `high` won't climb past the ceiling;
 * `low` won't fall through the floor.
 */
export function adjustTier(tier: QualityTier, direction: -1 | 1): QualityTier {
  const next = TIER_LADDER.indexOf(tier) + direction;
  return TIER_LADDER[Math.max(0, Math.min(TIER_LADDER.length - 1, next))];
}
