import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('states that 3D rendering is still unbuilt rather than showing a broken canvas', () => {
    render(<App />);

    expect(screen.getByTestId('scene-placeholder')).toBeInTheDocument();
  });
});
