/**
 * Create an editor, or reset an editor's password.
 *   EDITOR_PASSWORD=... pnpm db:user someone@example.org
 * The password is read from the environment so it never lands in shell history.
 */
import { connect } from '../index.ts';
import { hashPassword } from '../password.ts';
import { users } from '../schema.ts';

const email = process.argv[2]?.trim().toLowerCase();
const password = process.env.EDITOR_PASSWORD;
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email) || !password || password.length < 12) {
  console.error('usage: EDITOR_PASSWORD=<at least 12 characters> pnpm db:user <email>');
  process.exit(1);
}
const url = process.env.DATABASE_URL ?? 'postgres://todoi:todoi@127.0.0.1:5434/todoi';
const { db, close } = connect(url, { max: 1 });
try {
  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ email, passwordHash }).onConflictDoUpdate({ target: users.email, set: { passwordHash } });
  console.log(`editor ${email} ready`);
} finally {
  await close();
}
