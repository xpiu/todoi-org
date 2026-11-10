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
    db: Db;
    store: DirectoryStore;
    env: Env;
    user: SessionUser | null;
  };
}
