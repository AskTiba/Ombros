import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBaselineScenario } from './createBaselineScenario';
import { SubCountyDrilldown } from './SubCountyDrilldown';

describe('SubCountyDrilldown', () => {
  it('lists sub-counties and shows drilldown stats when selected', async () => {
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

    render(<SubCountyDrilldown scenario={scenario} />);
    expect(
      screen.getByRole('region', { name: /sub-county drilldown/i }),
    ).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Makindye/i });
    btn.click();
    expect(await screen.findByTestId('drilldown-stats')).toHaveTextContent(
      /shallow|deep|total/i,
    );
  });

  it('tells a first-time user what to do with the controls', () => {
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

    render(<SubCountyDrilldown scenario={scenario} />);
    expect(screen.getByText(/pick an area|select an area/i)).toBeInTheDocument();
  });
});
