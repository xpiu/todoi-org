/** pnpm db:seed [--reset] — load the committed seed into the database. */
import { connect } from '../index.ts';
import { readSeeds, seedDatabase } from '../seed.ts';

const url = process.env.DATABASE_URL ?? 'postgres://todoi:todoi@127.0.0.1:5434/todoi';
const reset = process.argv.includes('--reset');
const { db, close } = connect(url, { max: 1 });
try {
  const done = await seedDatabase(db, await readSeeds(), { reset });
  console.log(done ? `seeded${reset ? ' (reset)' : ''}` : 'already seeded; pass --reset to replace the directory data');
} finally {
  await close();
}
