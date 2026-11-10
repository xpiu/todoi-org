import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Db } from './index.ts';

/** Where the committed SQL migrations live; the Docker image copies the same folder. */
export const MIGRATIONS = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../migrations', import.meta.url));

export async function runMigrations(db: Db, folder = MIGRATIONS): Promise<void> {
  await migrate(db, { migrationsFolder: folder });
}
