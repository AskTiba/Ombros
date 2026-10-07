import type { Point } from 'geojson';

export type DepthClassName = 'shallow' | 'deep';

export interface DepthClass {
  depthMeters: number;
  name: DepthClassName;
}

export interface ScenarioExtentPoint {
  id: string;
  /** Geometry in Kampala CRS placeholder — lon/lat for now. */
  coords: Point;
  depthMeters: number;
  depthClass: DepthClassName;
}

export interface ScenarioBaselineInput {
  id: string;
  name: string;
  rainfallDepthMm: number;
  durationMinutes: number;
  label: string;
}

export interface ScenarioBaseline {
  id: string;
  name: string;
  rainfallDepthMm: number;
  durationMinutes: number;
  label: string;
  depthClasses: DepthClass[];
  extent: ScenarioExtentPoint[];
  toSnapshot(): string;
}

export function createBaselineScenario(input: ScenarioBaselineInput): ScenarioBaseline {
  const depthClasses: DepthClass[] = [
    { depthMeters: 0.15, name: 'shallow' },
    { depthMeters: 0.5, name: 'deep' },
  ];

  const extent: ScenarioExtentPoint[] = [
    {
      id: 'p001',
      coords: {
        type: 'Point',
        coordinates: [32.586, 0.313],
      },
      depthMeters: 0.25,
      depthClass: 'shallow',
    },
    {
      id: 'p002',
      coords: {
        type: 'Point',
        coordinates: [32.591, 0.315],
      },
      depthMeters: 0.55,
      depthClass: 'deep',
    },
  ];

  return {
    id: input.id,
    name: input.name,
    rainfallDepthMm: input.rainfallDepthMm,
    durationMinutes: input.durationMinutes,
    label: input.label,
    depthClasses,
    extent,
    toSnapshot() {
      return `${this.id}|${this.name}|${this.extent
        .map((p) => `${p.id}:${p.depthMeters}`)
        .join(',')}`;
    },
  };
}
