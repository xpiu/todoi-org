/**
 * The e2e database: created if missing, migrated, reseeded from the committed
 * seed, with one editor for the editor tests. Never touches the dev database.
 */
import pg from 'pg';
import { connect } from '../index.ts';
import { runMigrations } from '../migrate.ts';
import { hashPassword } from '../password.ts';
import { users } from '../schema.ts';
import { readSeeds, seedDatabase } from '../seed.ts';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://todoi:todoi@127.0.0.1:5434/todoi_test';
const name = new URL(url).pathname.slice(1);
if (!/_test$|_e2e$|_ci$/.test(name)) {
  console.error(`refusing to reset "${name}": test databases end in _test, _e2e or _ci`);
  process.exit(1);
}

const admin = new URL(url);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const exists = await client.query('select 1 from pg_database where datname = $1', [name]);
if (!exists.rowCount) await client.query(`create database "${name.replace(/"/g, '""')}"`);
await client.end();

const { db, close } = connect(url, { max: 2 });
try {
  await runMigrations(db);
  await seedDatabase(db, await readSeeds(), { reset: true });
  const email = process.env.E2E_EDITOR_EMAIL ?? 'e2e-editor@todoi.test';
  const passwordHash = await hashPassword(process.env.E2E_EDITOR_PASSWORD ?? 'e2e-editor-password');
  await db.insert(users).values({ email, passwordHash }).onConflictDoUpdate({ target: users.email, set: { passwordHash } });
  await db.execute('delete from login_attempts');
  console.log(`test database ${name} ready`);
} finally {
  await close();
}
