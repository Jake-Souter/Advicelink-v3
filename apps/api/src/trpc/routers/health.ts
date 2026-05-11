import { dbClient } from '../../db/index.js';
import { publicProcedure, router } from '../trpc.js';

/**
 * `health.*` — pre-auth procedures used by load balancers, dev smoke
 * tests, and the deploy pipeline. NEVER add anything here that touches
 * a tenant; mounted at `/trpc` (no `/t/:tenantSlug` prefix).
 */
export const healthRouter = router({
  ping: publicProcedure.query(() => ({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
  })),

  /**
   * Verifies we can do a round-trip to Postgres (`SELECT 1`). Used by
   * Railway's health-check probe; failing this should mark the deploy
   * as unhealthy.
   */
  db: publicProcedure.query(async () => {
    const start = performance.now();
    await dbClient.sql`SELECT 1`;
    return {
      status: 'ok' as const,
      latencyMs: Math.round(performance.now() - start),
    };
  }),
});
