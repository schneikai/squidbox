import { sql } from 'drizzle-orm';
import { ACCOUNT_FEATURES } from '@squidbox/shared';
import { getDb, closeDb } from './client.js';
import { users } from './schema.js';
import { hashPassword } from '../auth/passwords.js';

// Seeds the two users the backend needs (this is a private build with no signup endpoint —
// accounts are provisioned here):
//  1. The main account, with its own per-user bucket and every feature (ACCOUNT_FEATURES), added to
//     the ones it has. Provide either an existing bcrypt digest (SEED_USER_PASSWORD_DIGEST) or a
//     plaintext SEED_USER_PASSWORD.
//  2. An isolated fixture user (shared bucket + prefix, storageBucket = null) for the
//     multi-tenant isolation checks.
//  3. Local only: the library-copy account (shared bucket + prefix, every feature), which holds a
//     copy of the owner's live library (dev/libraryCopy.ts).
const env = process.env;
const db = getDb();

async function seedExistingUser(): Promise<void> {
  const email = env.SEED_USER_EMAIL;
  if (!email) {
    console.log('SEED_USER_EMAIL not set — skipping existing-user seed.');
    return;
  }
  const digest =
    env.SEED_USER_PASSWORD_DIGEST || (env.SEED_USER_PASSWORD ? await hashPassword(env.SEED_USER_PASSWORD) : null);
  if (!digest) throw new Error('Provide SEED_USER_PASSWORD_DIGEST or SEED_USER_PASSWORD');

  const storageBucket = env.SEED_USER_STORAGE_BUCKET ?? null;
  const features = [...ACCOUNT_FEATURES];
  await db
    .insert(users)
    .values({ email, passwordDigest: digest, storageBucket, features })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordDigest: digest,
        storageBucket,
        features: sql`array(select distinct unnest(${users.features} || excluded.features) order by 1)`,
        updatedAt: new Date(),
      },
    });
  console.log(`Seeded existing user ${email} (bucket: ${storageBucket ?? 'shared+prefix'}).`);
}

async function seedFixtureUser(): Promise<void> {
  const email = env.SEED_FIXTURE_EMAIL;
  const password = env.SEED_FIXTURE_PASSWORD;
  if (!email || !password) {
    console.log('SEED_FIXTURE_* not set — skipping fixture-user seed.');
    return;
  }
  const digest = await hashPassword(password);
  await db
    .insert(users)
    .values({ email, passwordDigest: digest, storageBucket: null })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordDigest: digest, updatedAt: new Date() },
    });
  console.log(`Seeded fixture user ${email} (shared bucket + prefix).`);
}

async function seedLibraryCopyUser(): Promise<void> {
  const email = env.LIBRARY_COPY_EMAIL;
  const password = env.LIBRARY_COPY_PASSWORD;
  if (!email || !password) return;
  const digest = await hashPassword(password);
  const features = [...ACCOUNT_FEATURES];
  await db
    .insert(users)
    .values({ email, passwordDigest: digest, storageBucket: null, features })
    .onConflictDoUpdate({ target: users.email, set: { passwordDigest: digest, updatedAt: new Date() } });
  console.log(`Seeded library-copy user ${email} (shared bucket + prefix).`);
}

await seedExistingUser();
await seedFixtureUser();
await seedLibraryCopyUser();
console.log('Seed complete.');
await closeDb();
