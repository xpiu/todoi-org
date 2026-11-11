import { configDefaults, defineConfig } from 'vitest/config';

/**
 * TEMP(json-store): the site runs on data.json, so the suite needs no
 * database. The tests that are about PostgreSQL itself (the parked editor API,
 * and the proof that the JSON store equals a seeded database) only run when a
 * test database is named:
 *
 *   TEST_DATABASE_URL=postgres://todoi:todoi@127.0.0.1:5434/todoi_test pnpm test
 *
 * With PostgreSQL back they run always again: see docs/json-store.md.
 */
const POSTGRES_TESTS = ['apps/server/src/routes/admin.test.ts', 'packages/db/src/json.test.ts'];

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'apps/*/src/**/*.test.tsx'],
    exclude: [...configDefaults.exclude, ...(process.env.TEST_DATABASE_URL ? [] : POSTGRES_TESTS)],
    environment: 'node',
    // Integration tests share one test database; run files one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
