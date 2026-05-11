import { router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { clientsRouter } from './routers/clients.js';
import { factFindRouter } from './routers/factFind.js';
import { healthRouter } from './routers/health.js';
import { soaWizardRouter } from './routers/soaWizard.js';
import { tenantsRouter } from './routers/tenants.js';

/**
 * The single root tRPC router. Re-exports its inferred type so the web
 * app can `import type { AppRouter } from '@advicelink/api/trpc'` and
 * get end-to-end type safety with no codegen step.
 *
 * Every feature router added by later WPs lands here as one more line.
 */
export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  tenants: tenantsRouter,
  clients: clientsRouter,
  factFind: factFindRouter,
  soaWizard: soaWizardRouter,
});

export type AppRouter = typeof appRouter;
