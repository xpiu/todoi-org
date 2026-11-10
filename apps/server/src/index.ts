/**
 * Production: one process serves the pages, the API, the generated files and
 * the built client assets. Migrations run before the server listens.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { connect } from '@todoi/db';
import { runMigrations } from '@todoi/db/migrate';
import { createApp } from './app.ts';
import { loadEnv } from './env.ts';
import { serverApi } from './ssr-api.ts';
import { DirectoryStore } from './store.ts';

const here = dirname(fileURLToPath(import.meta.url));
const env = loadEnv();
const webDist = resolve(process.env.WEB_DIST ?? resolve(here, '../../web/dist'));

interface ManifestChunk {
  file: string;
  css?: string[];
  isEntry?: boolean;
}
const manifest = JSON.parse(readFileSync(resolve(webDist, 'client/.vite/manifest.json'), 'utf8')) as Record<
  string,
  ManifestChunk
>;
const entry = manifest['src/entry-client.tsx'];
if (!entry) throw new Error('client manifest has no src/entry-client.tsx');
// The entry's own stylesheets: the global sheet and everything the public pages import.
const assets = { scripts: [`/${entry.file}`], styles: (entry.css ?? []).map((f) => `/${f}`) };

const ssrEntry = resolve(webDist, 'server/entry-server.js');
if (!existsSync(ssrEntry)) throw new Error(`no server bundle at ${ssrEntry}; run pnpm build`);
const { render } = (await import(pathToFileURL(ssrEntry).href)) as typeof import('@todoi/web/entry-server');

const database = connect(env.DATABASE_URL);
if (process.env.MIGRATE_ON_START !== 'false') {
  // Bundled, import.meta.url points at dist/: name the folder (the image sets MIGRATIONS_DIR).
  await runMigrations(database.db, resolve(process.env.MIGRATIONS_DIR ?? resolve(here, '../../../packages/db/migrations')));
  console.log('migrations applied');
}
const store = new DirectoryStore(database.db);

const app = createApp({
  db: database.db,
  store,
  env,
  staticRoot: resolve(webDist, 'client'),
  render: (request) => render({ request, api: serverApi(store), assets, siteUrl: env.SITE_URL }),
});

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  console.log(`todoi.org listening on http://${info.address}:${info.port}`);
});

const shutdown = () => {
  server.close(() => void database.close().then(() => process.exit(0)));
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
