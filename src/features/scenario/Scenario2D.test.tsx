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

  it('colors extent points with design tokens, never hardcoded hex', () => {
    const scenario = createBaselineScenario({
      id: 'baseline-a',
      name: '30-min, 20mm',
      rainfallDepthMm: 20,
      durationMinutes: 30,
      label: 'Baseline A',
    });

    const { container } = render(<Scenario2D scenario={scenario} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
    for (const circle of circles) {
      const fill = circle.getAttribute('fill') ?? '';
      // A token reference is a CSS custom property; a literal hex is not.
      expect(fill).toMatch(/^var\(--color-water-/);
      expect(fill).not.toMatch(/^#/);
    }
  });
});
