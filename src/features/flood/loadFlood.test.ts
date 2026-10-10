import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '@/test/msw';

import { encodeFloodBinary, floodBinaryUrl } from './floodBinary';
import { loadFloodScenario, loadFloodScenarioOnce, resetFloodCache } from './loadFlood';

const meta = {
  cols: 4,
  rows: 3,
  west: 32.511,
  south: 0.207,
  east: 32.684,
  north: 0.409,
  rainfallMm: 60,
  durationSeconds: 10800,
};

const serve = (body: ArrayBuffer | Uint8Array | null, status = 200) =>
  server.use(
    http.get(floodBinaryUrl(60, 10800), () => new HttpResponse(body, { status })),
  );

const encoded = (): Uint8Array =>
  encodeFloodBinary(meta, Uint8Array.from([1, 2, 4, 0, 5, 6, 7, 0, 0, 1, 0, 3]));

beforeEach(() => resetFloodCache());
afterEach(() => server.resetHandlers());

describe('loadFloodScenario', () => {
  it('returns the decoded scenario', async () => {
    serve(encoded());

    const result = await loadFloodScenario(60, 10800);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flood.rainfallMm).toBe(60);
    expect(result.flood.flags).toHaveLength(12);
    expect(result.flood.flags[0]).toBe(1);
  });

  it('reports a missing asset as not-found, not as corrupt', async () => {
    serve(null, 404);
    expect(await loadFloodScenario(60, 10800)).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('reports a transport failure separately so a retry is plausible', async () => {
    serve(null, 500);
    expect(await loadFloodScenario(60, 10800)).toEqual({ ok: false, reason: 'network' });
  });

  it('reports bytes that are not a flood layer as corrupt', async () => {
    serve(new Uint8Array(200));
    expect(await loadFloodScenario(60, 10800)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('refuses a raster built on a different grid than the terrain', async () => {
    // The failure this layer exists for: an offset overlay looks fine and
    // floods the wrong suburb.
    serve(encoded());
    const result = await loadFloodScenario(60, 10800, { cols: 643, rows: 746 });
    expect(result).toEqual({ ok: false, reason: 'grid-mismatch' });
  });

  it('accepts a raster that matches the terrain grid', async () => {
    serve(encoded());
    const result = await loadFloodScenario(60, 10800, { cols: 4, rows: 3 });
    expect(result.ok).toBe(true);
  });
});

describe('loadFloodScenarioOnce', () => {
  it('issues the request once however many times the scenario is revisited', async () => {
    let hits = 0;
    server.use(
      http.get(floodBinaryUrl(60, 10800), () => {
        hits += 1;
        return new HttpResponse(encoded(), { status: 200 });
      }),
    );

    await loadFloodScenarioOnce(60, 10800);
    await loadFloodScenarioOnce(60, 10800);
    await loadFloodScenarioOnce(60, 10800);

    expect(hits).toBe(1);
  });

  it('caches failures too, so a 404 is not retried from every consumer', async () => {
    let hits = 0;
    server.use(
      http.get(floodBinaryUrl(60, 10800), () => {
        hits += 1;
        return new HttpResponse(null, { status: 404 });
      }),
    );

    await loadFloodScenarioOnce(60, 10800);
    await loadFloodScenarioOnce(60, 10800);

    expect(hits).toBe(1);
  });
});
