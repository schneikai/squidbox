import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { inArray } from 'drizzle-orm';
import pg from 'pg';
import { DEFAULT_INSTRUCTIONS } from '@squidbox/shared';
import * as schema from '../src/db/schema.js';
import { publishInstruction, readAppInstructions, readInstructions } from '../src/ai/instructions.js';
import type { Db } from '../src/db/client.js';

// The instructions against Postgres (npm run test:db): an ai_admin's overrides, the app's defaults
// (published, else built-in) for every other account, whose stored overrides stay but don't apply.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER = '66666666-6666-4666-8666-666666666666';
const admin = { id: USER, features: ['ai', 'ai_admin'] };
const member = { id: USER, features: ['ai'] };

d('instructions', () => {
  let pool: pg.Pool;
  let db: Db;

  const clear = async () => {
    await db.delete(schema.instructions).where(inArray(schema.instructions.userId, [USER]));
    await db.delete(schema.appInstructions);
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema }) as unknown as Db;
    await db
      .insert(schema.users)
      .values({ id: USER, email: 'instructions@test.local', passwordDigest: 'x', storageBucket: null })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await clear();
    await db.insert(schema.instructions).values({
      id: USER,
      userId: USER,
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
      writing: 'Mine.',
      visionTagging: null,
      moreLikeThis: null,
      modelCheckJudge: null,
    });
  });

  afterAll(async () => {
    await clear();
    await pool.end();
  });

  it("applies an ai_admin's overrides, the default for each kind left null", async () => {
    expect(await readInstructions(db, admin)).toEqual({ ...DEFAULT_INSTRUCTIONS, writing: 'Mine.' });
  });

  it('gives every other account the defaults, keeping its stored overrides', async () => {
    expect(await readInstructions(db, member)).toEqual(DEFAULT_INSTRUCTIONS);
    const [row] = await db
      .select()
      .from(schema.instructions)
      .where(inArray(schema.instructions.userId, [USER]));
    expect(row?.writing).toBe('Mine.');
  });

  it('reads the built-in texts while nothing was published', async () => {
    expect(await readAppInstructions(db)).toEqual(DEFAULT_INSTRUCTIONS);
  });

  it('reads a published text for its kind', async () => {
    await db.insert(schema.appInstructions).values({ kind: 'moreLikeThis', text: 'More, please.' });
    expect(await readAppInstructions(db)).toEqual({ ...DEFAULT_INSTRUCTIONS, moreLikeThis: 'More, please.' });
  });

  it('throws on a row of an unknown kind', async () => {
    await db.insert(schema.appInstructions).values({ kind: 'weird', text: 'Nope.' });
    await expect(readAppInstructions(db)).rejects.toThrow();
  });

  it('gives a member the published text', async () => {
    await publishInstruction(db, { kind: 'writing', text: 'Everyone.' });
    expect(await readInstructions(db, member)).toEqual({ ...DEFAULT_INSTRUCTIONS, writing: 'Everyone.' });
  });

  it('gives an ai_admin their override over the published text, and the published text where theirs is null', async () => {
    await publishInstruction(db, { kind: 'writing', text: 'Everyone.' });
    await publishInstruction(db, { kind: 'visionTagging', text: 'Tag it.' });
    expect(await readInstructions(db, admin)).toEqual({
      ...DEFAULT_INSTRUCTIONS,
      writing: 'Mine.',
      visionTagging: 'Tag it.',
    });
  });

  it('publishes a text, and a second publish replaces it', async () => {
    await publishInstruction(db, { kind: 'writing', text: 'First.' });
    await publishInstruction(db, { kind: 'writing', text: 'Second.' });
    expect(await db.select().from(schema.appInstructions)).toEqual([{ kind: 'writing', text: 'Second.' }]);
  });

  it('deletes the row when the built-in text is published', async () => {
    await publishInstruction(db, { kind: 'writing', text: 'First.' });
    await publishInstruction(db, { kind: 'writing', text: DEFAULT_INSTRUCTIONS.writing });
    expect(await db.select().from(schema.appInstructions)).toEqual([]);
  });
});
