import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';
import { riskSummaryCard } from './riskSummaryCard';

describe('riskSummaryCard', () => {
  it('renders a compact decision-ready summary card', () => {
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

    render(riskSummaryCard({ scenario }));
    expect(screen.getByRole('region', { name: /risk summary/i })).toBeInTheDocument();
    expect(screen.getByText(/Decision-ready/i)).toBeInTheDocument();
    expect(screen.getByTestId('risk-summary-card')).toHaveTextContent(/shallow|deep/i);
  });
});
