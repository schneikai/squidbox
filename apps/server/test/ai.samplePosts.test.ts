import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema.js';
import { readSamplePosts } from '../src/ai/persona.js';
import type { Db } from '../src/db/client.js';

// readSamplePosts against Postgres (npm run test:db): the user's posts the writing prompt quotes.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';

d('readSamplePosts', () => {
  let pool: pg.Pool;
  let db: Db;

  const post = (userId: string, text: string, over: Partial<typeof schema.posts.$inferInsert> = {}) => ({
    id: randomUUID(),
    userId,
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null,
    text,
    isFavorite: false,
    postedAt: 1000,
    rePostId: null,
    isIgnoredForRepost: false,
    suggestRepostAt: 0,
    hasBeenReposted: false,
    ...over,
  });
  const posted = ['one', 'two', 'three', 'four', 'five'];

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema }) as unknown as Db;
    await db
      .insert(schema.users)
      .values([
        { id: USER, email: 'sample-posts@test.local', passwordDigest: 'x', storageBucket: null },
        { id: OTHER, email: 'sample-posts-other@test.local', passwordDigest: 'x', storageBucket: null },
      ])
      .onConflictDoNothing();
    await db.delete(schema.posts).where(eq(schema.posts.userId, USER));
    await db.delete(schema.posts).where(eq(schema.posts.userId, OTHER));
    await db
      .insert(schema.posts)
      .values([
        ...posted.map((text) => post(USER, text)),
        post(USER, 'a draft', { postedAt: null }),
        post(USER, 'removed', { deletedAt: 2000 }),
        post(USER, 'a repost', { rePostId: randomUUID() }),
        post(USER, '  '),
        post(OTHER, 'not yours'),
      ]);
  });

  afterAll(async () => {
    await db.delete(schema.posts).where(eq(schema.posts.userId, USER));
    await db.delete(schema.posts).where(eq(schema.posts.userId, OTHER));
    await pool.end();
  });

  it("reads only the user's live, posted posts with text, no reposts", async () => {
    expect((await readSamplePosts(db, USER, 'chat-1')).sort()).toEqual([...posted].sort());
  });

  it('picks the same posts in the same order for the same seed, within the limit', async () => {
    const picked = await readSamplePosts(db, USER, 'chat-1', 3);
    expect(picked).toHaveLength(3);
    expect(await readSamplePosts(db, USER, 'chat-1', 3)).toEqual(picked);
  });
});
