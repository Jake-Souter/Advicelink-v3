import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { BrandThemeProvider } from '@advicelink/ui';
import { readyAdviceBrandBundle } from '@advicelink/branding';

import './styles/index.css';
import { routeTree } from './app/routeTree.gen';

const router = createRouter({ routeTree });
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Per REBUILD_PLAN §19.21.4 — only retry 429/5xx; never auto-retry mutations.
      retry: 3,
      staleTime: 30_000,
    },
  },
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
    <QueryClientProvider client={queryClient}>
      {/* The BrandThemeProvider is hard-coded to Ready Advice at v1; once the
          tenant resolver lands in WP-3 the bundle will come from the resolved
          tenant via the API context. */}
      <BrandThemeProvider brand={readyAdviceBrandBundle}>
        <RouterProvider router={router} />
      </BrandThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
