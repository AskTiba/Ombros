import type { ReactNode } from 'react';

/**
 * A single KPI figure for the risk summary. The number is the focal point
 * (large tabular numeral); the label and optional depth threshold give it
 * plain-language context, and an optional swatch ties shallow/deep tiles to
 * the depth-class ramp used on the map (ADR-003).
 */
export interface KpiProps {
  value: number;
  label: string;
  threshold?: number | undefined;
  swatch?: string | undefined;
}

export function Kpi({ value, label, threshold, swatch }: KpiProps): ReactNode {
  return (
    <div data-testid="kpi" className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        {swatch ? (
          <span
            aria-hidden="true"
            className="h-3 w-3 shrink-0 self-center rounded-full"
            style={{ backgroundColor: swatch }}
          />
        ) : null}
        <span className="text-3xl font-semibold tabular-nums text-text-primary">
          {value}
        </span>
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      {threshold !== undefined ? (
        <span className="text-xs text-text-secondary">≥ {threshold} m</span>
      ) : null}
    </div>
  );
}
