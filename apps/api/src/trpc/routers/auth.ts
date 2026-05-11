import { authedProcedure, router } from '../trpc.js';

/**
 * `auth.*` — minimal at WP-3. The web app calls `whoami` on every page
 * load to materialise its session-bound `user`/`tenant`/`role` for
 * downstream authorisation checks (REBUILD_PLAN §11.3).
 */
export const authRouter = router({
  whoami: authedProcedure.query(({ ctx }) => ({
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      displayName: ctx.user.displayName,
      role: ctx.user.role,
      defaultTeamId: ctx.user.defaultTeamId,
    },
    tenant: {
      id: ctx.tenant.id,
      slug: ctx.tenant.slug,
      displayName: ctx.tenant.displayName,
      brandBundle: ctx.tenant.brandBundle,
      featureFlags: ctx.tenant.featureFlags,
    },
    firebase: {
      uid: ctx.firebaseToken.uid,
      emailVerified: ctx.firebaseToken.email_verified ?? false,
      authTime: new Date(ctx.firebaseToken.auth_time * 1000).toISOString(),
    },
  })),
});
