import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { encodeFloodBinary, floodBinaryUrl } from '@/features/flood/floodBinary';
import { resetFloodCache } from '@/features/flood/loadFlood';
import { server } from '@/test/msw';

import { DEM_DATA_URL, resetDemGridCache } from './loadDem';
import { TerrainMap2D } from './TerrainMap2D';
import { encodeDemBinary, rampGrid } from '@/test/demBinaryFixture';

/**
 * A flood raster on rampGrid's 4×3 grid: two cells in the shallowest band and
 * one in the deepest, so the three classes are all distinguishable.
 */
const floodFixture = (rainfallMm = 60, durationSeconds = 10800): Uint8Array =>
  encodeFloodBinary(
    {
      cols: 4,
      rows: 3,
      west: 32.511,
      south: 0.207,
      east: 32.684,
      north: 0.409,
      rainfallMm,
      durationSeconds,
    },
    Uint8Array.from([1, 0, 4, 0, 1, 0, 0, 0, 0, 0, 0, 0]),
  );

const serveDem = () =>
  server.use(
    http.get(
      DEM_DATA_URL,
      () => new HttpResponse(encodeDemBinary(rampGrid()), { status: 200 }),
    ),
  );

const serveFlood = (
  body: ArrayBuffer | Uint8Array | null,
  status = 200,
  rainfall = 60,
  duration = 10800,
) =>
  server.use(
    http.get(
      floodBinaryUrl(rainfall, duration),
      () => new HttpResponse(body, { status }),
    ),
  );

beforeEach(() => {
  // Both loaders cache their promises for the session so repeated scrubs do
  // not re-download; each test needs a clean pair.
  resetDemGridCache();
  resetFloodCache();
});

afterEach(() => {
  server.resetHandlers();
});

describe('TerrainMap2D', () => {
  it('says it is loading rather than showing an empty box', () => {
    server.use(http.get(DEM_DATA_URL, () => new Promise(() => {})));
    render(<TerrainMap2D />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading the terrain map/i);
  });

  it('names itself for assistive technology using the numbers it is showing', async () => {
    serveDem();
    serveFlood(floodFixture());

    render(<TerrainMap2D />);

    const canvas = await screen.findByRole('img');
    const label = canvas.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/kampala/i);
    expect(label).toMatch(/terrain/i);
    expect(label).toMatch(/1100 to 1210 metres/);
    expect(label).toMatch(/% of the study area is water/i);
  });

  it('sizes the canvas to the map it rendered', async () => {
    serveDem();
    serveFlood(floodFixture());

    render(<TerrainMap2D />);

    const canvas = (await screen.findByRole('img')) as HTMLCanvasElement;
    await waitFor(() => expect(canvas.width).toBeGreaterThan(0));
    expect(canvas.width).toBeLessThanOrEqual(480);
  });

  it('repeats the elevation range in the visible caption, not only in the label', async () => {
    // A screen-reader-only number is not an accessible product: a sighted user
    // with low vision has to be able to read the same figure.
    serveDem();
    serveFlood(floodFixture());

    render(<TerrainMap2D />);

    const figure = (await screen.findByRole('img')).closest('figure');
    expect(figure?.textContent).toMatch(/1100–1210 m/);
  });

  it('bands the flood by depth class instead of inventing a point value', async () => {
    // The dataset publishes binary extents at 0.1 / 0.2 / 0.3 m and nothing
    // between. Claiming a depth at one pixel would be false precision.
    serveDem();
    serveFlood(floodFixture());

    render(<TerrainMap2D />);

    const figure = (await screen.findByRole('img')).closest('figure');
    expect(figure?.textContent).toMatch(/0\.1–0\.2 m/);
    expect(figure?.textContent).toMatch(/0\.2–0\.3 m/);
    expect(figure?.textContent).toMatch(/≥ 0\.3 m/);
    expect(figure?.textContent).toMatch(/depth classes/i);
    // No sentence may put a single number on a single point.
    expect(figure?.textContent).not.toMatch(/depth here is/i);
    expect(figure?.textContent).not.toMatch(/depth of \d/i);
  });

  it('attributes the published study the extent came from', async () => {
    // The dataset is peer-reviewed published research, not our own model
    // (ADR-001), and the caption is where a planner checks that.
    serveDem();
    serveFlood(floodFixture());

    render(<TerrainMap2D />);

    const figure = (await screen.findByRole('img')).closest('figure');
    expect(figure?.textContent).toMatch(/McClean et al/i);
    expect(figure?.textContent).toMatch(/Open Government Licence/i);
  });

  it('lets the planner change which storm is on the map', async () => {
    serveDem();
    serveFlood(floodFixture(60, 10800));
    serveFlood(floodFixture(100, 21600), 200, 100, 21600);

    render(<TerrainMap2D />);
    await screen.findByRole('img');
    await screen.findByLabelText('Rainfall');
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/60 mm over 3 h/);

    fireEvent.change(screen.getByLabelText('Rainfall'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '21600' } });

    await waitFor(() =>
      expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(
        /100 mm over 6 h/,
      ),
    );
  });

  it('explains a missing terrain file instead of rendering nothing', async () => {
    server.use(http.get(DEM_DATA_URL, () => new HttpResponse(null, { status: 404 })));

    render(<TerrainMap2D />);

    expect(await screen.findByRole('status')).toHaveTextContent(/fetch-dem\.mjs/);
  });

  it('explains a missing flood layer rather than silently showing bare terrain', async () => {
    // Bare terrain where a flood should be is the worst failure mode: it looks
    // like "no flooding", which is a claim we cannot make.
    serveDem();
    serveFlood(null, 404);

    render(<TerrainMap2D />);

    // The loading message is also role=status, so wait for the reason rather
    // than for a status element that was already on screen.
    expect(await screen.findByText(/fetch-flood\.mjs/)).toBeInTheDocument();
  });

  it('refuses to draw a flood raster built on a different grid', async () => {
    serveDem();
    const wrongGrid = encodeFloodBinary(
      {
        cols: 643,
        rows: 746,
        west: 32.511,
        south: 0.207,
        east: 32.684,
        north: 0.409,
        rainfallMm: 60,
        durationSeconds: 10800,
      },
      new Uint8Array(643 * 746),
    );
    serveFlood(wrongGrid);

    render(<TerrainMap2D />);

    expect(await screen.findByText(/different grid/i)).toBeInTheDocument();
  });
});
