import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Hero } from './Hero';

describe('Hero', () => {
  it('leads with a decision-focused value proposition', () => {
    const { container } = render(<Hero />);

    expect(screen.getByRole('heading', { level: 2, name: /flood/i })).toBeInTheDocument();
    // States the outcome a buyer gets, not the rendering tech.
    expect(container.textContent).toMatch(/decision|planner|insurer|report/i);
  });

  it('names the concrete things a user can do with the tool', () => {
    const { container } = render(<Hero />);

    expect(container.textContent).toMatch(/sub-county/i);
    expect(container.textContent).toMatch(/export/i);
    expect(container.textContent).toMatch(/deep|depth/i);
  });

  it('gives a first-time user an ordered starting path', () => {
    render(<Hero />);

    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });
});
