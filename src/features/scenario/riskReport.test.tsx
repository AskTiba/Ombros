import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';
import { riskReport } from './riskReport';

describe('riskReport', () => {
  it('renders a decision-ready report component', () => {
    const scenario = createBaselineScenario({
      id: 'baseline-a',
      name: '30-min, 20mm',
      rainfallDepthMm: 20,
      durationMinutes: 30,
      label: 'Baseline A',
      subCounties: [
        { id: 'lc1', name: 'Makindye' },
        { id: 'lc2', name: 'Rubaga' },
      ],
    });

    render(riskReport({ scenario, shallowMaxM: 0.3, deepMinM: 0.4 }));
    expect(screen.getByRole('region', { name: /risk report/i })).toBeInTheDocument();
    expect(screen.getByTestId('risk-report')).toHaveTextContent(/Decision-ready/i);
  });

  it('describes what the report is for, in plain language', () => {
    const scenario = createBaselineScenario({
      id: 'baseline-a',
      name: '30-min, 20mm',
      rainfallDepthMm: 20,
      durationMinutes: 30,
      label: 'Baseline A',
      subCounties: [
        { id: 'lc1', name: 'Makindye' },
        { id: 'lc2', name: 'Rubaga' },
      ],
    });

    render(riskReport({ scenario, shallowMaxM: 0.3, deepMinM: 0.4 }));
    expect(screen.getByTestId('risk-report')).toHaveTextContent(/planner|insurer|share/i);
  });
});
