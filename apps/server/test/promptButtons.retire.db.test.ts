import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { inArray } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema.js';
import type { Db } from '../src/db/client.js';

// The migration that retires the default prompt buttons Caption and Repost ideas, against Postgres
// (npm run test:db): its statement runs again here over rows of this test's own users, which the
// database's own run of it never saw.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const MIGRATION = new URL('../drizzle/0038_retire_default_prompt_buttons.sql', import.meta.url);

const USER = '77777777-7777-4777-8777-777777777771';
const OTHER = '77777777-7777-4777-8777-777777777772';
const CAPTION = 'e39b0935-7e63-4fd9-8e69-a2011c71edce';
const REPOST = '452726e1-35ae-463f-8cab-dcd19bba78df';
const CAPTION_PROMPT =
  "Write 3 captions for these photos. Short, one line each. Mention who's in them when there's a handle for it.";

const button = (userId: string, id: string, prompt: string, deletedAt: number | null) => ({
  id,
  userId,
  createdAt: 1000,
  updatedAt: 3000,
  deletedAt,
  name: 'A button',
  prompt,
  placement: 'post',
  icon: null,
  position: 'a0',
  fieldClock: { deletedAt: 1000, name: 2000, prompt: 3000, placement: 1000, icon: 1000, position: 1500 },
});

d('retiring the default prompt buttons', () => {
  let pool: pg.Pool;
  let db: Db;

  const rows = () =>
    db
      .select()
      .from(schema.promptButtons)
      .where(inArray(schema.promptButtons.userId, [USER, OTHER]));
  const row = async (userId: string, id: string) =>
    (await rows()).find((each) => each.userId === userId && each.id === id)!;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema }) as unknown as Db;
    await db
      .insert(schema.users)
      .values([
        { id: USER, email: 'retire-buttons@test.local', passwordDigest: 'x', storageBucket: null },
        { id: OTHER, email: 'retire-buttons-2@test.local', passwordDigest: 'x', storageBucket: null },
      ])
      .onConflictDoNothing();
    await db.delete(schema.promptButtons).where(inArray(schema.promptButtons.userId, [USER, OTHER]));
    await db
      .insert(schema.promptButtons)
      .values([
        button(USER, CAPTION, CAPTION_PROMPT, null),
        button(USER, REPOST, 'Repost this my way.', null),
        button(OTHER, CAPTION, CAPTION_PROMPT, 2500),
      ]);
  });

  afterAll(async () => {
    await db.delete(schema.promptButtons).where(inArray(schema.promptButtons.userId, [USER, OTHER]));
    await db.delete(schema.users).where(inArray(schema.users.id, [USER, OTHER]));
    await pool.end();
  });

  it('deletes an unedited default with a clock newer than its own, keeps an edited one and a deleted one', async () => {
    const before = {
      caption: await row(USER, CAPTION),
      repost: await row(USER, REPOST),
      other: await row(OTHER, CAPTION),
    };
    await pool.query(readFileSync(MIGRATION, 'utf8'));

    const caption = await row(USER, CAPTION);
    expect(caption.deletedAt).not.toBeNull();
    expect(caption.updatedAt).toBe(caption.deletedAt);
    expect(caption.fieldClock).toEqual({ ...before.caption.fieldClock, deletedAt: caption.deletedAt });
    expect(caption.deletedAt!).toBeGreaterThan(Math.max(3000, ...Object.values(before.caption.fieldClock!)));
    expect(Number(caption.serverSeq)).toBeGreaterThan(Number(before.caption.serverSeq));

    expect(await row(USER, REPOST)).toEqual(before.repost);
    expect(await row(OTHER, CAPTION)).toEqual(before.other);
  });
});
