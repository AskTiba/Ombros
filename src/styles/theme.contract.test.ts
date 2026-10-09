import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

/**
 * Design-system foundation contract (ADR-014).
 *
 * The theming layer is the base every surface builds on. jsdom cannot resolve
 * `prefers-color-scheme` or CSS custom properties, so these assertions pin the
 * source of truth directly: light and dark token blocks must exist in
 * `globals.css`, and the document must opt into system theming.
 */
describe('theme contract', () => {
  const css = read('../styles/globals.css');
  const html = read('../../index.html');

  it('declares a light (default) token block with semantic colors', () => {
    // Tailwind v4 emits @theme tokens to :root at build, so the light values
    // live in @theme and the dark override targets :root under a media query.
    expect(css).toMatch(/@theme\s*\{/);
    for (const token of [
      '--color-surface-base',
      '--color-surface-raised',
      '--color-surface-overlay',
      '--color-text-primary',
      '--color-text-secondary',
      '--color-accent',
      '--color-hazard',
      '--color-border',
    ]) {
      expect(css).toContain(token);
    }
  });

  it('declares a dark token block under prefers-color-scheme', () => {
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/);
    // The dark block must re-declare the surface + text tokens so the same
    // meaning carries a brighter/adjusted value rather than a different hue.
    const darkBlock = css.slice(css.indexOf('(prefers-color-scheme: dark)'));
    expect(darkBlock).toContain('--color-surface-base');
    expect(darkBlock).toContain('--color-text-primary');
    expect(darkBlock).toContain('--color-accent');
  });

  it('leaves color-scheme to the system rather than forcing dark', () => {
    expect(css).toMatch(/color-scheme:\s*light dark/);
    expect(css).not.toMatch(/color-scheme:\s*dark\s*;/);
  });

  it('keeps the depth-class ramp single-hue and tokenized (ADR-003)', () => {
    for (const token of ['--color-water-100', '--color-water-200', '--color-water-300']) {
      expect(css).toContain(token);
    }
  });

  it('ships a viewport that respects device insets', () => {
    expect(html).toMatch(/viewport-fit=cover/);
  });

  it('declares theme-color for light and dark chrome', () => {
    const themeColors = html.match(/name="theme-color"/g) ?? [];
    expect(themeColors.length).toBeGreaterThanOrEqual(2);
    expect(html).toMatch(/prefers-color-scheme:\s*dark/);
  });
});
