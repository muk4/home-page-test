import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  build: {
    target: 'es2022',
    // PixiJS is big on its own; that's expected for this page.
    chunkSizeWarningLimit: 900,
  },
});
