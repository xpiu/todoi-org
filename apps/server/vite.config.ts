import { defineConfig } from 'vite';

/**
 * The server as one ES module for Node, every dependency bundled in, so the
 * production image needs no node_modules. The web build's server bundle is
 * loaded at runtime from apps/web/dist, not bundled here.
 */
export default defineConfig({
  build: {
    ssr: 'src/index.ts',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node22',
    sourcemap: true,
    rollupOptions: {
      output: { entryFileNames: 'index.js', format: 'es' },
      // Optional native bindings pg probes for; never installed.
      external: ['pg-native'],
    },
  },
  ssr: {
    noExternal: true,
    target: 'node',
  },
});
