import { defineConfig } from 'vitest/config';

/**
 * Tests in this package hit a real Postgres (no in-memory mock — RLS
 * cannot be exercised against pgmock-style shims). Run via:
 *
 *   doppler run --project advicelink-api --config dev -- pnpm --filter @advicelink/db test
 *
 * Without DATABASE_URL the suite skips at the describe level so CI can
 * still execute the rest of the workspace's typecheck / lint without
 * failing on a missing DB.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Tests hit Railway's public proxy (high RTT compared to a local DB),
    // and several scenarios open 5+ short transactions back-to-back to
    // exercise different role contexts. 60s gives healthy headroom.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
