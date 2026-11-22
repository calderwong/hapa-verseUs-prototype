import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const ROOT = import.meta.dirname;

// The Versus page imports Luminati's engine straight from the vendored Hapa fork. The dev server
// binds 127.0.0.1 only.
export default defineConfig({
  root: ROOT,
  server: { host: '127.0.0.1', port: 5199, strictPort: true, open: false, fs: { allow: [ROOT] } },
  preview: { host: '127.0.0.1', port: 5200, strictPort: true },
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    rollupOptions: { input: { index: resolve(ROOT, 'index.html'), versus: resolve(ROOT, 'versus.html') } },
  },
});
