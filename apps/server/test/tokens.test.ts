import { describe, it, expect } from 'vitest';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from '../src/auth/tokens.js';
import type { Db } from '../src/db/client.js';

// A minimal fake Drizzle db capturing writes, so token rotation logic is tested without PG.
function fakeDb(deleteReturning: Array<{ userId: string }> = []) {
  const inserted: Array<{ userId: string; token: string; expiresAt: Date }> = [];
  let deleteWhereCalls = 0;
  const insert = () => ({ values: async (v: any) => void inserted.push(v) });
  const tx = {
    insert,
    delete: () => ({ where: () => ({ returning: async () => deleteReturning }) }),
  };
  const db = {
    insert,
    delete: () => ({
      where: async () => {
        deleteWhereCalls += 1;
      },
    }),
    transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
  } as unknown as Db;
  return { db, inserted, deleteWhereCalls: () => deleteWhereCalls };
}

describe('refresh tokens (per-device)', () => {
  it('issues a random token with a 1-year expiry', async () => {
    const { db, inserted } = fakeDb();
    const now = 1_700_000_000_000;
    const token = await issueRefreshToken(db, 'u1', now);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].userId).toBe('u1');
    expect(inserted[0].expiresAt.getTime()).toBe(now + REFRESH_TOKEN_TTL_MS);
  });

  it('rotate deletes the presented token and issues a new one for the same user', async () => {
    const { db, inserted } = fakeDb([{ userId: 'u1' }]);
    const result = await rotateRefreshToken(db, 'old-token');
    expect(result.userId).toBe('u1');
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.token).not.toBe('old-token');
    expect(inserted).toHaveLength(1); // the replacement token
  });

  it('rotate throws when the presented token is unknown/expired', async () => {
    const { db } = fakeDb([]); // delete returns nothing
    await expect(rotateRefreshToken(db, 'bad')).rejects.toThrow(/Invalid or expired/);
  });

  it('revoke deletes the presented token', async () => {
    const { db, deleteWhereCalls } = fakeDb();
    await revokeRefreshToken(db, 'some-token');
    expect(deleteWhereCalls()).toBe(1);
  });
});
