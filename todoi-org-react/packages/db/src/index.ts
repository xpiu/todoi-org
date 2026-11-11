/*
 * PARKED, TEMP(json-store): the PostgreSQL side of this package (connection,
 * queries, mutations, seeding, passwords). The site does not import this entry
 * at run time for now; it reads the seed files through ./json.ts instead, and
 * only this package's types are used. Kept whole for the return to PostgreSQL:
 * docs/json-store.md.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

export * as schema from './schema.ts';
export type Db = NodePgDatabase<typeof schema>;

export interface Database {
  db: Db;
  pool: pg.Pool;
  close(): Promise<void>;
}

// numeric comes back from node-postgres as a string; the schema maps it with
// mode: 'number'. date stays a 'YYYY-MM-DD' string, never a shifted Date.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export function connect(url: string, opts: { max?: number } = {}): Database {
  const pool = new pg.Pool({ connectionString: url, max: opts.max ?? 10 });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, pool, close: () => pool.end() };
}

export { seedDatabase } from './seed.ts';
export { hashPassword, verifyPassword, DUMMY_HASH } from './password.ts';
export * from './queries.ts';
export * from './mutations.ts';
