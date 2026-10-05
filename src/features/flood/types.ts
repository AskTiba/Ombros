import type { Feature } from 'geojson';

export const KAMPALA_BOUNDS = {
  south: 0.207,
  north: 0.409,
  west: 32.511,
  east: 32.684,
} as const;

export const DEPTH_CLASSES = [
  { id: 'shallow', label: 'Shallow', threshold: 0.1, rangeLabel: '0.1–0.2m' },
  { id: 'moderate', label: 'Moderate', threshold: 0.2, rangeLabel: '0.2–0.3m' },
  { id: 'severe', label: 'Severe', threshold: 0.3, rangeLabel: '>=0.3m' },
] as const;

export type DepthClassId = (typeof DEPTH_CLASSES)[number]['id'];
export type RainfallMm = 20 | 40 | 60 | 80 | 100;
export type DurationHours = 1 | 3 | 6;

export interface FloodExtentLayer {
  depthClass: DepthClassId;
  /** RFC 7946 GeoJSON. Polygons only — extents are closed rings. */
  feature: Feature;
}

export interface Scenario {
  rainfallMm: RainfallMm;
  durationHours: DurationHours;
}

/**
 * The source study published extent *class* layers, not continuous depth.
 * `>=0.3m` is deliberately labelled as a floor rather than a point value so
 * the UI can never imply precision the data does not contain (ADR-003).
 */
export const depthClassLabel = (id: DepthClassId): string =>
  DEPTH_CLASSES.find((c) => c.id === id)?.label ?? 'Unknown';

export const scenarioId = (scenario: Scenario): string =>
  `${scenario.rainfallMm}mm-${scenario.durationHours}h`;

export const allScenarios = (): Scenario[] =>
  [20, 40, 60, 80, 100].flatMap((rainfallMm) =>
    [1, 3, 6].map((durationHours) => ({ rainfallMm, durationHours })),
  ) as Scenario[];
