import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the application landmark structure', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('names the product so the page has a title for assistive tech', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /ombros/i })).toBeInTheDocument();
  });

  it('offers the accessible fallback when WebGL2 is unavailable', () => {
    render(<App />);

    expect(screen.getByTestId('scene-fallback')).toBeInTheDocument();
    expect(screen.getByText(/webgl2/i)).toBeInTheDocument();
    expect(screen.queryByTestId('r3f-canvas')).not.toBeInTheDocument();
  });

  it('shows the 2D scenario baseline for progressive enhancement', () => {
    render(<App />);

    expect(screen.getByText(/Baseline: 30 min, 20 mm/i)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Kampala flood extent/i }),
    ).toBeInTheDocument();
  });
});
