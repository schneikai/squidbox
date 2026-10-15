import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema.js';
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken, REFRESH_TOKEN_TTL_MS } from '../src/auth/tokens.js';

// The rotation grace is a chain of conditional statements (replaced_by IS NULL, expires_at, the
// self-join to the successor), so these tests run against a real Postgres: `npm run test:db`
// (the docker-compose stack); plain `npm test` skips them.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER = '33333333-3333-3333-3333-333333333333';
const NOW = 1_700_000_000_000;

type Db = ReturnType<typeof drizzle<typeof schema>>;
let pool: pg.Pool;
let db: Db;

async function rows() {
  return db.select().from(schema.refreshTokens).where(eq(schema.refreshTokens.userId, USER));
}
async function tokens() {
  return (await rows()).map((row) => row.token).sort();
}

d('refresh tokens (per-device, with rotation grace)', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema });
    await db
      .insert(schema.users)
      .values({ id: USER, email: 'tokens@test.local', passwordDigest: 'x', storageBucket: null })
      .onConflictDoNothing();
  });
  beforeEach(async () => {
    await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.userId, USER));
  });
  afterAll(async () => {
    await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.userId, USER));
    await pool.end();
  });

  it('issues a random token with a 1-year expiry', async () => {
    const token = await issueRefreshToken(db, USER, NOW);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const [row] = await rows();
    expect(row.token).toBe(token);
    expect(row.replacedBy).toBeNull();
    expect(row.expiresAt.getTime()).toBe(NOW + REFRESH_TOKEN_TTL_MS);
  });

  it('rotate issues a successor and keeps the presented token until the successor is presented', async () => {
    const first = await issueRefreshToken(db, USER, NOW);
    const { userId, token: second } = await rotateRefreshToken(db, first, NOW);
    expect(userId).toBe(USER);
    expect(second).not.toBe(first);
    expect(await tokens()).toEqual([first, second].sort());

    // A lost response or a concurrent refresh presents the first token again: same successor.
    const replay = await rotateRefreshToken(db, first, NOW);
    expect(replay).toEqual({ userId: USER, token: second });
    expect(await tokens()).toEqual([first, second].sort());
  });

  it('presenting the successor retires the predecessor', async () => {
    const first = await issueRefreshToken(db, USER, NOW);
    const { token: second } = await rotateRefreshToken(db, first, NOW);
    const { token: third } = await rotateRefreshToken(db, second, NOW);
    expect(await tokens()).toEqual([second, third].sort());
    await expect(rotateRefreshToken(db, first, NOW)).rejects.toThrow(/Invalid or expired/);
  });

  it('an expired successor is not replayed', async () => {
    const first = await issueRefreshToken(db, USER, NOW);
    await rotateRefreshToken(db, first, NOW);
    const later = NOW + REFRESH_TOKEN_TTL_MS + 1;
    await expect(rotateRefreshToken(db, first, later)).rejects.toThrow(/Invalid or expired/);
  });

  it('rotate rejects an unknown or expired token', async () => {
    await expect(rotateRefreshToken(db, 'unknown', NOW)).rejects.toThrow(/Invalid or expired/);
    const token = await issueRefreshToken(db, USER, NOW);
    await expect(rotateRefreshToken(db, token, NOW + REFRESH_TOKEN_TTL_MS)).rejects.toThrow(/Invalid or expired/);
  });

  it('revoke clears the presented token with its predecessor and successor, nothing else', async () => {
    const other = await issueRefreshToken(db, USER, NOW);
    const first = await issueRefreshToken(db, USER, NOW);
    const { token: second } = await rotateRefreshToken(db, first, NOW);
    const { token: third } = await rotateRefreshToken(db, second, NOW); // retires first
    expect(await tokens()).toEqual([other, second, third].sort());

    await revokeRefreshToken(db, second);
    expect(await tokens()).toEqual([other]);
  });
});
