import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema.js';
import { readFavorites } from '../src/ai/persona.js';
import type { Db } from '../src/db/client.js';

// readFavorites against Postgres (npm run test:db): what the writing prompt sends.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';

d('readFavorites', () => {
  let pool: pg.Pool;
  let db: Db;

  const favorite = (userId: string, text: string, createdAt: number, deletedAt: number | null = null) => ({
    id: randomUUID(),
    userId,
    createdAt,
    updatedAt: deletedAt ?? createdAt,
    deletedAt,
    text,
  });

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema }) as unknown as Db;
    await db
      .insert(schema.users)
      .values([
        { id: USER, email: 'favorites@test.local', passwordDigest: 'x', storageBucket: null },
        { id: OTHER, email: 'favorites-other@test.local', passwordDigest: 'x', storageBucket: null },
      ])
      .onConflictDoNothing();
    await db.delete(schema.favorites).where(eq(schema.favorites.userId, USER));
    await db.delete(schema.favorites).where(eq(schema.favorites.userId, OTHER));
    await db
      .insert(schema.favorites)
      .values([
        favorite(USER, 'oldest', 1000),
        favorite(USER, 'newest', 3000),
        favorite(USER, 'middle', 2000),
        favorite(USER, 'removed', 4000, 5000),
        favorite(OTHER, 'not yours', 6000),
      ]);
  });

  afterAll(async () => {
    await db.delete(schema.favorites).where(eq(schema.favorites.userId, USER));
    await db.delete(schema.favorites).where(eq(schema.favorites.userId, OTHER));
    await pool.end();
  });

  it("reads the user's live favorites, newest first", async () => {
    expect(await readFavorites(db, USER)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('keeps to the limit, the newest first', async () => {
    expect(await readFavorites(db, USER, 2)).toEqual(['newest', 'middle']);
  });
});
