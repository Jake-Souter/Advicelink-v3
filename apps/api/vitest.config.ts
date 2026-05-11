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
    testTimeout: 20_000,
    hookTimeout: 20_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
