import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import {
  setCursor,
  getCursor,
  markFirstSyncDone,
  isFirstSyncDone,
  getLastSyncUser,
  getOwner,
} from '../src/sync/status';
import { resetSyncForUser } from '../src/sync/worker';

const owner = (userId: string) => ({ kind: 'account' as const, serverId: 's1', userId, email: `${userId}@test` });

// The local DB is a single, un-scoped store: it holds whatever user last synced, plus their cursor.
// On login, resetSyncForUser wipes it iff a DIFFERENT account signs in, so the new user does a clean
// first-sync instead of inheriting a stale/leaky slate. Same user (the common case) resumes untouched.
describe('account-switch reset (resetSyncForUser)', () => {
  let db: SyncDb;
  beforeEach(() => {
    db = makeTestDb();
  });

  async function seed() {
    await repo.createAsset(db, makeAssetRecord({ filename: 'a.jpg' })); // row + outbox row
    await setCursor(db, 42);
    await markFirstSyncDone(db);
  }

  const assets = () => db.select().from(schema.assets);
  const outbox = () => db.select().from(schema.outbox);

  it('first login (no prior user): records the user, does NOT wipe', async () => {
    await seed();
    const wiped = await resetSyncForUser(db, owner('user-A'));
    expect(wiped).toBe(false);
    expect(await assets()).toHaveLength(1);
    expect(await getCursor(db)).toBe(42);
    expect(await isFirstSyncDone(db)).toBe(true);
    expect(await getLastSyncUser(db)).toBe('user-A');
  });

  it('same user signs back in: no wipe — data, cursor and first-sync flag intact', async () => {
    await seed();
    await resetSyncForUser(db, owner('user-A')); // record A
    const wiped = await resetSyncForUser(db, owner('user-A'));
    expect(wiped).toBe(false);
    expect(await assets()).toHaveLength(1);
    expect(await getCursor(db)).toBe(42);
    expect(await isFirstSyncDone(db)).toBe(true);
  });

  it('different user signs in: wipes tables + outbox + cursor + first-sync, records new user', async () => {
    await seed();
    await resetSyncForUser(db, owner('user-A'));
    expect((await outbox()).length).toBeGreaterThan(0);

    const wiped = await resetSyncForUser(db, owner('user-B'));
    expect(wiped).toBe(true);
    expect(await assets()).toHaveLength(0);
    expect(await outbox()).toHaveLength(0);
    expect(await getCursor(db)).toBe(0);
    expect(await isFirstSyncDone(db)).toBe(false);
    expect(await getLastSyncUser(db)).toBe('user-B');
  });

  it('recording a user makes that account the library owner', async () => {
    await seed();
    await resetSyncForUser(db, owner('user-A'));
    expect(await getOwner(db)).toEqual(owner('user-A'));
    await resetSyncForUser(db, owner('user-B'));
    expect(await getOwner(db)).toEqual(owner('user-B'));
  });
});
