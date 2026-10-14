import { eq } from 'drizzle-orm';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { albumOrder } from './helpers/albumOrder';
import { makeAlbumRecord, makeAssetRecord } from './helpers/factory';
import { readLiveAsset } from './helpers/readLiveAsset';
import { makeTestDb } from './helpers/testDb';
// Real server engine (against docker Postgres) — the other side of the round-trip.
import * as serverSchema from '../../server/src/db/schema.js';
import { pull as serverPull } from '../../server/src/sync/pull.js';
import { push as serverPush } from '../../server/src/sync/push.js';
import * as repo from '../src/sync/assetsRepository';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { makeRepository } from '../src/sync/repository';
import type { SyncTransport } from '../src/sync/transport';
import { runSyncOnce } from '../src/sync/worker';

const albumRepo = makeRepository('albums', clientSchema.albums);

// Headless two-device end-to-end: two better-sqlite3 "devices" + the real server sync engine
// on one Postgres user partition. Run with `npm run test:e2e` (docker stack up); skipped
// otherwise.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER = '33333333-3333-3333-3333-333333333333';

d('two-device sync e2e (client SQLite ↔ server Postgres)', () => {
  let pool: pg.Pool;
  let pgDb: ReturnType<typeof pgDrizzle>;
  let deviceA: SyncDb;
  let deviceB: SyncDb;

  // Both devices are the SAME user (multi-device sync for one account).
  const transport: SyncTransport = {
    push: async (req) => ({ results: await serverPush(pgDb as any, USER, req.mutations) }),
    pull: async (req) => serverPull(pgDb as any, USER, { cursor: req.cursor, limit: req.limit }),
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    pgDb = pgDrizzle(pool, { schema: serverSchema });
    await pgDb
      .insert(serverSchema.users)
      .values({ id: USER, email: 'twodevice@test.local', passwordDigest: 'x', storageBucket: null })
      .onConflictDoNothing();
  });
  async function clearServer() {
    await pgDb.delete(serverSchema.albumAssets).where(eq(serverSchema.albumAssets.userId, USER));
    await pgDb.delete(serverSchema.postAssets).where(eq(serverSchema.postAssets.userId, USER));
    await pgDb.delete(serverSchema.posts).where(eq(serverSchema.posts.userId, USER));
    await pgDb.delete(serverSchema.albums).where(eq(serverSchema.albums.userId, USER));
    await pgDb.delete(serverSchema.assets).where(eq(serverSchema.assets.userId, USER));
  }
  afterAll(async () => {
    await clearServer();
    await pool.end();
  });
  beforeEach(async () => {
    await clearServer();
    deviceA = makeTestDb();
    deviceB = makeTestDb();
  });

  it('propagates a create from A to B', async () => {
    const rec = await repo.createAsset(deviceA, makeAssetRecord({ filename: 'from-a.jpg' }));
    await runSyncOnce(deviceA, transport); // A pushes
    await runSyncOnce(deviceB, transport); // B pulls
    const onB = await readLiveAsset(deviceB, rec.id);
    expect(onB).toMatchObject({ id: rec.id, filename: 'from-a.jpg' });
  });

  it('converges under a concurrent conflicting edit (whole-record LWW)', async () => {
    // Both devices start with the same synced asset.
    const rec = await repo.createAsset(deviceA, makeAssetRecord({ notes: 'orig' }));
    await runSyncOnce(deviceA, transport);
    await runSyncOnce(deviceB, transport);

    // Concurrent offline edits to the same record.
    await repo.updateAsset(deviceA, rec.id, { notes: 'edited-on-A' });
    await repo.updateAsset(deviceB, rec.id, { notes: 'edited-on-B' });

    // Drain both a couple of times so push/adopt/pull settle.
    await runSyncOnce(deviceA, transport);
    await runSyncOnce(deviceB, transport);
    await runSyncOnce(deviceA, transport);
    await runSyncOnce(deviceB, transport);

    const a = await readLiveAsset(deviceA, rec.id);
    const b = await readLiveAsset(deviceB, rec.id);
    expect(a.notes).toBe(b.notes); // converged (byte-identical winner)
    expect(['edited-on-A', 'edited-on-B']).toContain(a.notes);
    expect(a.updatedAt).toBe(b.updatedAt);
  });

  it('propagates a non-asset collection (albums) A → B via the generic engine', async () => {
    const album = makeAlbumRecord({ createdAt: 1000, updatedAt: 1000, name: 'Trip' });
    await albumRepo.create(deviceA, album);
    await runSyncOnce(deviceA, transport); // A pushes the album
    await runSyncOnce(deviceB, transport); // B pulls it
    const rows = await deviceB.select().from(clientSchema.albums).where(eq(clientSchema.albums.id, album.id));
    expect(rows[0]).toMatchObject({ id: album.id, name: 'Trip' });
  });

  it('album membership: a concurrent add (A) and reorder (B) BOTH survive', async () => {
    const albumEdges = makeEdgeRepository('album_assets', clientSchema.albumAssets, 'albumId');
    const newId = () => randomUUID();
    const albumId = randomUUID();
    const [a1, a2, a3, a4] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

    // A creates the album with [a1, a2, a3] and both devices sync up.
    await albumRepo.create(deviceA, makeAlbumRecord({ createdAt: 1000, updatedAt: 1000, id: albumId, name: 'Trip' }));
    await albumEdges.add(deviceA, albumId, [a1, a2, a3], newId);
    await runSyncOnce(deviceA, transport);
    await runSyncOnce(deviceB, transport);

    // Offline: A adds a4 (new edge row); B reorders a3 to the front (rewrites positions).
    await albumEdges.add(deviceA, albumId, [a4], newId);
    await albumEdges.reorder(deviceB, albumId, [a3, a1, a2]);

    // Drain until both settle.
    for (let i = 0; i < 2; i++) {
      await runSyncOnce(deviceA, transport);
      await runSyncOnce(deviceB, transport);
    }

    const orderA = albumOrder(await deviceA.select().from(clientSchema.albumAssets), albumId);
    const orderB = albumOrder(await deviceB.select().from(clientSchema.albumAssets), albumId);
    expect(orderA).toEqual(orderB); // converged
    expect(orderA).toContain(a4); // A's add survived B's reorder
    expect(orderA.indexOf(a3)).toBeLessThan(orderA.indexOf(a1)); // B's reorder survived A's add
    expect(new Set(orderA)).toEqual(new Set([a1, a2, a3, a4]));
  });

  it('propagates a tombstone from A to B', async () => {
    const rec = await repo.createAsset(deviceA, makeAssetRecord());
    await runSyncOnce(deviceA, transport);
    await runSyncOnce(deviceB, transport);
    expect(await readLiveAsset(deviceB, rec.id)).toBeDefined();

    await repo.deleteAssets(deviceA, [rec.id]);
    await runSyncOnce(deviceA, transport); // push tombstone
    await runSyncOnce(deviceB, transport); // pull tombstone
    expect(await readLiveAsset(deviceB, rec.id)).toBeUndefined();
  });
});
