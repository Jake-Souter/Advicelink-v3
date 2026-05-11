import { pino, type Logger, type LoggerOptions } from 'pino';

export type { Logger } from 'pino';

export interface CreateLoggerOptions {
  /** Service name (e.g. 'api', 'workers'). */
  service: string;
  /** Log level. Defaults to 'info' (or 'debug' in dev). */
  level?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  /** Whether to pretty-print (use only in local dev). */
  pretty?: boolean;
  /** Git SHA / release id for tagging logs. */
  release?: string;
}

/**
 * Create a Pino logger preconfigured for Advicelink. Logs are JSON line format
 * in production and pretty-printed in dev. Per REBUILD_PLAN §12.5, structured
 * fields include `tenant_id`, `user_id`, `client_id`, `request_id`, `trace_id`,
 * and `span_id` — set them via child loggers as those values become available.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const { service, level = 'info', pretty = false, release } = options;

  const baseConfig: LoggerOptions = {
    name: service,
    level,
    base: {
      service,
      ...(release ? { release } : {}),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: [
        // Hard-coded redactions for PII that must never reach logs.
        // Per-prompt AI redaction lives in @advicelink/ai (REBUILD_PLAN §19.16).
        'req.headers.authorization',
        'req.headers.cookie',
        '*.taxFileNumber',
        '*.partnerTaxFileNumber',
        '*.healthNotes',
      ],
      censor: '[REDACTED]',
    },
  };

  if (pretty) {
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(baseConfig);
}
