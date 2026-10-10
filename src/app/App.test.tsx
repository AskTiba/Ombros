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
      screen.getByRole('region', { name: /kampala terrain map/i }),
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

    const map = screen.getByRole('heading', { name: /terrain and wetlands/i });
    const scene = screen.getByTestId('scene-fallback');
    const drilldown = screen.getByRole('region', { name: /sub-county drilldown/i });

    const follows = (node: Element, other: Node) =>
      (node.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    expect(follows(map, scene)).toBe(true);
    expect(follows(scene, drilldown)).toBe(true);
  });

  it('does not advertise a flood map the product cannot yet produce', () => {
    // No hydrodynamic result is loaded (ADR-001). Calling the map a flood map
    // would claim a capability the code does not have — the thing that made
    // the old placeholder unreadable.
    render(<App />);

    expect(screen.queryByRole('heading', { name: /flood map/i })).toBeNull();
  });

  it('tells a first-time user what the tool is for', () => {
    render(<App />);

    // The value proposition is the first heading after the product h1.
    expect(screen.getByRole('heading', { level: 2, name: /flood/i })).toBeInTheDocument();
  });
});
