import { Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  // Layout composition only — no styling. The actual AppShell semantic
  // component lands with the design system in the first feature work package
  // that needs it (see REBUILD_PLAN §11.6.3 Layer 4).
  return <Outlet />;
}
