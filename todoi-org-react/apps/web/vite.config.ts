import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * One config, two builds: `vite build` writes the fingerprinted client bundle
 * (and its manifest) to dist/client; `vite build --ssr` writes the
 * server-render bundle to dist/server. The editor is its own chunk through
 * route code splitting.
 */
export default defineConfig(({ command, isSsrBuild }) => ({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      quoteStyle: 'single',
    }),
    react(),
  ],
  css: {
    modules: {
      // No localsConvention: module keys keep their dashes, styles['matrix-row'], the same words as the hooks.
      generateScopedName: isSsrBuild || process.env.NODE_ENV === 'production' ? '[hash:base64:6]' : '[name]_[local]',
    },
  },
  build: isSsrBuild
    ? { outDir: 'dist/server', emptyOutDir: true, copyPublicDir: false }
    : {
        outDir: 'dist/client',
        emptyOutDir: true,
        manifest: true,
        rollupOptions: { input: 'src/entry-client.tsx' },
      },
  // The server bundle carries its dependencies: the production image has no node_modules.
  // Only when building: in dev, Vite's module runner cannot evaluate CommonJS
  // packages such as react-dom/server, so they stay external and Node loads them.
  ssr: command === 'build' ? { noExternal: true } : {},
}));
