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

  it('offers the accessible fallback when WebGL2 is unavailable', () => {
    render(<App />);

    expect(screen.getByTestId('scene-fallback')).toBeInTheDocument();
    expect(screen.getByText(/webgl2/i)).toBeInTheDocument();
    expect(screen.queryByTestId('r3f-canvas')).not.toBeInTheDocument();
  });

  it('shows an accessible 2D map of the terrain for progressive enhancement', () => {
    render(<App />);

    expect(
      screen.getByRole('region', { name: /kampala flood extent map/i }),
    ).toBeInTheDocument();
  });

  it('shows a decision-ready risk summary', () => {
    render(<App />);

    const card = screen.getByTestId('risk-summary-card');
    expect(card).toHaveTextContent(/points/i);
    expect(card).toHaveTextContent(/shallow/i);
    expect(card).toHaveTextContent(/deep/i);
  });

  it('exposes sub-county drilldown controls', () => {
    render(<App />);

    expect(
      screen.getByRole('region', { name: /sub-county drilldown/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Makindye/i })).toBeInTheDocument();
  });

  it('shows a decision-ready report section', () => {
    render(<App />);

    expect(screen.getByRole('region', { name: /risk report/i })).toBeInTheDocument();
    expect(screen.getByTestId('risk-report')).toHaveTextContent(/Decision-ready/i);
  });

  it('offers a skip-to-content link that targets the main landmark', () => {
    render(<App />);

    const skip = screen.getByRole('link', { name: /skip to content/i });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('keeps the product header sticky so orientation persists on scroll', () => {
    render(<App />);

    const header = screen.getByTestId('app-header');
    expect(header.className).toMatch(/sticky/);
  });

  it('keeps the 3D scene between the accessible 2D map and the analysis tools', () => {
    render(<App />);

    const map = screen.getByRole('heading', { name: /modelled flood extent/i });
    const scene = screen.getByTestId('scene-fallback');
    const drilldown = screen.getByRole('region', { name: /sub-county drilldown/i });

    const follows = (node: Element, other: Node) =>
      (node.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    expect(follows(map, scene)).toBe(true);
    expect(follows(scene, drilldown)).toBe(true);
  });

  it('claims a flood extent map, which is now a capability the code has', () => {
    // ADR-001 forbids our own solver, not consuming published modelling. The
    // section was labelled "terrain and wetlands" while the map could show no
    // water; it is named for what it now shows. The source attribution itself
    // is asserted in TerrainMap2D's own tests, where the assets are served.
    render(<App />);

    expect(
      screen.getByRole('region', { name: /kampala flood extent map/i }),
    ).toBeInTheDocument();
  });

  it('tells a first-time user what the tool is for', () => {
    render(<App />);

    // The value proposition is the first heading after the product h1.
    expect(screen.getByRole('heading', { level: 2, name: /flood/i })).toBeInTheDocument();
  });
});
