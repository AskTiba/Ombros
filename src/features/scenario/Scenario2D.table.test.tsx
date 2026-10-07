import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';
import { Scenario2D } from './Scenario2D';

describe('Scenario2D table', () => {
  it('renders an accessible table view of the baseline', () => {
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

    render(<Scenario2D scenario={scenario} variant="table" />);
    const table = screen.getByRole('table', { name: /flood extent baseline/i });
    expect(table).toBeInTheDocument();
    expect(screen.getByText('Makindye')).toBeInTheDocument();
  });
});
