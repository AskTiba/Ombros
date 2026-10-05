import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // WebGL contexts are not available in jsdom. Components that mount a
    // Three.js scene are tested through their accessible DOM surface and
    // their pure scene-graph builders, which need no renderer.
    //
    // `configDefaults.exclude` is spread rather than replaced: its
    // `**/node_modules/**` anchors at any depth, so nested installs (the
    // `.opencode/` skill vendor directory ships its own node_modules) cannot
    // leak dependency test suites into our run.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
