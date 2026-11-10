// Playwright's web server: reset the test database, then run the production build against it.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const port = process.env.E2E_PORT ?? '3100';
const database = process.env.TEST_DATABASE_URL ?? 'postgres://todoi:todoi@127.0.0.1:5434/todoi_test';

if (!existsSync(`${root}/apps/server/dist/index.js`) || !existsSync(`${root}/apps/web/dist/server/entry-server.js`)) {
  console.error('No production build: run `pnpm build` first.');
  process.exit(1);
}

const prep = spawnSync('pnpm', ['--filter', '@todoi/db', 'exec', 'tsx', 'src/scripts/prepare-test.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TEST_DATABASE_URL: database },
});
if (prep.status !== 0) process.exit(prep.status ?? 1);

const server = spawn('node', ['apps/server/dist/index.js'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: port,
    HOST: '127.0.0.1',
    DATABASE_URL: database,
    SITE_URL: 'https://todoi.org',
    SESSION_SECRET: 'e2e-session-secret-e2e-session-secret',
  },
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
server.on('exit', (code) => process.exit(code ?? 0));
