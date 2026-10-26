import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema.js';
import { switchUserFeature } from '../src/users.js';

// switchUserFeature is one SQL statement, so these run against a real Postgres: `npm run test:db`;
// plain `npm test` skips them.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER = '44444444-4444-4444-4444-444444444444';

type Db = ReturnType<typeof drizzle<typeof schema>>;
let pool: pg.Pool;
let db: Db;

async function featuresNow() {
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, USER));
  return row!.features;
}

d('switchUserFeature', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema });
    await db.delete(schema.users).where(eq(schema.users.id, USER));
    await db.insert(schema.users).values({
      id: USER,
      email: 'features@test.local',
      passwordDigest: 'x',
      storageBucket: null,
      features: ['manage_features', 'retired'],
    });
  });
  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, USER));
    await pool.end();
  });

  it('switches one feature on, sorted, once, leaving the others (unknown ones too)', async () => {
    expect((await switchUserFeature(db, USER, 'ai', true)).features).toEqual(['ai', 'manage_features', 'retired']);
    await switchUserFeature(db, USER, 'ai', true);
    expect(await featuresNow()).toEqual(['ai', 'manage_features', 'retired']);
  });

  it('switches one feature off', async () => {
    expect((await switchUserFeature(db, USER, 'ai', false)).features).toEqual(['manage_features', 'retired']);
  });

  it('keeps a change made meanwhile to another feature', async () => {
    await Promise.all([switchUserFeature(db, USER, 'ai', true), switchUserFeature(db, USER, 'ai_admin', true)]);
    expect(await featuresNow()).toEqual(['ai', 'ai_admin', 'manage_features', 'retired']);
  });
});
