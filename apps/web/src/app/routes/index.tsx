import { createFileRoute, Navigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';

/**
 * `/` — at v1 there is exactly one tenant ("Ready Advice") so the bare
 * domain redirects straight into its tenant scope. The future tenant
 * picker / tenant-discovery flow (REBUILD_PLAN §2.4) lands here once
 * onboarding-by-self-serve is on the roadmap.
 */
export const Route = createFileRoute('/')({
  component: HomeRedirect,
});

function HomeRedirect(): ReactElement {
  return <Navigate to="/t/$tenantSlug" params={{ tenantSlug: 'ready-advice' }} replace />;
}
