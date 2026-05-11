import * as Sentry from '@sentry/node';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';

import { createLogger } from '@advicelink/logger';

import { env } from './config/env.js';
import { appRouter, type AppRouter } from './trpc/router.js';
import { createContextFactory } from './trpc/context.js';

const logger = createLogger({
  service: env.OTEL_SERVICE_NAME,
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
});

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 1024 * 1024 * 5, // 5 MB; documents handled out-of-band via S3.
    // Tenant-scoped tRPC routes use a `/t/:tenantSlug/trpc/...` path
    // prefix at v1 (subdomain support flips on once Cloudflare lands).
    // Ignore trailing slashes so curl-friendly URLs work. Fastify 5
    // moved router options under `routerOptions` (was top-level in v4).
    routerOptions: { ignoreTrailingSlash: true },
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: [env.WEB_BASE_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_PER_MIN_DEFAULT,
    timeWindow: '1 minute',
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: env.OTEL_SERVICE_NAME,
    timestamp: new Date().toISOString(),
  }));

  const createContext = createContextFactory({ rootLogger: logger });

  // No-tenant entry point — used for `health.*` and any pre-auth flow.
  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ error, path, type, ctx }) {
        logger.error(
          {
            err: error,
            trpcPath: path,
            trpcType: type,
            reqId: ctx?.reqId,
          },
          'tRPC error',
        );
        if (env.SENTRY_DSN && error.code === 'INTERNAL_SERVER_ERROR') {
          Sentry.captureException(error, { extra: { trpcPath: path, trpcType: type } });
        }
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
  });

  // Tenant-scoped entry point — every authed procedure lives under here.
  // `tenantSlug` is resolved by `createContext` reading the request URL.
  await app.register(fastifyTRPCPlugin, {
    prefix: '/t/:tenantSlug/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ error, path, type, ctx }) {
        logger.error(
          {
            err: error,
            trpcPath: path,
            trpcType: type,
            tenantSlug: ctx?.tenantSlug,
            reqId: ctx?.reqId,
          },
          'tenant-scoped tRPC error',
        );
        if (env.SENTRY_DSN && error.code === 'INTERNAL_SERVER_ERROR') {
          Sentry.captureException(error, {
            extra: { trpcPath: path, trpcType: type, tenantSlug: ctx?.tenantSlug },
          });
        }
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
  });

  // Webhooks land under `/webhooks/*` from WP-10 onwards (REBUILD_PLAN §3).

  try {
    await app.listen({ host: '0.0.0.0', port: env.PORT });
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening');
  } catch (err) {
    logger.fatal({ err }, 'failed to start api');
    process.exit(1);
  }
}

void bootstrap();
