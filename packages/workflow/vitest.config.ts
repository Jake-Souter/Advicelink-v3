import { defineConfig } from 'vitest/config';

/**
 * Pure unit tests — no external dependencies, no DB, no env. Safe to
 * run in CI without any setup.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
