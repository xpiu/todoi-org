/**
 * Production: one process serves the pages, the API, the generated files and
 * the built client assets.
 *
 * TEMP(json-store): no database. The directories are data.json, bundled
 * into this server; sign-in and the editor are off. The lines that connected,
 * migrated and mounted the editor are kept below, commented out, as the way
 * back. See docs/json-store.md.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
// TEMP(json-store): back with PostgreSQL.
// import { connect } from '@todoi/db';
// import { runMigrations } from '@todoi/db/migrate';
// import { mountEditor } from './editor-api.ts';
// import { postgresSource } from './sources/postgres.ts';
import type { render as Render } from '@todoi/web/entry-server';
import { createApp } from './app.ts';
import { loadEnv } from './env.ts';
import { jsonSource } from './sources/json.ts';
import { serverApi } from './ssr-api.ts';
import { DirectoryStore } from './store.ts';

const here = dirname(fileURLToPath(import.meta.url));
const env = loadEnv();
const webDist = resolve(process.env.WEB_DIST ?? resolve(here, '../../web/dist'));

interface ManifestChunk {
  file: string;
  css?: string[];
  imports?: string[];
  isEntry?: boolean;
}
const manifest = JSON.parse(readFileSync(resolve(webDist, 'client/.vite/manifest.json'), 'utf8')) as Record<
  string,
  ManifestChunk
>;
const entry = manifest['src/entry-client.tsx'];
if (!entry) throw new Error('client manifest has no src/entry-client.tsx');
// Every stylesheet the entry loads statically, in order: the global sheet, then
// the CSS Modules the bundler moved into shared chunks. All of it goes in <head>,
// so the first paint is styled. (Route chunks loaded later bring their own.)
function staticCss(key: string, seen = new Set<string>()): string[] {
  if (seen.has(key)) return [];
  seen.add(key);
  const chunk = manifest[key];
  if (!chunk) return [];
  return [...(chunk.imports ?? []).flatMap((k) => staticCss(k, seen)), ...(chunk.css ?? [])];
}
const assets = {
  scripts: [`/${entry.file}`],
  styles: [...new Set(staticCss('src/entry-client.tsx'))].map((f) => `/${f}`),
};

const ssrEntry = resolve(webDist, 'server/entry-server.js');
if (!existsSync(ssrEntry)) throw new Error(`no server bundle at ${ssrEntry}; run pnpm build`);
const { render } = (await import(pathToFileURL(ssrEntry).href)) as { render: typeof Render };

// TEMP(json-store): data.json is the data. A malformed seed throws here, before the server listens.
const store = new DirectoryStore(jsonSource());
console.log(`directories loaded from data.json: ${(await store.list()).map((d) => d.slug).join(', ')}`);

// TEMP(json-store): back with PostgreSQL, in place of the two lines above
// (and with DATABASE_URL and SESSION_SECRET required again in env.ts):
//
// const database = connect(env.DATABASE_URL);
// if (process.env.MIGRATE_ON_START !== 'false') {
//   // Bundled, import.meta.url points at dist/: name the folder (the image sets MIGRATIONS_DIR).
//   await runMigrations(database.db, resolve(process.env.MIGRATIONS_DIR ?? resolve(here, '../../../packages/db/migrations')));
//   console.log('migrations applied');
// }
// const store = new DirectoryStore(postgresSource(database.db));

const app = createApp({
  store,
  env,
  staticRoot: resolve(webDist, 'client'),
  render: (request) => render({ request, api: serverApi(store), assets, siteUrl: env.SITE_URL }),
  // TEMP(json-store): back with PostgreSQL, sign-in and the editor's API:
  // mount: (app) => mountEditor(app, database.db),
});

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  console.log(`todoi.org listening on http://${info.address}:${info.port}`);
});

const shutdown = () => {
  // TEMP(json-store): back with PostgreSQL, close the pool first:
  // server.close(() => void database.close().then(() => process.exit(0)));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
