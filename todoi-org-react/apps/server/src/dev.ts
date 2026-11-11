/**
 * Development: Hono and Vite on one port. Vite's middlewares answer module,
 * asset and HMR requests; everything else goes to the Hono app, which renders
 * pages through Vite's module graph so a change to a component shows on the
 * next request without a restart.
 *
 * TEMP(json-store): no database here either. The directories are the seed
 * files; `tsx watch` restarts this server when one of them is saved. The lines
 * that connected to PostgreSQL are kept below, commented out. See
 * docs/json-store.md.
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRequestListener } from '@hono/node-server';
import { createServer as createViteServer } from 'vite';
// TEMP(json-store): back with PostgreSQL.
// import { connect } from '@todoi/db';
// import { mountEditor } from './editor-api.ts';
// import { postgresSource } from './sources/postgres.ts';
import { createApp } from './app.ts';
import { loadEnv } from './env.ts';
import { jsonSource } from './sources/json.ts';
import { serverApi } from './ssr-api.ts';
import { DirectoryStore } from './store.ts';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = loadEnv();
const webRoot = fileURLToPath(new URL('../../web', import.meta.url));
// TEMP(json-store): the seed files are the data. Back with PostgreSQL:
// const database = connect(env.DATABASE_URL);
// const store = new DirectoryStore(postgresSource(database.db));
const store = new DirectoryStore(jsonSource());
const httpServer = createServer();

const vite = await createViteServer({
  root: webRoot,
  configFile: `${webRoot}/vite.config.ts`,
  appType: 'custom',
  server: { middlewareMode: true, hmr: { server: httpServer } },
});

/**
 * Every stylesheet's compiled CSS, in the cascade order styles/modules.ts
 * imports them. Without these in the server's HTML, the CSS Modules would
 * arrive only through JavaScript and the page would first paint unstyled
 * (the hero logo at full width). Each tag carries the id Vite's client looks
 * for, so the client adopts it rather than adding a second copy, and hot
 * reload updates it in place.
 */
const stylesDir = `${webRoot}/src/styles`;
async function inlineStyles() {
  const order = await readFile(`${stylesDir}/modules.ts`, 'utf8');
  const files = [...order.matchAll(/^import (?:\w+ from )?'([^']+\.css)';$/gm)].map((m) => resolve(stylesDir, m[1]!));
  return Promise.all(
    files.map(async (file) => {
      const result = await vite.environments.client.transformRequest(`/@fs${file}?direct`);
      return { id: file, css: result?.code ?? '' };
    }),
  );
}

/** The shape of apps/web/src/entry-server.tsx, declared here so the server does not depend on the web package. */
interface EntryServer {
  render(opts: {
    request: Request;
    api: ReturnType<typeof serverApi>;
    assets: {
      scripts: string[];
      styles: string[];
      preamble?: string;
      inlineStyles?: { id: string; css: string }[];
    };
    siteUrl: string;
  }): Promise<Response>;
}

const preamble = `import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;`;

const app = createApp({
  store,
  env,
  cachePages: false,
  // TEMP(json-store): back with PostgreSQL, sign-in and the editor's API:
  // mount: (app) => mountEditor(app, database.db),
  async render(request) {
    const mod = (await vite.ssrLoadModule('/src/entry-server.tsx')) as EntryServer;
    return mod.render({
      request,
      api: serverApi(store),
      assets: { scripts: ['/@vite/client', '/src/entry-client.tsx'], styles: [], inlineStyles: await inlineStyles(), preamble },
      siteUrl: env.SITE_URL,
    });
  },
});

const hono = getRequestListener(app.fetch);
httpServer.on('request', (req, res) => {
  vite.middlewares(req, res, () => {
    void hono(req, res);
  });
});
httpServer.listen(env.PORT, env.HOST, () => {
  console.log(`todoi.org dev server on http://localhost:${env.PORT}`);
});

const shutdown = async () => {
  await vite.close();
  // TEMP(json-store): back with PostgreSQL.
  // await database.close();
  httpServer.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
