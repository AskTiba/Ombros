import { afterEach, describe, expect, it } from 'vitest';

import { readDeviceSignals } from './deviceSignals';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readDeviceSignals', () => {
  it('reports no signals in an environment that exposes neither capability', () => {
    expect(readDeviceSignals()).toEqual({});
  });

  it('surfaces device memory and connection details when present', () => {
    vi.stubGlobal('navigator', {
      deviceMemory: 6,
      connection: { effectiveType: '4g', saveData: false },
    });

    expect(readDeviceSignals()).toEqual({
      deviceMemoryGb: 6,
      effectiveType: '4g',
      saveData: false,
    });
  });

  it('ignores a zero deviceMemory, which browsers use for unknown', () => {
    vi.stubGlobal('navigator', {
      deviceMemory: 0,
      connection: { effectiveType: 'slow-2g', saveData: true },
    });

    expect(readDeviceSignals()).toEqual({
      effectiveType: 'slow-2g',
      saveData: true,
    });
  });

  it('tolerates a connection object missing the newer fields', () => {
    vi.stubGlobal('navigator', { connection: {} });

    expect(readDeviceSignals()).toEqual({});
  });
});
