import { act } from 'react';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { BufferGeometry } from 'three';
import { HttpResponse, http } from 'msw';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEM_DATA_URL } from '@/features/terrain/loadDem';
import { boundsHeightMeters, boundsWidthMeters } from '@/lib/geo';
import { server } from '@/test/msw';
import { encodeDemBinary, rampGrid } from '@/test/demBinaryFixture';

import { decimateGrid } from './decimateGrid';
import { TerrainScene, VERTICAL_EXAGGERATION } from './TerrainScene';

const captured = vi.hoisted(() => ({
  children: null as unknown,
  canvasProps: {} as Record<string, unknown>,
  frameCallback: null as ((delta: number) => void) | null,
  orbitTarget: null as [number, number, number] | null,
  orbitOnChange: null as ((event: unknown) => void) | null,
  orbitProps: {} as Record<string, unknown>,
  fakeControls: {
    getAzimuthalAngle: () => 0,
    object: {
      position: { distanceTo: () => 24000, set: vi.fn(), x: 0, y: 15000, z: 19000 },
    },
    target: { x: 99999, y: 500, z: 99999, set: vi.fn() },
    update: vi.fn(),
  },
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
  OrbitControls: (props: {
    target?: [number, number, number];
    onChange?: (event: unknown) => void;
    ref?: ((controls: unknown) => void) | null;
    enablePan?: boolean;
  }) => {
    captured.orbitTarget = props.target ?? null;
    captured.orbitOnChange = props.onChange ?? null;
    captured.orbitProps = props as unknown as Record<string, unknown>;
    // The scene hands its controls to a callback ref so it can reset the view.
    props.ref?.(captured.fakeControls);
    return <div data-testid="orbit-controls" />;
  },
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
    ReactElement<{ geometry?: BufferGeometry; children?: ReactNode }> | undefined;
};

/** Finds one material by its element type inside the terrain mesh. */
const meshMaterial = (type: string) =>
  Children.toArray(meshChild()?.props.children)
    .filter(isValidElement)
    .find((element: ReactElement) => element.type === type);

/** Finds a direct child of the canvas by its element type. */
const sceneChild = (type: string) =>
  Children.toArray(captured.children as ReactNode)
    .filter(isValidElement)
    .find((element: ReactElement) => element.type === type) as
    ReactElement<{ geometry?: BufferGeometry; children?: ReactNode }> | undefined;

/** Every direct child of the canvas with the given element type. */
const sceneChildren = (type: string) =>
  Children.toArray(captured.children as ReactNode)
    .filter(isValidElement)
    .filter((element: ReactElement) => element.type === type) as ReactElement<{
    geometry?: BufferGeometry;
  }>[];

/** Extremes of a geometry along Y, or a non-finite value when it has none. */
const verticalExtent = (geometry?: BufferGeometry) => {
  const positions = geometry?.getAttribute('position');
  if (!positions)
    return { highest: Number.NEGATIVE_INFINITY, lowest: Number.POSITIVE_INFINITY };
  let highest = Number.NEGATIVE_INFINITY;
  let lowest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < positions.count; i += 1) {
    const y = positions.getY(i);
    if (y > highest) highest = y;
    if (y < lowest) lowest = y;
  }
  return { highest, lowest };
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
  captured.orbitTarget = null;
  captured.orbitOnChange = null;
  captured.orbitProps = {};
  captured.fakeControls.target.set = vi.fn();
  captured.fakeControls.object.position.set = vi.fn();
  captured.fakeControls.update = vi.fn();
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

  it('mounts a terrain mesh from the loaded DEM and discloses its exaggeration', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();

    const mesh = meshChild();
    expect(mesh).toBeDefined();
    expect(mesh?.props.geometry).toBeInstanceOf(BufferGeometry);

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

  it('names the scene as a feature and states how to explore it', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(
      await screen.findByRole('heading', { level: 3, name: /kampala in 3d/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/drag to orbit/i)).toBeInTheDocument();
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

  it('shades from baked vertex colours rather than scene lights', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();

    // A directional light would swing the hillshade around as the camera
    // orbits; the shading lives in the colours, so nothing lights the scene.
    const types = Children.toArray(captured.children as ReactNode)
      .filter(isValidElement)
      .map((element: ReactElement) => element.type);
    expect(types).not.toContain('ambientLight');
    expect(types).not.toContain('directionalLight');

    expect(meshMaterial('meshBasicMaterial')).toBeDefined();
    expect(meshMaterial('meshStandardMaterial')).toBeUndefined();
  });

  it('draws contour lines over the terrain so it reads as surveyed ground', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();

    const segments = sceneChild('lineSegments');
    expect(segments).toBeDefined();
    // The fixture ramps 1100→1210, which crosses five 20m contour levels, so
    // the geometry must carry real vertices rather than an empty buffer.
    const positions = segments?.props.geometry?.getAttribute('position');
    expect(positions?.count).toBeGreaterThan(0);
    // Consecutive vertex pairs, which is what LineSegments draws.
    expect((positions?.count ?? 0) % 2).toBe(0);
    expect(
      Children.toArray(segments?.props.children)
        .filter(isValidElement)
        .map((element: ReactElement) => element.type),
    ).toContain('lineBasicMaterial');
  });

  it('closes the terrain with a cut slab hanging beneath it', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();

    const meshes = sceneChildren('mesh');
    // Terrain first, slab second — `meshChild()` keeps targeting the terrain.
    expect(meshes).toHaveLength(2);
    const [terrain, slab] = meshes;

    // The slab carries its own baked colour: there are no lights in the scene
    // to give it form, so an unlit material would render it as a flat
    // silhouette without one.
    expect(slab.props.geometry?.getAttribute('color')).toBeDefined();

    // Built from the same grid with the same base, so its floor sits below the
    // lowest ground rather than level with it — otherwise the terrain would
    // poke through the bottom of its own slab.
    const slabExtent = verticalExtent(slab.props.geometry);
    expect(slabExtent.lowest).toBeLessThan(verticalExtent(terrain.props.geometry).lowest);

    // And framed on the whole model rather than on the surface alone. Targeting
    // the relief pushed the base off the bottom of the canvas, where it showed
    // as a rim a few pixels deep instead of a solid base.
    const wholeModel =
      (slabExtent.lowest + verticalExtent(terrain.props.geometry).highest) / 2;
    expect(captured.orbitTarget?.[1]).toBeCloseTo(wholeModel, 3);
  });

  it('keeps the compass and the scale bar in step with the camera', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('scale-bar-label')).toHaveTextContent('—');

    // The mocked Canvas renders a div, not a real <canvas>, so there is no
    // layout to measure and the bar correctly stays blank. What this pins is
    // that a camera change reaches the overlay at all — and that it does so
    // without re-rendering it through React state.
    act(() => {
      captured.orbitOnChange?.({
        target: {
          getAzimuthalAngle: () => Math.PI / 2,
          object: { position: { distanceTo: () => 24000 } },
          target: {},
        },
      });
    });

    expect(screen.getByTestId('north-arrow')).toHaveStyle({ transform: 'rotate(90deg)' });
  });

  it('lets the user pan, so a zoomed-in view can be moved back into frame', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();
    // Without pan the pivot is welded to the centre: zooming walks the camera
    // at the centre while everything else leaves the frame with no way back.
    expect(captured.orbitProps.enablePan).toBe(true);
  });

  it('keeps the pivot over the study extent when a pan runs off the edge', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();

    // `fakeControls.target` starts far outside the extent on purpose.
    const clamped = captured.fakeControls.target;
    act(() => {
      captured.orbitOnChange?.({ target: captured.fakeControls });
    });

    expect(Math.abs(clamped.x)).toBeLessThanOrEqual(boundsWidthMeters() / 2);
    expect(Math.abs(clamped.z)).toBeLessThanOrEqual(boundsHeightMeters() / 2);
  });

  it('returns to the default framing when the compass is activated', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainScene />);

    expect(await screen.findByTestId('r3f-canvas')).toBeInTheDocument();
    const controls = captured.fakeControls;
    controls.update.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /reset the view/i }));

    // The ramp fixture spans 1100–1210m over a 50m slab at ×4, so the model
    // centres at (110 - 50) * 4 / 2 = 120.
    expect(controls.target.set).toHaveBeenCalledWith(0, 120, 0);
    expect(controls.object.position.set).toHaveBeenCalledWith(0, 15000, 19000);
    expect(controls.update).toHaveBeenCalledTimes(1);
  });
});
