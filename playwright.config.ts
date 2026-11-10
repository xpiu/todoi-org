import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against a production build by default (`pnpm build`, then the
 * server starts here against the test database). Set E2E_BASE_URL to point
 * at a server you already run, such as `pnpm dev`.
 *
 * The parity suite also needs the static site served somewhere:
 *   STATIC_URL=http://127.0.0.1:8080 pnpm e2e parity
 */
const external = process.env.E2E_BASE_URL;
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = external ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: external
    ? undefined
    : {
        command: 'node e2e/tools/serve-test.mjs',
        url: `${baseURL}/healthz`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { E2E_PORT: String(port) },
      },
});
