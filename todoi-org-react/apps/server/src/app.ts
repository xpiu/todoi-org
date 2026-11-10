import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { compress } from 'hono/compress';
import { etag } from 'hono/etag';
import type { Db } from '@todoi/db';
import type { Env } from './env.ts';
import { HttpProblem } from './errors.ts';
import { directoryCsv } from './generate/csv.ts';
import { jsonLdScript } from './generate/jsonld.ts';
import { llmsTxt, sitemapXml } from './generate/site-files.ts';
import { securityHeaders } from './middleware/security.ts';
import { publicApi } from './routes/public.ts';
import { adminApi } from './routes/admin.ts';
import { authApi } from './routes/auth.ts';
import { loadSession, sameOrigin } from './auth.ts';
import type { DirectoryStore } from './store.ts';
import type { AppEnv } from './types.ts';
import { sql } from 'drizzle-orm';

export type RenderPage = (request: Request) => Promise<Response>;

export interface AppDeps {
  db: Db;
  store: DirectoryStore;
  env: Env;
  /** Server-renders a page; dev passes Vite's module graph, production the built bundle. */
  render: RenderPage;
  /** Off in development, where the code under the page changes between requests. */
  cachePages?: boolean;
  /** Production: the built client (fingerprinted assets, fonts, icons, images). */
  staticRoot?: string;
}

/** The typed API surface the browser client is generated from (Hono RPC). */
const api = new Hono<AppEnv>()
  .basePath('/api/v1')
  .route('/', publicApi)
  .route('/auth', authApi)
  .route('/admin', adminApi);
export type AppType = typeof api;

/** Rendered pages, keyed by URL, kept until the data changes. */
class PageCache {
  private pages = new Map<string, { body: string; status: number; headers: [string, string][]; etag: string }>();
  constructor(private readonly max = 300) {}
  get(key: string) {
    const hit = this.pages.get(key);
    if (hit) {
      // Least recently used goes first: re-insert on every hit.
      this.pages.delete(key);
      this.pages.set(key, hit);
    }
    return hit;
  }
  set(key: string, value: { body: string; status: number; headers: [string, string][]; etag: string }) {
    this.pages.set(key, value);
    if (this.pages.size > this.max) this.pages.delete(this.pages.keys().next().value!);
  }
  clear() {
    this.pages.clear();
  }
}

function weakTag(body: string): string {
  return `W/"${createHash('sha1').update(body).digest('base64url').slice(0, 27)}"`;
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  const pages = new PageCache();
  deps.store.onInvalidate(() => pages.clear());

  app.use('*', async (c, next) => {
    c.set('db', deps.db);
    c.set('store', deps.store);
    c.set('env', deps.env);
    c.set('user', null);
    await next();
  });
  app.use('*', securityHeaders);
  // Text compressed on the way out, as nginx did: the commercial page is 1.3 MB raw.
  app.use('*', compress({ threshold: 1024 }));

  // One URL per page: /index.html and /dir/index.html are the directory URLs.
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    const m = /^(.*\/)index\.html$/.exec(url.pathname);
    if (m) return c.redirect(`${m[1]}${url.search}`, 301);
    // Dotfiles are never addresses.
    if (/(^|\/)\.[^/]/.test(url.pathname) && !url.pathname.startsWith('/.well-known/')) {
      return c.notFound();
    }
    return next();
  });

  app.onError((err, c) => {
    const problem =
      err instanceof HttpProblem ? err : new HttpProblem(500, 'internal', 'Something went wrong on our side.');
    if (!(err instanceof HttpProblem)) console.error(err);
    if (c.req.path.startsWith('/api/')) return c.json(problem.body(), problem.status);
    return c.text(problem.message, problem.status);
  });
  app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) return c.json(new HttpProblem(404, 'not_found', 'No such endpoint.').body(), 404);
    return renderPage(c.req.raw, 404);
  });

  app.get('/healthz', async (c) => {
    try {
      await deps.db.execute(sql`select 1`);
      return c.json({ ok: true, db: 'up' });
    } catch {
      return c.json({ ok: false, db: 'down' }, 503);
    }
  });

  app.use('/api/v1/directories/*', etag({ weak: true }));
  // Sessions and writes: the editor's API only. Public pages never read a cookie.
  app.use('/api/v1/auth/*', sameOrigin, loadSession);
  app.use('/api/v1/admin/*', sameOrigin, loadSession);
  app.route('/', api);

  // The datasets, at the URLs they have always had.
  app.get('/:file{todoi-[a-z-]*dataset-\\d{4}-\\d{2}-\\d{2}\\.csv}', etag({ weak: true }), async (c) => {
    const dir = await deps.store.byCsv(c.req.param('file'));
    if (!dir) return c.notFound();
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Cache-Control', 'no-cache');
    return c.body(directoryCsv(dir));
  });

  const allDirectories = async () =>
    (await Promise.all((await deps.store.list()).map((d) => deps.store.get(d.slug)))).filter((d) => d !== null);

  app.get('/sitemap.xml', etag({ weak: true }), async (c) => {
    c.header('Content-Type', 'application/xml; charset=utf-8');
    c.header('Cache-Control', 'no-cache');
    return c.body(sitemapXml(await allDirectories(), deps.env.SITE_URL));
  });

  app.get('/llms.txt', etag({ weak: true }), async (c) => {
    c.header('Content-Type', 'text/plain; charset=utf-8');
    c.header('Cache-Control', 'no-cache');
    return c.body(llmsTxt(await allDirectories()));
  });

  /** The JSON-LD graph goes in after the render, last in <body>, as the static pages had it. */
  async function decorate(path: string, html: string): Promise<string> {
    const dir = await deps.store.byPath(path);
    if (!dir) return html;
    const i = html.lastIndexOf('</body>');
    return i < 0 ? html : `${html.slice(0, i)}${jsonLdScript(dir, deps.env.SITE_URL)}\n${html.slice(i)}`;
  }

  async function renderPage(request: Request, forceStatus?: number): Promise<Response> {
    const url = new URL(request.url);
    const key = `${url.pathname}${url.search}`;
    let page = pages.get(key);
    if (!page) {
      const res = await deps.render(request);
      const body = res.status === 200 ? await decorate(url.pathname, await res.text()) : await res.text();
      page = {
        body,
        status: forceStatus ?? res.status,
        headers: [...res.headers.entries()].filter(([k]) => k.toLowerCase() !== 'content-length'),
        etag: weakTag(body),
      };
      // Only complete pages are kept; an error is rendered again next time.
      if (deps.cachePages !== false && (page.status === 200 || page.status === 404)) pages.set(key, page);
    }
    const headers = new Headers(page.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-cache');
    headers.set('ETag', page.etag);
    if (page.status === 200 && request.headers.get('if-none-match') === page.etag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(page.body, { status: forceStatus ?? page.status, headers });
  }

  // The commercial directory's address keeps its trailing slash.
  app.get('/commercial-task-managers', (c) => c.redirect(`/commercial-task-managers/${new URL(c.req.url).search}`, 301));

  if (deps.staticRoot) {
    const root = deps.staticRoot;
    // Fingerprinted by Vite: the name changes when the content does.
    app.use(
      '/assets/*',
      serveStatic({ root, onFound: (_p, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable') }),
    );
    // Fonts, icons and images rarely change.
    app.use(
      '/:dir{fonts|icons|img}/*',
      serveStatic({ root, onFound: (_p, c) => c.header('Cache-Control', 'public, max-age=2592000') }),
    );
    app.get('/robots.txt', serveStatic({ root, onFound: (_p, c) => c.header('Cache-Control', 'no-cache') }));
  }

  app.get('*', (c) => renderPage(c.req.raw));

  return app;
}
