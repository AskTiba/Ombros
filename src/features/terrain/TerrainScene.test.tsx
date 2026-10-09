import { act } from 'react';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { BufferGeometry } from 'three';
import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEM_DATA_URL } from '@/features/terrain/loadDem';
import { server } from '@/test/msw';
import { encodeDemBinary, rampGrid } from '@/test/demBinaryFixture';

import { decimateGrid } from './decimateGrid';
import { TerrainScene, VERTICAL_EXAGGERATION } from './TerrainScene';

const captured = vi.hoisted(() => ({
  children: null as unknown,
  canvasProps: {} as Record<string, unknown>,
  frameCallback: null as ((delta: number) => void) | null,
  readDeviceSignals: vi.fn(() => ({})),
}));

type DemBinaryGrid = {
  samples: Float32Array;
  rows: number;
  cols: number;
  widthMeters: number;
  depthMeters: number;
  minElevationMeters: number;
  maxElevationMeters: number;
};

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: unknown; dpr?: unknown; camera?: unknown }) => {
    captured.canvasProps = { dpr: props.dpr, camera: props.camera };
    captured.children = props.children;
    return <div data-testid="r3f-canvas">{props.children as ReactNode}</div>;
  },
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    captured.frameCallback = (delta: number) => callback({}, delta);
  },
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

vi.mock('./deviceSignals', () => ({
  readDeviceSignals: captured.readDeviceSignals,
}));

vi.mock('./decimateGrid', () => ({
  decimateGrid: vi.fn((grid: DemBinaryGrid) => grid),
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

const playFrames = (deltaSeconds: number, frames: number) => {
  act(() => {
    for (let i = 0; i < frames; i += 1) {
      captured.frameCallback?.(deltaSeconds);
    }
  });
};

afterEach(() => {
  captured.children = null;
  captured.canvasProps = {};
  captured.frameCallback = null;
  captured.readDeviceSignals.mockClear();
  captured.readDeviceSignals.mockReturnValue({});
  vi.mocked(decimateGrid).mockClear();
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

  it('discloses the tier selected from capability signals and caps canvas resolution', async () => {
    captured.readDeviceSignals.mockReturnValue({ deviceMemoryGb: 2 });
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('tier-disclosure')).toHaveTextContent(
      /rendering quality: low/i,
    );
    expect(captured.canvasProps.dpr).toEqual([1, 1]);
    expect(vi.mocked(decimateGrid)).toHaveBeenCalledWith(
      expect.objectContaining({ rows: 3, cols: 4 }),
      4,
    );
  });

  it('discovers no capability signals and defaults the disclosure to medium', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('tier-disclosure')).toHaveTextContent(
      /rendering quality: medium/i,
    );
  });

  it('promotes a tier when sustained headroom is measured and rebuilds at the new stride', async () => {
    captured.readDeviceSignals.mockReturnValue({ deviceMemoryGb: 2 });
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('tier-disclosure')).toHaveTextContent(
      /rendering quality: low/i,
    );

    playFrames(0.0138, 180);

    expect(await screen.findByTestId('tier-disclosure')).toHaveTextContent(
      /rendering quality: medium/i,
    );
    expect(captured.canvasProps.dpr).toEqual([1, 1.5]);
    expect(vi.mocked(decimateGrid).mock.calls.at(-1)![1]).toBe(2);
  });

  it('demotes a tier when the frame rate collapses and rebuilds at the coarser stride', async () => {
    captured.readDeviceSignals.mockReturnValue({ deviceMemoryGb: 16 });
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('tier-disclosure')).toHaveTextContent(
      /rendering quality: medium/i,
    );

    playFrames(0.04, 60);

    expect(await screen.findByTestId('tier-disclosure')).toHaveTextContent(
      /rendering quality: low/i,
    );
    expect(captured.canvasProps.dpr).toEqual([1, 1]);
    expect(vi.mocked(decimateGrid).mock.calls.at(-1)![1]).toBe(4);
  });
});

describe('terrain presentation', () => {
  it('frames the terrain from an elevated three-quarter view with orbit controls', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();

    const camera = captured.canvasProps.camera as
      { position?: [number, number, number] } | undefined;
    expect(camera?.position?.[1]).toBeGreaterThan(10000);
    expect(screen.getByTestId('orbit-controls')).toBeInTheDocument();
  });

  it('tints vertices by elevation so relief reads as topography', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();

    const mesh = meshChild();
    const geometry = mesh?.props.geometry as BufferGeometry;
    expect(geometry).toBeDefined();

    const color = geometry.getAttribute('color');
    expect(color).toBeDefined();
    expect(color?.count).toBe(geometry.getAttribute('position')?.count);
  });
});
