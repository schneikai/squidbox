import { eq } from 'drizzle-orm';
import type { Db } from './db/client.js';
import { users, type User } from './db/schema.js';
import type { ApiUser } from '@squidbox/shared';

export function findUserByEmail(db: Db, email: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

export function findUserById(db: Db, id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

/** Sets the account's features (ACCOUNT_FEATURES) and resolves the updated user. */
export async function setUserFeatures(db: Db, id: string, features: string[]): Promise<User> {
  const [user] = await db.update(users).set({ features, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  return user!;
}

// The public user shape returned by the API.
export function toApiUser(user: User): ApiUser {
  return { id: user.id, email: user.email, features: user.features };
}
