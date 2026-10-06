import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { DEM_DATA_URL, loadDemGrid } from '@/features/terrain/loadDem';
import { server } from '@/test/msw';
import { encodeDemBinary, rampGrid } from '@/test/demBinaryFixture';

const serve = (body: ArrayBuffer | null, status = 200) =>
  server.use(http.get(DEM_DATA_URL, () => new HttpResponse(body, { status })));

afterEach(() => {
  server.resetHandlers();
});

describe('loadDemGrid', () => {
  it('fetches the DEM bytes and decodes them into a heightfield grid', async () => {
    const source = rampGrid();
    serve(encodeDemBinary(source));

    const result = await loadDemGrid();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grid.rows).toBe(source.rows);
    expect(result.grid.cols).toBe(source.cols);
    expect(result.grid.widthMeters).toBe(source.widthMeters);
    expect(result.grid.depthMeters).toBe(source.depthMeters);
    expect(result.grid.minElevationMeters).toBeCloseTo(source.minElevationMeters, 5);
    expect(result.grid.maxElevationMeters).toBeCloseTo(source.maxElevationMeters, 5);
  });

  it('decodes samples within half a quantisation step of the encoded values', async () => {
    const source = rampGrid();
    serve(encodeDemBinary(source));

    const result = await loadDemGrid();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const band = source.maxElevationMeters - source.minElevationMeters;
    const step = band / 65_535;
    let maxError = 0;
    for (let i = 0; i < source.samples.length; i += 1) {
      maxError = Math.max(maxError, Math.abs(result.grid.samples[i] - source.samples[i]));
    }
    expect(maxError).toBeLessThanOrEqual(step / 2);
  });

  it('reports a missing asset as not-found', async () => {
    serve(null, 404);
    await expect(loadDemGrid()).resolves.toEqual({ ok: false, reason: 'not-found' });
  });

  it('reports a server error as network', async () => {
    serve(null, 500);
    await expect(loadDemGrid()).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('reports a transport failure as network', async () => {
    server.use(http.get(DEM_DATA_URL, () => HttpResponse.error()));
    await expect(loadDemGrid()).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('reports bytes that are not a DEM as corrupt', async () => {
    serve(new Uint8Array(64).fill(0xff).buffer);
    await expect(loadDemGrid()).resolves.toEqual({ ok: false, reason: 'corrupt' });
  });

  it('requests the default DEM path when no URL is given', async () => {
    const requested: string[] = [];
    server.use(
      http.get(DEM_DATA_URL, ({ request }) => {
        requested.push(new URL(request.url).pathname);
        return new HttpResponse(encodeDemBinary(rampGrid()), { status: 200 });
      }),
    );

    const result = await loadDemGrid();

    expect(result.ok).toBe(true);
    expect(requested).toEqual(['/data/kampala-dem.bin']);
  });
});
