import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
    // Terrain and flood-extent payloads are fetched at runtime from public/data,
    // never bundled. This ceiling is a guard against accidentally importing
    // geospatial assets into the initial JS graph.
    chunkSizeWarningLimit: 900,
  },
});
