import { describe, expect, it, vi } from 'vitest';

import { supportsWebGl2 } from './supportsWebGl2';

describe('supportsWebGl2', () => {
  it('returns true when a webgl2 context can be created', () => {
    const createContext = vi.fn(() => ({ fake: 'webgl2-context' }));

    expect(supportsWebGl2(createContext)).toBe(true);
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('returns false when context creation returns null', () => {
    const createContext = vi.fn(() => null);

    expect(supportsWebGl2(createContext)).toBe(false);
  });

  it('returns false when context creation throws', () => {
    const createContext = vi.fn(() => {
      throw new Error('blocklisted driver');
    });

    expect(supportsWebGl2(createContext)).toBe(false);
  });

  it('returns false in jsdom, which has no WebGL implementation', () => {
    expect(supportsWebGl2()).toBe(false);
  });
});
