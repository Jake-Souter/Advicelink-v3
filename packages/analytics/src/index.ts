import { PostHog } from 'posthog-node';

import { type EventName } from './eventTaxonomy.js';

export { EVENT } from './eventTaxonomy.js';
export type { EventName } from './eventTaxonomy.js';

export interface AnalyticsConfig {
  /** PostHog project key. */
  apiKey: string;
  /** PostHog host. Self-hosted or `https://app.posthog.com`. */
  host: string;
  /** When false, captures are no-ops. Useful for tests. */
  enabled?: boolean;
  /** Flush interval, ms. */
  flushAt?: number;
}

export interface CaptureOptions {
  /** PostHog distinct id (typically `users.id`). */
  distinctId: string;
  /** PostHog event name from the taxonomy. */
  event: EventName;
  /** Additional event properties. PII must already be redacted. */
  properties?: Record<string, unknown>;
  /** Tenant id is set as a group property for cohorting. */
  tenantId?: string;
}

export interface Analytics {
  capture(options: CaptureOptions): void;
  shutdown(): Promise<void>;
}

class NoopAnalytics implements Analytics {
  capture(): void {
    // intentional no-op
  }
  async shutdown(): Promise<void> {
    // intentional no-op
  }
}

/**
 * Build a PostHog-backed analytics client. Returns a no-op when `enabled` is
 * false or no key is provided (e.g. CI/test runs). Always check the
 * eventTaxonomy module before adding a new event.
 */
export function createAnalytics(config: AnalyticsConfig): Analytics {
  if (config.enabled === false || !config.apiKey) {
    return new NoopAnalytics();
  }

  const client = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: config.flushAt ?? 20,
  });

  return {
    capture({ distinctId, event, properties, tenantId }) {
      client.capture({
        distinctId,
        event,
        properties: {
          ...properties,
          ...(tenantId ? { $groups: { tenant: tenantId } } : {}),
        },
      });
    },
    async shutdown() {
      await client.shutdown();
    },
  };
}
