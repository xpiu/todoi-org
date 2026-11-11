/*
 * PARKED, TEMP(json-store): the PostgreSQL test database, for routes/admin.test.ts only.
 * The site runs on data.json for now and nothing mounts this
 * (see editor-api.ts). Kept whole and compiled for the return to PostgreSQL:
 * docs/json-store.md.
 */
import pg from 'pg';
import { connect, type Database } from '@todoi/db';
import { runMigrations } from '@todoi/db/migrate';
import { readSeeds, seedDatabase } from '@todoi/db/seed';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://todoi:todoi@127.0.0.1:5434/todoi_test';

/** Create the test database if needed, migrate it and reload the seed. */
export async function testDatabase(): Promise<Database> {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  const admin = new URL(TEST_DATABASE_URL);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query('select 1 from pg_database where datname = $1', [name]);
  if (!exists.rowCount) await client.query(`create database "${name.replace(/"/g, '""')}"`);
  await client.end();

  const database = connect(TEST_DATABASE_URL, { max: 4 });
  await runMigrations(database.db);
  await seedDatabase(database.db, await readSeeds(), { reset: true });
  return database;
}
