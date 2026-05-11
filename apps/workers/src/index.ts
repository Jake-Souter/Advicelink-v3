import * as Sentry from '@sentry/node';
import { Worker, type Processor } from 'bullmq';
import { Redis } from 'ioredis';

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

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Per-queue concurrency comes from REBUILD_PLAN §19.19.2.
const concurrencyByQueue: Record<string, number> = {
  documents: env.WORKER_CONCURRENCY_DOCUMENTS,
  ai: env.WORKER_CONCURRENCY_AI,
  esign: 4,
  cron: 1,
  virusScan: 4,
};

// Real processors arrive in their respective work packages (documents in WP9,
// ai in WP8, esign in WP10, cron in WP12+). For now each queue has a no-op
// processor so the boot path is exercised and observability surfaces are
// alive.
const noopProcessor: Processor = async (job) => {
  logger.warn({ queue: job.queueName, jobId: job.id }, 'noop processor — replace in WP-N');
};

const workers = env.WORKER_QUEUES.map((queue) => {
  const worker = new Worker(queue, noopProcessor, {
    connection,
    concurrency: concurrencyByQueue[queue] ?? 1,
    autorun: true,
  });
  worker.on('failed', (job, err) => {
    logger.error({ queue, jobId: job?.id, err }, 'job failed');
  });
  worker.on('ready', () => logger.info({ queue }, 'worker ready'));
  return worker;
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutting down workers');
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
