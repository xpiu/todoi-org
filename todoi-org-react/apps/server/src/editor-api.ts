/**
 * PARKED, TEMP(json-store): sign-in and the editor's API, the only parts of the
 * server that write, and so the only parts that need PostgreSQL.
 *
 * While the site runs on data.json, index.ts and dev.ts do not mount
 * this: /api/v1/auth/* and /api/v1/admin/* answer 404, and `pg` and Drizzle
 * are not in the server bundle. The code is kept whole and compiled, and
 * routes/admin.test.ts still runs it when a test database is given
 * (TEST_DATABASE_URL), so it cannot rot unnoticed.
 *
 * To switch it back on, pass it to createApp (docs/json-store.md has the
 * full list):
 *
 *   const database = connect(env.DATABASE_URL);
 *   const store = new DirectoryStore(postgresSource(database.db));
 *   createApp({ store, env, render, mount: (app) => mountEditor(app, database.db) });
 */
import { Hono } from 'hono';
import type { Db } from '@todoi/db';
import { loadSession, sameOrigin } from './auth.ts';
import { adminApi } from './routes/admin.ts';
import { authApi } from './routes/auth.ts';
import type { AppEnv, EditorEnv } from './types.ts';

function editorApi(db: Db) {
  return (
    new Hono<EditorEnv>()
      .basePath('/api/v1')
      // Sessions and writes: the editor's API only. Public pages never read a cookie.
      .use('/auth/*', async (c, next) => {
        c.set('db', db);
        await next();
      })
      .use('/admin/*', async (c, next) => {
        c.set('db', db);
        await next();
      })
      .use('/auth/*', sameOrigin, loadSession)
      .use('/admin/*', sameOrigin, loadSession)
      .route('/auth', authApi)
      .route('/admin', adminApi)
  );
}

/** The editor's typed API surface: what apps/web/src/features/admin/api.ts builds its client from. */
export type EditorAppType = ReturnType<typeof editorApi>;

/** For createApp's `mount`: adds sign-in and the editor's API, backed by `db`. */
export function mountEditor(app: Hono<AppEnv>, db: Db): void {
  app.route('/', editorApi(db));
}
