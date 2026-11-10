import { connect } from '../index.ts';
import { runMigrations } from '../migrate.ts';

const url = process.env.DATABASE_URL ?? 'postgres://todoi:todoi@127.0.0.1:5434/todoi';
const { db, close } = connect(url, { max: 1 });
try {
  await runMigrations(db);
  console.log('migrations applied');
} finally {
  await close();
}
