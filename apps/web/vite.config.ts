import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'node:path';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
    }),
    react(),
    /*
     * Honour each workspace package's own `tsconfig.json paths`. In particular
     * `packages/ui` declares `@/*` -> `src/*` so that shadcn-generated atoms can
     * import siblings without escaping the UI package layer. Without this
     * plugin Vite would only see `apps/web/tsconfig.json` and fail to resolve
     * those intra-package paths.
     */
    tsconfigPaths({
      projects: [
        path.resolve(__dirname, './tsconfig.json'),
        path.resolve(__dirname, '../../packages/ui/tsconfig.json'),
      ],
    }),
  ],
  resolve: {
    alias: { '~': path.resolve(__dirname, './src') },
  },
  server: { port: 3000, strictPort: true },
});
