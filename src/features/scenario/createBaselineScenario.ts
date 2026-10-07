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

export interface SubCounty {
  id: string;
  name: string;
}

export interface ScenarioBaselineInput {
  id: string;
  name: string;
  rainfallDepthMm: number;
  durationMinutes: number;
  label: string;
  subCounties?: SubCounty[];
}

export interface ScenarioBaseline {
  id: string;
  name: string;
  rainfallDepthMm: number;
  durationMinutes: number;
  label: string;
  depthClasses: DepthClass[];
  extent: ScenarioExtentPoint[];
  subCounties?: SubCounty[];
  toSnapshot(): string;
  tableSnapshot(): {
    headers: string[];
    rows: Array<Record<string, string | number>>;
  };
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
    ...(input.subCounties ? { subCounties: input.subCounties } : {}),
    depthClasses,
    extent,
    toSnapshot() {
      return `${this.id}|${this.name}|${this.extent
        .map((p) => `${p.id}:${p.depthMeters}`)
        .join(',')}`;
    },
    tableSnapshot() {
      const subCounties = this.subCounties ?? [];
      return {
        headers: ['point id', 'depth (m)', 'class', 'sub-county', 'subCounty'],
        rows: this.extent.map((p, i) => ({
          pointId: p.id,
          depthMeters: Number(p.depthMeters.toFixed(2)),
          class: p.depthClass,
          subCounty: subCounties[i % (subCounties.length || 1)]?.name ?? '—',
          'sub-county': subCounties[i % (subCounties.length || 1)]?.name ?? '—',
        })),
      };
    },
  };
}
