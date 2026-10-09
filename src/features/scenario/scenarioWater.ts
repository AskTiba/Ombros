import type { ScenarioBaseline } from './createBaselineScenario';

export interface WaterConfig {
  waterLevel: number;
  elevationOffset: number;
  colors: {
    water: string;
  };
}

export function scenarioWater(scenario: ScenarioBaseline): WaterConfig {
  const depths = scenario.extent.map((p) => p.depthMeters);
  // reduce, not Math.max(...depths, 0): a spread caps at the engine's argument
  // limit (~65k on several engines) and throws on a large extent. Seeded with 0
  // this is exactly Math.max(...depths, 0), and it matches the sum below.
  const maxDepth = depths.reduce((acc, depth) => (depth > acc ? depth : acc), 0);
  const avgDepth = depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;
  const waterLevel = avgDepth > 0 ? avgDepth * 2 : 0.1;
  return {
    waterLevel,
    elevationOffset: maxDepth * 0.3,
    colors: {
      water: '#2196f3',
    },
  };
}
