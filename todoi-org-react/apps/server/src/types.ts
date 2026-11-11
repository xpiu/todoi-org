import type { Db } from '@todoi/db';
import type { Env } from './env.ts';
import type { DirectoryStore } from './store.ts';

export interface SessionUser {
  id: number;
  email: string;
  csrfToken: string;
  sessionId: string;
}

/** What every handler can reach through c.var. */
export interface AppEnv {
  Variables: {
    store: DirectoryStore;
    env: Env;
    user: SessionUser | null;
  };
}

/**
 * PARKED, TEMP(json-store): what the editor's handlers (auth.ts, routes/auth.ts,
 * routes/admin.ts) reach as well: the database. Only editor-api.ts sets it, and
 * nothing mounts editor-api.ts while the site runs on the seed files.
 * See docs/json-store.md.
 */
export interface EditorEnv {
  Variables: AppEnv['Variables'] & { db: Db };
}
