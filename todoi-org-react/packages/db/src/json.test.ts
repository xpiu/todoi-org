/*
 * PARKED, TEMP(json-store): the proof that the JSON store (json.ts) is the
 * database's twin. It seeds a PostgreSQL test database from the same files and
 * compares what each side hands the application, field for field.
 *
 * It needs PostgreSQL, so `pnpm test` leaves it out (vitest.config.ts) unless
 * a test database is named:
 *
 *   docker compose up -d
 *   TEST_DATABASE_URL=postgres://todoi:todoi@127.0.0.1:5434/todoi_test pnpm test
 *
 * Run it before switching back (docs/json-store.md): if it passes, the seed
 * files and a freshly seeded database serve the same site.
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, listDirectories, loadFullDirectory, type Database } from './index.ts';
import { loadSeedDirectories } from './json.ts';
import { runMigrations } from './migrate.ts';
import { readSeeds, seedDatabase } from './seed.ts';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://todoi:todoi@127.0.0.1:5434/todoi_test';

let database: Database;
beforeAll(async () => {
  const name = new URL(url).pathname.slice(1);
  if (!/_test$|_e2e$|_ci$/.test(name)) throw new Error(`refusing to reset "${name}": test databases end in _test, _e2e or _ci`);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query('select 1 from pg_database where datname = $1', [name]);
  if (!exists.rowCount) await client.query(`create database "${name.replace(/"/g, '""')}"`);
  await client.end();

  database = connect(url, { max: 4 });
  await runMigrations(database.db);
  await seedDatabase(database.db, await readSeeds(), { reset: true });
});
afterAll(() => database.close());

describe('the JSON store', () => {
  const fromJson = loadSeedDirectories();

  it('lists the directories PostgreSQL lists, in the same order', async () => {
    const listing = fromJson.map((d) => ({ slug: d.config.slug, path: d.config.path, csvFile: d.config.csvFile }));
    expect(listing).toEqual(await listDirectories(database.db));
  });

  it.each(fromJson.map((d) => [d.config.slug, d] as const))(
    'returns %s exactly as loadFullDirectory does from a freshly seeded database',
    async (slug, directory) => {
      const fromPostgres = await loadFullDirectory(database.db, slug);
      expect(fromPostgres).not.toBeNull();
      // Record by record first, so a failure names the record.
      for (const [i, record] of directory.records.entries()) {
        expect(record, record.slug).toEqual(fromPostgres!.records[i]);
      }
      expect(directory).toEqual(fromPostgres);
    },
  );
});
