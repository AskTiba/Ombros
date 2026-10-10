/**
 * The depth bands the source study publishes.
 *
 * This is the one domain fact the flood feature has that is neither a binary
 * format detail nor a scenario axis: McClean et al. (2021) release extents at
 * three depth *thresholds* and nothing in between. Naming them once here is
 * what stops the legend, the caption and the report from each inventing their
 * own wording — and from ever writing a point depth the data does not hold
 * (ADR-003, ERR-001).
 *
 * `rangeLabel` is deliberately a band ("0.2–0.3 m") and the top class a floor
 * ("≥ 0.3 m"), so no string in the product can imply a measurement at one
 * location.
 */
export const DEPTH_CLASSES = [
  { id: 'shallow', threshold: 0.1, rangeLabel: '0.1–0.2 m' },
  { id: 'moderate', threshold: 0.2, rangeLabel: '0.2–0.3 m' },
  { id: 'severe', threshold: 0.3, rangeLabel: '≥ 0.3 m' },
] as const;

export type DepthClassId = (typeof DEPTH_CLASSES)[number]['id'];

export function depthClassLabel(id: DepthClassId): string {
  return DEPTH_CLASSES.find((c) => c.id === id)?.rangeLabel ?? 'Unknown';
}
