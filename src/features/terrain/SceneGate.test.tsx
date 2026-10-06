import { lazy } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SceneGate } from './SceneGate';
import { supportsWebGl2 } from './supportsWebGl2';

vi.mock('./supportsWebGl2', () => ({
  supportsWebGl2: vi.fn(() => false),
}));

const probe = vi.mocked(supportsWebGl2);

const SceneStub = () => <div role="terrain-scene">terrain scene</div>;
const Fallback = () => <div role="fallback">2D data path</div>;

afterEach(() => {
  vi.clearAllMocks();
});

describe('SceneGate', () => {
  it('renders the accessible fallback and no canvas when WebGL2 is unavailable', () => {
    probe.mockReturnValue(false);

    const { container } = render(
      <SceneGate
        scene={lazy(async () => ({ default: SceneStub }))}
        fallback={<Fallback />}
      />,
    );

    expect(screen.getByRole('fallback')).toBeInTheDocument();
    expect(screen.queryByRole('terrain-scene')).not.toBeInTheDocument();
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('mounts the scene when WebGL2 is available', async () => {
    probe.mockReturnValue(true);

    render(
      <SceneGate
        scene={lazy(async () => ({ default: SceneStub }))}
        fallback={<Fallback />}
      />,
    );

    expect(await screen.findByRole('terrain-scene')).toBeInTheDocument();
    expect(screen.queryByRole('fallback')).not.toBeInTheDocument();
  });

  it('falls back when the scene module fails to load', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    probe.mockReturnValue(true);
    const BrokenScene = lazy(() =>
      Promise.reject(new Error('chunk fetch failed on flaky data')),
    );

    render(<SceneGate scene={BrokenScene} fallback={<Fallback />} />);

    expect(await screen.findByRole('fallback')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
