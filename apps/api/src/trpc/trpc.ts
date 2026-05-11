import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';

import type { Role } from '@advicelink/rbac';
import type { Db } from '@advicelink/db';

import { FirebaseAuthError, verifyIdToken } from '../auth/firebase.js';
import {
  resolveTenantContext,
  type ResolvedTenantUser,
} from './middleware/resolveTenant.js';
import { withTenantContext } from '../db/index.js';
import type { BaseContext } from './context.js';
import { expandAllowList } from '@advicelink/rbac';

/**
 * tRPC initialisation for the API. The error formatter:
 *   - Surfaces Zod issues as `data.zodError` so the web client can
 *     render per-field messages without re-parsing.
 *   - Maps `FirebaseAuthError` codes to stable `data.authError.code`
 *     strings the client can branch on (REBUILD_PLAN §19.21).
 *   - Tags every error with `requestId` so support has a one-line
 *     handle when a user reports "I got a red banner".
 *
 * `superjson` lets resolvers return `Date`, `BigInt`, `Map`, etc.
 * directly without serialising by hand.
 */
const t = initTRPC.context<BaseContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, ctx }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        requestId: ctx?.reqId,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
        authError:
          error.cause instanceof FirebaseAuthError
            ? { code: error.cause.code, message: error.cause.message }
            : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

/**
 * The root, no-auth procedure. Used for `health.ping` and any future
 * pre-auth flows (e.g. tenant-discovery on the login page).
 */
export const publicProcedure = t.procedure;

/**
 * `auth` middleware: requires a valid Firebase ID token. Resolves to a
 * tenant-scoped DB user via `resolveTenantContext`, then enters
 * `withTenantContext` so every resolver query is RLS-bound. Throws
 * `UNAUTHORIZED` for missing / bad tokens, `FORBIDDEN` if the
 * authenticated Firebase user has no DB row in the addressed tenant.
 *
 * The `next({ ctx })` form here REPLACES `ctx` with the augmented
 * shape, so resolvers can rely on `ctx.user`, `ctx.tenant`, `ctx.db`
 * being non-null.
 */
const authMiddleware = middleware(async ({ ctx, next, type, path }) => {
  if (!ctx.rawIdToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Missing Authorization: Bearer header',
      cause: new FirebaseAuthError('missing_token', 'Missing Authorization: Bearer header'),
    });
  }
  if (!ctx.tenantSlug) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Tenant slug missing from request URL — every authenticated call must go through /t/:tenantSlug/trpc/...',
    });
  }

  let token;
  try {
    token = await verifyIdToken(ctx.rawIdToken);
  } catch (err) {
    if (err instanceof FirebaseAuthError) {
      throw new TRPCError({
        code: err.code === 'expired_token' || err.code === 'revoked_token'
          ? 'UNAUTHORIZED'
          : 'UNAUTHORIZED',
        message: err.message,
        cause: err,
      });
    }
    throw err;
  }

  const resolved: ResolvedTenantUser = await resolveTenantContext(ctx.dbClient, {
    firebaseUid: token.uid,
    tenantSlug: ctx.tenantSlug,
  });

  const childLogger = ctx.logger.child({
    userId: resolved.user.id,
    tenantId: resolved.tenant.id,
    role: resolved.user.role,
    proc: `${type}:${path}`,
  });

  return withTenantContext(
    ctx.dbClient,
    {
      tenantId: resolved.tenant.id,
      userId: resolved.user.id,
      userRole: resolved.user.role,
    },
    (tx: Db) =>
      next({
        ctx: {
          ...ctx,
          logger: childLogger,
          firebaseToken: token,
          user: resolved.user,
          tenant: resolved.tenant,
          db: tx,
        },
      }),
  );
});

/** Procedure that requires a verified Firebase user inside a known tenant. */
export const authedProcedure = t.procedure.use(authMiddleware);

/**
 * Tighten an authedProcedure to a specific role allow-list. Tenant +
 * platform super-admins are ALWAYS allowed (escape hatch from §4.1) —
 * `expandAllowList()` adds them automatically. Throws `FORBIDDEN` with
 * a message that includes the user's actual role so support can
 * diagnose mis-assignments without enabling debug logging.
 *
 * Note: composing via `authedProcedure.use(fn)` (NOT the standalone
 * `middleware(fn)`) is what threads the augmented `ctx.user` through —
 * standalone middleware always starts from `BaseContext`.
 */
export function withRoles(allow: readonly Role[]) {
  const allowSet = expandAllowList(allow);
  return authedProcedure.use(async ({ ctx, next }) => {
    if (!allowSet.has(ctx.user.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Role '${ctx.user.role}' is not permitted to call this procedure (allow: ${[...allowSet].join(', ')})`,
      });
    }
    return next();
  });
}
