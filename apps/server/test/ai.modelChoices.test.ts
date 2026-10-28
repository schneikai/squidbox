import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { inArray } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema.js';
import { readChosenModelId } from '../src/ai/modelChoices.js';
import type { Db } from '../src/db/client.js';

// readChosenModelId against Postgres (npm run test:db): the user's choice, else the default for
// their persona's Adult content switch, as the app resolves it (resolveModelId).
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER = '55555555-5555-4555-8555-555555555555';

d('readChosenModelId', () => {
  let pool: pg.Pool;
  let db: Db;

  const base = { id: USER, userId: USER, createdAt: 1000, updatedAt: 1000, deletedAt: null };
  const persona = (adultContent?: boolean) =>
    db.insert(schema.personas).values({ ...base, aboutYou: '', contentTags: [], tone: '', rules: [], adultContent });

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema }) as unknown as Db;
    await db
      .insert(schema.users)
      .values({ id: USER, email: 'model-choices@test.local', passwordDigest: 'x', storageBucket: null })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await db.delete(schema.personas).where(inArray(schema.personas.userId, [USER]));
    await db.delete(schema.modelChoices).where(inArray(schema.modelChoices.userId, [USER]));
  });

  afterAll(async () => {
    await db.delete(schema.personas).where(inArray(schema.personas.userId, [USER]));
    await db.delete(schema.modelChoices).where(inArray(schema.modelChoices.userId, [USER]));
    await pool.end();
  });

  it('defaults writing to a regular model without a persona or with Adult content unset', async () => {
    expect(await readChosenModelId(db, USER, 'writing')).toBe('claude-sonnet-5-5');
    await persona();
    expect(await readChosenModelId(db, USER, 'writing')).toBe('claude-sonnet-5-5');
  });

  it('defaults writing to an unrestricted model with Adult content on, vision either way', async () => {
    await persona(true);
    expect(await readChosenModelId(db, USER, 'writing')).toBe('deepseek-v4-1-flash-uncensored');
    expect(await readChosenModelId(db, USER, 'vision')).toBe('gemma-4-uncensored');
  });

  it("uses the user's own choice whatever the switch says", async () => {
    await persona(true);
    await db
      .insert(schema.modelChoices)
      .values({ ...base, writingModel: { id: 'kimi-k3', name: 'Kimi K3' }, visionModel: null });
    expect(await readChosenModelId(db, USER, 'writing')).toBe('kimi-k3');
  });
});
