/**
 * PARKED, TEMP(json-store): the directories from PostgreSQL. Nothing imports
 * this while the site runs on the seed files (sources/json.ts), so `pg` and
 * Drizzle stay out of the server bundle. It is kept compiled, and exercised by
 * routes/admin.test.ts, so the way back is a change of wiring, not a rewrite.
 * See docs/json-store.md.
 */
import { listDirectories, loadFullDirectory, type Db } from '@todoi/db';
import type { DirectorySource } from '../store.ts';

export function postgresSource(db: Db): DirectorySource {
  return {
    list: () => listDirectories(db),
    load: (slug) => loadFullDirectory(db, slug),
  };
}
