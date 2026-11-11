// Playwright's web server: run the production build.
//
// TEMP(json-store): the build serves data.json and needs no database, so
// there is nothing to reset first. The lines that prepared the test database
// and passed its address are kept below, commented out, for the return to
// PostgreSQL: see docs/json-store.md.
import { spawn } from 'node:child_process';
// TEMP(json-store): back with PostgreSQL.
// import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const port = process.env.E2E_PORT ?? '3100';
// TEMP(json-store): back with PostgreSQL.
// const database = process.env.TEST_DATABASE_URL ?? 'postgres://todoi:todoi@127.0.0.1:5434/todoi_test';

if (!existsSync(`${root}/apps/server/dist/index.js`) || !existsSync(`${root}/apps/web/dist/server/entry-server.js`)) {
  console.error('No production build: run `pnpm build` first.');
  process.exit(1);
}

// TEMP(json-store): back with PostgreSQL, reset the test database and create the e2e editor.
// const prep = spawnSync('pnpm', ['--filter', '@todoi/db', 'exec', 'tsx', 'src/scripts/prepare-test.ts'], {
//   cwd: root,
//   stdio: 'inherit',
//   env: { ...process.env, TEST_DATABASE_URL: database },
// });
// if (prep.status !== 0) process.exit(prep.status ?? 1);

// The server must not find a database by accident: whatever the shell has set, it is not passed on.
const { DATABASE_URL: _url, TEST_DATABASE_URL: _testUrl, SESSION_SECRET: _secret, ...inherited } = process.env;

const server = spawn('node', ['apps/server/dist/index.js'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...inherited,
    NODE_ENV: 'test',
    PORT: port,
    HOST: '127.0.0.1',
    SITE_URL: 'https://todoi.org',
    // TEMP(json-store): back with PostgreSQL.
    // DATABASE_URL: database,
    // SESSION_SECRET: 'e2e-session-secret-e2e-session-secret',
  },
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
server.on('exit', (code) => process.exit(code ?? 0));
