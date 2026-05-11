import { defineConfig } from 'vitest/config';

/**
 * apps/api tests touch the real Railway dev DB (RLS + tenant resolver
 * contracts). Run via:
 *
 *   doppler run --project advicelink-api --config dev -- pnpm --filter @advicelink/api test
 *
 * Without DATABASE_URL the suites skip at the describe level so the
 * fast CI tier (lint + typecheck) keeps passing.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Tests connect to Railway via the public TCP proxy from a laptop;
    // a Fact Find lock test makes ~6 round-trips (load + upsert +
    // load + lock + select + select). 60s leaves comfortable headroom
    // even on slow network days. The same value is used by the
    // packages/db RLS suite.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
