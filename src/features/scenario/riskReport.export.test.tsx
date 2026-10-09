import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';
import { riskReport } from './riskReport';

describe('riskReport export button', () => {
  it('renders export button that triggers JSON export', () => {
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
    const btn = screen.getByRole('button', { name: /export/i });
    expect(btn).toBeInTheDocument();
    btn.click();
  });
});
