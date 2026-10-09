import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

if (typeof URL.createObjectURL === 'undefined') {
  (URL as unknown as { createObjectURL: typeof URL.createObjectURL }).createObjectURL =
    (() => 'blob:mock') as typeof URL.createObjectURL;
}
if (typeof URL.revokeObjectURL === 'undefined') {
  (URL as unknown as { revokeObjectURL: typeof URL.revokeObjectURL }).revokeObjectURL =
    (() => {}) as typeof URL.revokeObjectURL;
}
