import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';
import { Scenario2D } from './Scenario2D';

describe('Scenario2D', () => {
  it('renders a non-WebGL view with the baseline label and an SVG', () => {
    const scenario = createBaselineScenario({
      id: 'baseline-a',
      name: '30-min, 20mm',
      rainfallDepthMm: 20,
      durationMinutes: 30,
      label: 'Baseline A',
    });

    render(<Scenario2D scenario={scenario} />);
    expect(screen.getByText(/Baseline A/i)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Kampala flood extent/i }),
    ).toBeInTheDocument();
  });
});
