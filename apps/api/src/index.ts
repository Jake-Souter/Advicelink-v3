import * as Sentry from '@sentry/node';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { createLogger } from '@advicelink/logger';

import { env } from './config/env.js';

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

  // tRPC router will mount here in Work Package 3.
  // app.register(fastifyTRPCPlugin, { prefix: '/trpc', trpcOptions: { router, createContext } });

  // Webhooks are the only non-tRPC HTTP endpoints (REBUILD_PLAN §3).
  // app.register(docusignWebhookRoutes, { prefix: '/webhooks/docusign' });

  try {
    await app.listen({ host: '0.0.0.0', port: env.PORT });
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening');
  } catch (err) {
    logger.fatal({ err }, 'failed to start api');
    process.exit(1);
  }
}

void bootstrap();
