import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';

import './styles/index.css';
import { routeTree } from './app/routeTree.gen';

/**
 * App entrypoint. The router owns the entire tree; per-page providers
 * (`AppProviders`, `TenantProvider`, `AuthProvider`, `BrandThemeProvider`)
 * live inside `__root.tsx` and `t.$tenantSlug.tsx` so they can reach
 * the URL-derived tenant slug. Keeping `main.tsx` minimal also means
 * any provider rewiring lands in one obvious place.
 */
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root not found');

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
