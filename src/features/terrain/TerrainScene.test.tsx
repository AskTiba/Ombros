import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { BufferGeometry } from 'three';
import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEM_DATA_URL } from '@/features/terrain/loadDem';
import { server } from '@/test/msw';
import { encodeDemBinary, rampGrid } from '@/test/demBinaryFixture';

import { TerrainScene, VERTICAL_EXAGGERATION } from './TerrainScene';

const captured = vi.hoisted(() => ({ children: null as unknown }));

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: unknown }) => {
    captured.children = props.children;
    return <div data-testid="r3f-canvas" />;
  },
}));

const serve = (body: ArrayBuffer | null, status = 200) =>
  server.use(http.get(DEM_DATA_URL, () => new HttpResponse(body, { status })));

const meshChild = () => {
  const elements = Children.toArray(captured.children as ReactNode);
  return elements
    .filter(isValidElement)
    .find((element: ReactElement) => element.type === 'mesh') as
    ReactElement<{ geometry?: BufferGeometry }> | undefined;
};

afterEach(() => {
  captured.children = null;
  server.resetHandlers();
});

describe('TerrainScene', () => {
  it('reports loading while the elevation data is in flight', () => {
    server.use(http.get(DEM_DATA_URL, () => new Promise(() => {})));

    render(<TerrainScene />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(screen.queryByTestId('r3f-canvas')).not.toBeInTheDocument();
  });

  it('mounts a lit terrain mesh from the loaded DEM and discloses its exaggeration', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();

    const mesh = meshChild();
    expect(mesh).toBeDefined();
    expect(mesh?.props.geometry).toBeInstanceOf(BufferGeometry);

    const types = Children.toArray(captured.children as ReactNode)
      .filter(isValidElement)
      .map((element: ReactElement) => element.type);
    expect(types).toContain('ambientLight');
    expect(types).toContain('directionalLight');

    expect(
      screen.getByText(new RegExp(`exaggeration ×${VERTICAL_EXAGGERATION}`, 'i')),
    ).toBeInTheDocument();
  });

  it('shows the fetch-script hint when the DEM asset is missing', async () => {
    serve(null, 404);

    render(<TerrainScene />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/fetch-dem\.mjs/);
    expect(screen.queryByTestId('r3f-canvas')).not.toBeInTheDocument();
  });

  it('reports corrupt bytes without mounting a canvas', async () => {
    serve(new Uint8Array(64).fill(0xff).buffer);

    render(<TerrainScene />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/corrupt/i);
    expect(screen.queryByTestId('r3f-canvas')).not.toBeInTheDocument();
  });

  it('reports a network failure without mounting a canvas', async () => {
    server.use(http.get(DEM_DATA_URL, () => HttpResponse.error()));

    render(<TerrainScene />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/connection/i);
    expect(screen.queryByTestId('r3f-canvas')).not.toBeInTheDocument();
  });
});
