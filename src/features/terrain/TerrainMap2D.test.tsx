import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEM_DATA_URL, resetDemGridCache } from './loadDem';
import { TerrainMap2D } from './TerrainMap2D';
import { server } from '@/test/msw';
import { encodeDemBinary, rampGrid } from '@/test/demBinaryFixture';

const serve = (body: ArrayBuffer | null, status = 200) =>
  server.use(http.get(DEM_DATA_URL, () => new HttpResponse(body, { status })));

beforeEach(() => {
  // The loader caches its promise for the session so the 2D and 3D views do
  // not pull the ~960 kB payload twice; each test needs a clean one.
  resetDemGridCache();
});

afterEach(() => {
  server.resetHandlers();
});

describe('TerrainMap2D', () => {
  it('says it is loading rather than showing an empty box', () => {
    server.use(http.get(DEM_DATA_URL, () => new Promise(() => {})));
    render(<TerrainMap2D />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading the terrain/i);
  });

  it('names itself for assistive technology using the numbers it is showing', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainMap2D />);

    const canvas = await screen.findByRole('img');
    const label = canvas.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/kampala terrain/i);
    expect(label).toMatch(/1100 to 1210 metres/);
    expect(label).toMatch(/% of the study area is water/i);
  });

  it('sizes the canvas to the map it rendered', async () => {
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainMap2D />);

    const canvas = (await screen.findByRole('img')) as HTMLCanvasElement;
    await waitFor(() => expect(canvas.width).toBeGreaterThan(0));
    expect(canvas.width).toBeLessThanOrEqual(480);
  });

  it('repeats the elevation range in the visible caption, not only in the label', async () => {
    // A screen-reader-only number is not an accessible product: a sighted user
    // with low vision has to be able to read the same figure.
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainMap2D />);

    const figure = (await screen.findByRole('img')).closest('figure');
    expect(figure?.textContent).toMatch(/1100–1210 m/);
  });

  it('does not claim to show flooding', async () => {
    // No hydrodynamic result is loaded in this product yet (ADR-001). The
    // previous version of this slot drew two hard-coded circles and called
    // them flood extents.
    serve(encodeDemBinary(rampGrid()));

    render(<TerrainMap2D />);

    const figure = (await screen.findByRole('img')).closest('figure');
    expect(figure?.textContent).toMatch(/not a prediction of where water would go/i);
  });

  it('explains a missing terrain file instead of rendering nothing', async () => {
    serve(null, 404);

    render(<TerrainMap2D />);

    expect(await screen.findByRole('status')).toHaveTextContent(/fetch-dem\.mjs/);
  });
});
