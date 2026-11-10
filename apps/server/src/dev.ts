/**
 * Development: Hono and Vite on one port. Vite's middlewares answer module,
 * asset and HMR requests; everything else goes to the Hono app, which renders
 * pages through Vite's module graph so a change to a component shows on the
 * next request without a restart.
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getRequestListener } from '@hono/node-server';
import { createServer as createViteServer } from 'vite';
import { connect } from '@todoi/db';
import { createApp } from './app.ts';
import { loadEnv } from './env.ts';
import { serverApi } from './ssr-api.ts';
import { DirectoryStore } from './store.ts';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = loadEnv();
const webRoot = fileURLToPath(new URL('../../web', import.meta.url));
const database = connect(env.DATABASE_URL);
const store = new DirectoryStore(database.db);
const httpServer = createServer();

const vite = await createViteServer({
  root: webRoot,
  configFile: `${webRoot}/vite.config.ts`,
  appType: 'custom',
  server: { middlewareMode: true, hmr: { server: httpServer } },
});

/** The shape of apps/web/src/entry-server.tsx, declared here so the server does not depend on the web package. */
interface EntryServer {
  render(opts: {
    request: Request;
    api: ReturnType<typeof serverApi>;
    assets: { scripts: string[]; styles: string[]; preamble?: string };
    siteUrl: string;
  }): Promise<Response>;
}

const preamble = `import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;`;

const app = createApp({
  db: database.db,
  store,
  env,
  cachePages: false,
  async render(request) {
    const mod = (await vite.ssrLoadModule('/src/entry-server.tsx')) as EntryServer;
    return mod.render({
      request,
      api: serverApi(store),
      // A plain <link> to the stylesheet avoids a flash of unstyled page in dev.
      assets: { scripts: ['/@vite/client', '/src/entry-client.tsx'], styles: ['/src/styles/global.css'], preamble },
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
  await database.close();
  httpServer.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
