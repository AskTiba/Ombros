import type { ScenarioBaseline } from './createBaselineScenario';

/**
 * A minimal 2D view of the scenario baseline for progressive enhancement
 * (ADR-002). Rendering to SVG or a table must never require WebGL; the 3D
 * path builds on the exact same payload.
 */
export interface Scenario2DProps {
  scenario: ScenarioBaseline;
}

export function Scenario2D({ scenario }: Scenario2DProps) {
  return (
    <figure aria-label="Flood extent baseline (2D)">
      <svg role="img" aria-labelledby="baseline-title baseline-desc" viewBox="0 0 120 80">
        <title id="baseline-title">Kampala flood extent — baseline</title>
        <desc id="baseline-desc">
          Two sample points showing shallow and deep flood depths
        </desc>
        <g>
          {scenario.extent.map((point) => {
            const cx = 40 + (point.coords.coordinates[0] - 32.586) * 2000;
            const cy = 60 - (point.coords.coordinates[1] - 0.313) * 8000;
            const r = point.depthClass === 'deep' ? 8 : 5;
            return (
              <circle
                key={point.id}
                cx={cx}
                cy={cy}
                r={r}
                fill={point.depthClass === 'deep' ? '#1e88e5' : '#90caf9'}
                opacity={0.7}
              />
            );
          })}
        </g>
      </svg>
      <figcaption className="text-xs text-text-secondary">
        Baseline: {scenario.label}
      </figcaption>
    </figure>
  );
}
