import { setupServer } from 'msw/node';

/**
 * Shared MSW server for tests.
 *
 * The project never stubs `fetch` directly — MSW intercepts at the network
 * layer, so tests exercise the real request/response path (status codes,
 * `arrayBuffer()`, `response.ok`) rather than a hand-built stand-in that would
 * drift from what the browser actually does.
 *
 * Lives in its own module so both `setup.ts` (lifecycle) and individual test
 * files (handlers) bind to the same instance.
 */
export const server = setupServer();
