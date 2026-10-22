import { collectionsByName, type AssetRecord, type PushMutation, type PushResult } from '@squidbox/shared';
import { and, eq } from 'drizzle-orm';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

import { albumOrder } from './helpers/albumOrder';
import { createPost, makeAlbumRecord, makeAssetRecord, makePostRecord } from './helpers/factory';
import { readLiveAsset } from './helpers/readLiveAsset';
import { makeTestDb } from './helpers/testDb';
// Real server engine (against docker Postgres) — the other side of the round-trip.
import * as serverSchema from '../../server/src/db/schema.js';
import { serverCollections } from '../../server/src/sync/collections.js';
import { pull as serverPull } from '../../server/src/sync/pull.js';
import { deletePurgedFiles } from '../../server/src/sync/purgedFiles.js';
import { push as serverPush } from '../../server/src/sync/push.js';
import { sentFields } from '../../server/src/sync/sentFields.js';
import readPost from '../src/features/post-detail/readPost';
import { libraryPaths } from '../src/library/libraryPaths';
import { applyMerge, mergeWaits, planMerge } from '../src/library/mergeLibrary';
import * as repo from '../src/sync/assetsRepository';
import type { RemoveFiles } from '../src/sync/assetsRepository';
import { clientCollectionTables } from '../src/sync/clientCollections';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { toModernChanges } from '../src/sync/legacyBase';
import { retryFailures } from '../src/sync/outbox';
import { makeRepository } from '../src/sync/repository';
import { setMergeMarks, setMergeTarget, setOwner } from '../src/sync/status';
import { sweepPurgedFiles } from '../src/sync/sweepPurgedFiles';
import type { SyncTransport } from '../src/sync/transport';
import { upsertRows } from '../src/sync/upsertRows';
import { runSyncOnce } from '../src/sync/worker';
import changedValues from '../src/utils/changedValues';
import noteText from '../src/utils/noteText';
import postAssetsToAssetRefs from '../src/utils/posts/postAssetsToAssetRefs';

const albumRepo = makeRepository('albums', clientSchema.albums);

// A library merge (mergeLibrary) only lists and moves files; this device has none.
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
vi.mock('../src/library/fs', () => ({
  listFiles: async () => new Set<string>(),
  fileExists: async () => false,
  moveFile: async () => {},
}));

// Headless two-device end-to-end: two better-sqlite3 "devices" + the real server sync engine
// on one Postgres user partition. Run with `npm run test:e2e` (docker stack up); skipped
// otherwise.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER = randomUUID(); // per run, so runs sharing the test database never meet

d('two-device sync e2e (client SQLite ↔ server Postgres)', () => {
  let pool: pg.Pool;
  let pgDb: ReturnType<typeof pgDrizzle>;
  let deviceA: SyncDb;
  let deviceB: SyncDb;

  // Both devices are the SAME user (multi-device sync for one account). Like the push route, every
  // push is followed by the purge cleanup; the storage is a list of the keys deleted from it.
  let deletedKeys: string[] = [];
  const transport: SyncTransport = {
    push: async (req) => {
      const results = await serverPush(pgDb as any, USER, req.mutations);
      await deletePurgedFiles(pgDb as any, USER, async (keys) => {
        deletedKeys.push(...keys);
        return [];
      });
      return { results };
    },
    pull: async (req) => serverPull(pgDb as any, USER, { cursor: req.cursor, limit: req.limit }),
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    pgDb = pgDrizzle(pool, { schema: serverSchema });
    await pgDb
      .insert(serverSchema.users)
      .values({ id: USER, email: `twodevice-${USER}@test.local`, passwordDigest: 'x', storageBucket: null })
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
    await pgDb.delete(serverSchema.users).where(eq(serverSchema.users.id, USER));
    await pool.end();
  });
  beforeEach(async () => {
    await clearServer();
    deviceA = makeTestDb();
    deviceB = makeTestDb();
    deletedKeys = [];
  });

  it('propagates a create from A to B', async () => {
    const rec = await repo.createAsset(deviceA, makeAssetRecord({ filename: 'from-a.jpg' }));
    await runSyncOnce(deviceA, transport); // A pushes
    await runSyncOnce(deviceB, transport); // B pulls
    const onB = await readLiveAsset(deviceB, rec.id);
    expect(onB).toMatchObject({ id: rec.id, filename: 'from-a.jpg' });
  });

  it('converges under concurrent edits of the same field (last writer wins)', async () => {
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

  // Drain both devices until push, adopt and pull settle.
  async function settle() {
    for (let i = 0; i < 2; i++) {
      await runSyncOnce(deviceA, transport);
      await runSyncOnce(deviceB, transport);
    }
  }

  it('a rename on A and a favorite on B both survive, on both devices', async () => {
    const album = makeAlbumRecord({ createdAt: 1000, updatedAt: 1000, name: 'Trip' });
    await albumRepo.create(deviceA, album);
    await settle();

    await albumRepo.update(deviceA, album.id, { name: 'Summer trip' });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await albumRepo.toggle(deviceB, album.id, 'isFavorite'); // the later edit, of another field
    await runSyncOnce(deviceB, transport); // B pushes first, A's older rename after
    await settle();

    for (const device of [deviceA, deviceB]) {
      const [row] = await device.select().from(clientSchema.albums).where(eq(clientSchema.albums.id, album.id));
      expect(row).toMatchObject({ name: 'Summer trip', isFavorite: true });
      expect(await device.select().from(clientSchema.outbox)).toEqual([]);
    }
  });

  it('notes added on A to a photo deleted on B: it stays deleted, with the notes', async () => {
    const rec = await repo.createAsset(deviceA, makeAssetRecord());
    await settle();

    await repo.deleteAssets(deviceB, [rec.id]);
    await runSyncOnce(deviceB, transport);
    await new Promise((resolve) => setTimeout(resolve, 2));
    await repo.updateAsset(deviceA, rec.id, { notes: 'written offline' }); // newer, but no restore
    await settle();

    for (const device of [deviceA, deviceB]) {
      const [row] = await device.select().from(clientSchema.assets).where(eq(clientSchema.assets.id, rec.id));
      expect(row).toMatchObject({ notes: 'written offline', deletedAt: expect.any(Number) });
      expect(await readLiveAsset(device, rec.id)).toBeUndefined();
    }
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

  it('a permanent delete wins over a stale restore: the cloud files go once and the asset stays gone on both', async () => {
    const rec = await repo.createAsset(deviceA, makeAssetRecord({ filename: 'p.jpg', thumbnailFilename: 'p-t.jpg' }));
    await repo.deleteAssets(deviceA, [rec.id]);
    await runSyncOnce(deviceA, transport);
    await runSyncOnce(deviceB, transport);

    // B restores it while offline, after A purged it (B's clock is later); A's purge reaches the server first.
    const removedOnA: string[] = [];
    await repo.purgeAssets(deviceA, [rec.id]);
    await new Promise((resolve) => setTimeout(resolve, 2));
    await repo.updateAllAssets(deviceB, [rec.id], { deletedAt: null });

    await runSyncOnce(deviceA, transport, {
      removeFiles: async (files) => {
        removedOnA.push(
          ...files.flatMap((file) => [file.filename, file.thumbnailFilename]).filter((n) => n !== undefined),
        );
      },
    }); // the purge; A's copies go once the server has it, the cloud's after the push
    expect(removedOnA).toEqual(['p.jpg', 'p-t.jpg']);
    expect(deletedKeys).toEqual(['p.jpg', 'p-t.jpg']);
    const removedOnB: string[] = [];
    const removeFiles = async (assets: { filename?: string }[]) => {
      removedOnB.push(...assets.flatMap((a) => (a.filename ? [a.filename] : [])));
    };
    await runSyncOnce(deviceB, transport, { removeFiles }); // B's restore loses, B adopts the purge
    await runSyncOnce(deviceA, transport);

    expect(removedOnB).toContain('p.jpg');
    for (const device of [deviceA, deviceB]) {
      const [row] = await device.select().from(clientSchema.assets).where(eq(clientSchema.assets.id, rec.id));
      expect(row).toMatchObject({ purgedAt: expect.any(Number), deletedAt: expect.any(Number) });
      expect(await device.select().from(clientSchema.outbox)).toEqual([]);
    }
    expect(deletedKeys).toEqual(['p.jpg', 'p-t.jpg']); // nobody deletes them again
  });

  it('an offline device’s purge loses to a restore another device pushed first: the asset and its cloud files stay', async () => {
    const rec = await repo.createAsset(deviceA, makeAssetRecord({ filename: 'r.jpg', thumbnailFilename: 'r-t.jpg' }));
    await repo.deleteAssets(deviceA, [rec.id]);
    await runSyncOnce(deviceA, transport);
    await runSyncOnce(deviceB, transport);

    await repo.purgeAssets(deviceA, [rec.id]); // A, offline
    await new Promise((resolve) => setTimeout(resolve, 2));
    await repo.updateAllAssets(deviceB, [rec.id], { deletedAt: null }); // B restores it later
    await runSyncOnce(deviceB, transport);

    await runSyncOnce(deviceA, transport); // A's older purge loses, A adopts the restore
    await runSyncOnce(deviceB, transport);

    expect(deletedKeys).toEqual([]);
    for (const device of [deviceA, deviceB]) {
      expect(await readLiveAsset(device, rec.id)).toMatchObject({ purgedAt: null, deletedAt: null });
      expect(await device.select().from(clientSchema.outbox)).toEqual([]);
    }
  });
});

// ── Adversarial per-field merge: devices A and B run this app; C runs an app from before per-field
// merge (its pushes carry no `fields`, so the server merges the whole record at its updatedAt). Date
// is faked so each edit gets the clock the scenario names; the server's clock is SERVER_NOW unless a
// scenario sets it. Every push is checked as it lands: `applied` means every field it merged holds
// the pushed value, `skipped-lww` carries the merged server row as `current` and lost something.
// A user of its own per run, so a run beside another (another checkout's, on the same Postgres) can't see its rows.
const USER2 = randomUUID();
const S = 1_800_000_000_000; // the clock's origin: device edits happen at S + offset
const SERVER_NOW = S + 10_000_000; // after every edit, so nothing is clamped
const HOUR = 3_600_000;

d('per-field merge, adversarial (devices A, B, an old app C ↔ server)', () => {
  let pool: pg.Pool;
  let pgDb: ReturnType<typeof pgDrizzle>;
  let A: SyncDb;
  let B: SyncDb;
  let C: SyncDb;
  let violations: string[];
  let pushLog: { device: SyncDb; mutations: PushMutation[]; results: PushResult[] }[];
  const oldApps = new Set<SyncDb>();
  const posts = makeRepository('posts', clientSchema.posts);

  const at = (t: number) => vi.setSystemTime(t);
  const syncedKeys = (collection: string) =>
    Object.keys((collectionsByName[collection]!.schema as unknown as { shape: object }).shape);
  const synced = (collection: string, row: Record<string, unknown> | undefined) =>
    row && Object.fromEntries(syncedKeys(collection).map((key) => [key, row[key] ?? null]));

  async function serverRaw(collection: string, id: string) {
    const table = serverCollections[collection]!.table as any;
    const [row] = await pgDb
      .select()
      .from(table)
      .where(and(eq(table.userId, USER2), eq(table.id, id)));
    return row as Record<string, any> | undefined;
  }
  async function serverRow(collection: string, id: string) {
    const { table, wireColumns } = serverCollections[collection]!;
    const [row] = await pgDb
      .select(wireColumns)
      .from(table)
      .where(and(eq((table as any).userId, USER2), eq((table as any).id, id)));
    return row as Record<string, any> | undefined;
  }
  async function localRow(device: SyncDb, collection: string, id: string) {
    const table = clientCollectionTables[collection] as any;
    const [row] = await device.select().from(table).where(eq(table.id, id));
    return row as Record<string, any> | undefined;
  }

  // The invariants every push result must keep (sync-design §6).
  async function checkResults(mutations: PushMutation[], results: PushResult[]) {
    for (const [i, result] of results.entries()) {
      const mutation = mutations[i]!;
      const col = serverCollections[mutation.collection]!;
      const record = mutation.record as Record<string, unknown>;
      const merged = Object.keys(sentFields(col, record as never, mutation.fields, Number.MAX_SAFE_INTEGER));
      const row = await serverRow(mutation.collection, result.id);
      const lost = merged.filter((field) => !Object.is(row?.[field], record[field]));
      const final = col.descriptor.finalField;
      const purgeMissing = !!final && row?.[final] != null && !Object.is(row[final], record[final] ?? null);
      const where = `${mutation.collection} ${result.id}`;
      if (result.status === 'applied' && (lost.length > 0 || purgeMissing))
        violations.push(`${where}: applied, but lost ${lost}${purgeMissing ? ' (no purge)' : ''}`);
      if (result.status === 'skipped-lww') {
        // A whole record (no fields) is also told it lost when the row ends newer than it (§6).
        const stale = !mutation.fields && Number(row?.updatedAt) > Math.min(Number(record.updatedAt), Date.now());
        if (lost.length === 0 && !purgeMissing && !stale)
          violations.push(`${where}: skipped-lww, but every pushed field holds`);
        try {
          expect(result.current).toEqual(row);
        } catch {
          violations.push(`${where}: skipped-lww current is not the server row`);
        }
      }
    }
  }

  function transportOf(device: SyncDb): SyncTransport {
    return {
      push: async (req) => {
        const mutations = oldApps.has(device) ? req.mutations.map(({ fields: _fields, ...m }) => m) : req.mutations;
        const results = await serverPush(pgDb as any, USER2, mutations);
        await checkResults(mutations, results);
        pushLog.push({ device, mutations, results });
        return { results };
      },
      pull: (req) => serverPull(pgDb as any, USER2, { cursor: req.cursor, limit: req.limit }),
    };
  }
  async function sync(
    device: SyncDb,
    { now = SERVER_NOW, removeFiles }: { now?: number; removeFiles?: RemoveFiles } = {},
  ) {
    at(now);
    await runSyncOnce(device, transportOf(device), { removeFiles });
  }
  async function settle(devices = [A, B, C], now = SERVER_NOW) {
    for (let i = 0; i < 3; i++) for (const device of devices) await sync(device, { now });
  }
  // A pull while the device's edits wait (its push is refused, then retried later), so the pull
  // applies around the pending fields (§5).
  async function pullOnly(device: SyncDb, now = SERVER_NOW) {
    at(now);
    await runSyncOnce(device, {
      push: async (req) => ({
        results: req.mutations.map((m) => ({
          id: String(m.record.id),
          collection: m.collection,
          status: 'rejected' as const,
          reason: 'offline',
        })),
      }),
      pull: (req) => serverPull(pgDb as any, USER2, { cursor: req.cursor, limit: req.limit }),
    });
    await retryFailures(device);
  }
  async function edit(device: SyncDb, t: number, write: () => Promise<unknown>) {
    at(t);
    await write();
  }

  // Every device and the server hold the same synced record, and nothing waits in an outbox.
  async function expectConverged(collection: string, id: string, devices = [A, B, C]) {
    const server = synced(collection, await serverRow(collection, id));
    expect(server).toBeDefined();
    for (const device of devices) {
      expect(synced(collection, await localRow(device, collection, id))).toEqual(server);
      expect(await device.select().from(clientSchema.outbox)).toEqual([]);
    }
    return server as Record<string, any>;
  }

  async function seedAsset(over: Partial<AssetRecord> = {}) {
    at(S);
    const rec = await repo.createAsset(A, makeAssetRecord({ createdAt: S, updatedAt: S, ...over }));
    await settle();
    return rec.id;
  }
  async function seedAlbum(over: Record<string, unknown> = {}) {
    at(S);
    const rec = await albumRepo.create(A, makeAlbumRecord({ createdAt: S, updatedAt: S, ...over }));
    await settle();
    return rec.id;
  }

  async function clearServer() {
    for (const table of [
      serverSchema.albumAssets,
      serverSchema.postAssets,
      serverSchema.posts,
      serverSchema.albums,
      serverSchema.assets,
    ])
      await pgDb.delete(table).where(eq(table.userId, USER2));
  }
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    pgDb = pgDrizzle(pool, { schema: serverSchema });
    await pgDb
      .insert(serverSchema.users)
      .values({ id: USER2, email: `fieldmerge-${USER2}@test.local`, passwordDigest: 'x', storageBucket: null })
      .onConflictDoNothing();
  });
  afterAll(async () => {
    await clearServer();
    await pgDb.delete(serverSchema.users).where(eq(serverSchema.users.id, USER2));
    await pool.end();
  });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    at(S);
    await clearServer();
    A = makeTestDb();
    B = makeTestDb();
    C = makeTestDb();
    oldApps.clear();
    oldApps.add(C);
    violations = [];
    pushLog = [];
  });
  afterEach(() => {
    vi.useRealTimers();
    expect(violations).toEqual([]);
  });

  describe('two devices, one record', () => {
    it('edits of different fields both survive, whichever device pushes or pulls first', async () => {
      for (const order of [
        [A, B],
        [B, A],
      ]) {
        const id = await seedAsset();
        await edit(A, S + 100, () => repo.updateAsset(A, id, { notes: 'from A' }));
        await edit(B, S + 200, () => repo.toggleFavorite(B, id));
        await sync(order[0]!);
        await sync(order[1]!);
        await settle();
        expect(await expectConverged('assets', id)).toMatchObject({ notes: 'from A', isFavorite: true });
      }
    });

    it('a device that pulls while its edit waits shows the other edit at once, and both survive', async () => {
      const id = await seedAlbum({ name: 'Trip' });
      await edit(A, S + 100, () => albumRepo.update(A, id, { name: 'Summer trip' }));
      await edit(B, S + 200, () => albumRepo.update(B, id, { notes: 'beach' }));
      await sync(B);
      await pullOnly(A);
      expect(await localRow(A, 'albums', id)).toMatchObject({ name: 'Summer trip', notes: 'beach' });
      await pullOnly(B); // nothing pending on B
      await settle();
      expect(await expectConverged('albums', id)).toMatchObject({ name: 'Summer trip', notes: 'beach' });
    });

    it('edits of the same field keep the later clock, in either push order', async () => {
      for (const order of [
        [A, B],
        [B, A],
      ]) {
        const id = await seedAsset();
        await edit(A, S + 100, () => repo.updateAsset(A, id, { notes: 'older, A' }));
        await edit(B, S + 200, () => repo.updateAsset(B, id, { notes: 'newer, B' }));
        await sync(order[0]!);
        await sync(order[1]!);
        await settle();
        expect((await expectConverged('assets', id)).notes).toBe('newer, B');
        expect((await serverRaw('assets', id))!.fieldClock.notes).toBe(S + 200);
      }
    });

    it('edits of the same field in the same millisecond keep the first one pushed', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.updateAsset(A, id, { notes: 'A' }));
      await edit(B, S + 100, () => repo.updateAsset(B, id, { notes: 'B' }));
      await sync(B);
      await sync(A);
      await settle();
      expect((await expectConverged('assets', id)).notes).toBe('B');
    });

    it('a device whose clock is an hour ahead is clamped: a later edit elsewhere still wins, and its own later edit too', async () => {
      const id = await seedAsset();
      await edit(A, S + 1000 + HOUR, () => repo.updateAsset(A, id, { notes: 'A, clock ahead' }));
      await sync(A, { now: S + 1000 }); // clamped to the server's clock
      expect((await serverRaw('assets', id))!.fieldClock.notes).toBe(S + 1000);
      await edit(B, S + 2000, () => repo.updateAsset(B, id, { notes: 'B, later' }));
      await sync(B, { now: S + 3000 });
      await settle([A, B, C], S + 4000);
      expect((await expectConverged('assets', id)).notes).toBe('B, later');

      // A edits again, an hour ahead still: clamped to the server's time, it's the newest edit.
      await edit(A, S + 5000 + HOUR, () => repo.updateAsset(A, id, { notes: 'A again', isFavorite: true }));
      await settle([A, B, C], S + 6000);
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'A again', isFavorite: true });
      expect((await serverRaw('assets', id))!.fieldClock).toMatchObject({ notes: S + 6000, isFavorite: S + 6000 });
    });

    it('a device whose clock is an hour behind loses an edit it made unseen, but wins once it pulled', async () => {
      const id = await seedAsset();
      await edit(A, S + 1000, () => repo.updateAsset(A, id, { notes: 'A' }));
      await sync(A, { now: S + 1100 });
      // B, an hour behind, edits before pulling A's edit: its clock says it is older (§7, a known limit).
      await edit(B, S + 2000 - HOUR, () => repo.updateAsset(B, id, { notes: 'B, clock behind' }));
      await settle([A, B, C], S + 2100);
      expect((await expectConverged('assets', id)).notes).toBe('A');

      // Having pulled, B's next edit gets a clock above the record's: it wins.
      await edit(B, S + 3000 - HOUR, () => repo.updateAsset(B, id, { notes: 'B, after the pull' }));
      await edit(C, S + 3000, () => posts.create(C, makePostRecord({ createdAt: S, text: 'unrelated' })));
      await settle([A, B, C], S + 3100);
      expect((await expectConverged('assets', id)).notes).toBe('B, after the pull');
    });

    it('an edit of a field just pulled around a pending edit gets a clock above the pulled one', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.updateAsset(A, id, { notes: 'A, pending' }));
      await edit(B, S + 500, () => repo.toggleFavorite(B, id)); // true, at S+500
      await sync(B);
      await pullOnly(A);
      expect(await localRow(A, 'assets', id)).toMatchObject({ notes: 'A, pending', isFavorite: true });
      // A's clock (S+200) is behind the pulled edit; its unfavorite must still be the newer one.
      await edit(A, S + 200, () => repo.toggleFavorite(A, id));
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'A, pending', isFavorite: false });
    });

    it('offline edits coalesced in the outbox keep each field’s own clock, in either push order', async () => {
      for (const order of [
        [A, B],
        [B, A],
      ]) {
        const id = await seedAlbum({ name: 'orig' });
        await edit(A, S + 100, () => albumRepo.update(A, id, { name: 'A name' }));
        await edit(B, S + 200, () => albumRepo.update(B, id, { notes: 'B notes' }));
        await edit(A, S + 300, () => albumRepo.update(A, id, { notes: 'A notes' }));
        await edit(B, S + 400, () => albumRepo.update(B, id, { name: 'B name' }));
        await edit(A, S + 500, () => albumRepo.update(A, id, { archivedAt: 111 }));
        await edit(B, S + 600, () => albumRepo.update(B, id, { archivedAt: 222 }));
        await edit(A, S + 700, () => albumRepo.toggle(A, id, 'isFavorite'));
        const [pendingA] = await A.select().from(clientSchema.outbox);
        expect(pendingA!.fields).toEqual({ name: S + 100, notes: S + 300, archivedAt: S + 500, isFavorite: S + 700 });
        await sync(order[0]!);
        await sync(order[1]!);
        await settle();
        expect(await expectConverged('albums', id)).toMatchObject({
          name: 'B name',
          notes: 'A notes',
          archivedAt: 222,
          isFavorite: true,
        });
      }
    });
  });

  describe('deletes, restores and purges', () => {
    it('an edit of another field doesn’t undelete, older or newer, in either push order', async () => {
      for (const [notesAt, order] of [
        [S + 50, [A, B]],
        [S + 200, [A, B]],
        [S + 200, [B, A]],
      ] as const) {
        const id = await seedAsset();
        await edit(A, S + 100, () => repo.deleteAssets(A, [id]));
        await edit(B, notesAt, () => repo.updateAsset(B, id, { notes: 'B notes' }));
        await sync(order[0]);
        await sync(order[1]);
        await settle();
        expect(await expectConverged('assets', id)).toMatchObject({ notes: 'B notes', deletedAt: S + 100 });
      }
    });

    it('a restore beats an older delete pushed after it', async () => {
      const id = await seedAsset();
      await edit(B, S + 100, () => repo.deleteAssets(B, [id]));
      await sync(B);
      await edit(B, S + 300, () => repo.updateAllAssets(B, [id], { deletedAt: null }));
      await sync(B);
      await edit(A, S + 200, () => repo.deleteAssets(A, [id])); // A never saw either, its delete is older
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: null });
    });

    it('a delete newer than a restore wins over it', async () => {
      const id = await seedAsset();
      await edit(B, S + 100, () => repo.deleteAssets(B, [id]));
      await sync(B);
      await edit(B, S + 200, () => repo.updateAllAssets(B, [id], { deletedAt: null }));
      await sync(B);
      await edit(A, S + 300, () => repo.deleteAssets(A, [id]));
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 300 });
    });

    it('a purge vs a concurrent edit in the Deleted album: the purge is final either way, and an edit pushed first stays in it', async () => {
      for (const purgeFirst of [true, false]) {
        const id = await seedAsset({ notes: 'orig' });
        await edit(A, S + 100, () => repo.deleteAssets(A, [id]));
        await settle();
        await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
        await edit(B, S + 300, () => repo.updateAsset(B, id, { notes: 'B, newer' }));
        const removed: string[] = [];
        const removeFiles: RemoveFiles = async (files) => {
          removed.push(...files.flatMap((f) => (f.filename ? [f.filename] : [])));
        };
        if (purgeFirst) {
          await sync(A);
          await sync(B, { removeFiles });
        } else {
          await sync(B);
          await sync(A);
          await sync(B, { removeFiles });
        }
        await settle();
        const row = await expectConverged('assets', id);
        expect(row).toMatchObject({ deletedAt: S + 100, purgedAt: S + 200, notes: purgeFirst ? 'orig' : 'B, newer' });
        expect(removed).toEqual(['a.jpg']);
      }
    });

    // A purge is irreversible: against a restore it hadn't seen, the restore wins whatever the clocks,
    // and the purging device keeps its files and gets the asset back.
    it('a purge and a restore it hadn’t seen: the restore wins in either order, the files stay', async () => {
      for (const purgeLater of [true, false]) {
        const id = await seedAsset();
        await edit(B, S + 100, () => repo.deleteAssets(B, [id]));
        await settle();
        await edit(B, purgeLater ? S + 200 : S + 400, () => repo.updateAllAssets(B, [id], { deletedAt: null }));
        await sync(B);
        await edit(A, S + 300, () => repo.purgeAssets(A, [id]));
        const removed: string[] = [];
        await sync(A, {
          removeFiles: async (files) => {
            removed.push(...files.flatMap((f) => (f.filename ? [f.filename] : [])));
          },
        }); // the purge loses: A gets the asset back, its files never went
        await settle();
        expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: null, purgedAt: null });
        expect(removed).toEqual([]);
      }
    });

    // A's deletion is its own, never on the server, so it isn't one B's restore undid: the pair goes by
    // clock (a restore beats only a purge of the deletion it undid, sync-design §7).
    it('an offline delete and purge coalesced in one push go by clock against a restore of another deletion', async () => {
      const id = await seedAsset();
      await edit(B, S + 100, () => repo.deleteAssets(B, [id]));
      await sync(B);
      await edit(B, S + 300, () => repo.updateAllAssets(B, [id], { deletedAt: null }));
      await sync(B);
      await edit(A, S + 200, () => repo.deleteAssets(A, [id])); // A saw neither
      await edit(A, S + 400, () => repo.purgeAssets(A, [id]));
      expect((await A.select().from(clientSchema.outbox))[0]!.fields).toEqual({
        deletedAt: S + 400,
        purgedAt: S + 400,
      });
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 200, purgedAt: S + 400 });
    });

    it('an offline delete and purge of an asset no device restored apply', async () => {
      const id = await seedAsset();
      await edit(A, S + 200, () => repo.deleteAssets(A, [id]));
      await edit(A, S + 400, () => repo.purgeAssets(A, [id]));
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 200, purgedAt: S + 400 });
    });

    it('a deletion whose push landed unanswered, then a purge elsewhere: the device still takes the purge', async () => {
      const id = await seedAsset();
      const refused = (req: { mutations: PushMutation[] }) => ({
        results: req.mutations.map((m) => ({
          id: String(m.record.id),
          collection: m.collection,
          status: 'rejected' as const,
          reason: 'no answer',
        })),
      });
      const pull: SyncTransport['pull'] = (req) =>
        serverPull(pgDb as any, USER2, { cursor: req.cursor, limit: req.limit });
      await edit(B, S + 100, () => repo.deleteAssets(B, [id]));
      at(SERVER_NOW);
      await runSyncOnce(B, {
        push: async (req) => {
          await serverPush(pgDb as any, USER2, req.mutations); // it lands, but B never hears back
          return refused(req);
        },
        pull,
      });
      await retryFailures(B);
      await sync(A);
      await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
      await sync(A);

      const removed: string[] = [];
      const removeFiles: RemoveFiles = async (files) => {
        removed.push(...files.flatMap((f) => (f.filename ? [f.filename] : [])));
      };
      at(SERVER_NOW);
      await runSyncOnce(B, { push: async (req) => refused(req), pull }, { removeFiles }); // pulls the purge
      expect(await localRow(B, 'assets', id)).toMatchObject({ purgedAt: null }); // its deletion still waits
      await retryFailures(B);
      await sync(B, { removeFiles }); // its deletion again: the server answers with the purge
      expect(pushLog.at(-1)!.results[0]!.status).toBe('skipped-lww');
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 100, purgedAt: S + 200 });
      expect(removed).toEqual(['a.jpg']);
    });

    it('pushes to a purged row stay frozen: new apps, an old app, a restore, nothing moves it', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.deleteAssets(A, [id]));
      await settle();
      await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
      await sync(A);
      const frozen = await serverRaw('assets', id);

      await edit(B, S + 300, () => repo.updateAsset(B, id, { notes: 'B' }));
      await edit(C, S + 400, () => repo.updateAllAssets(C, [id], { deletedAt: null, isFavorite: true }));
      await sync(B);
      await sync(C);
      expect(pushLog.slice(-2).map((entry) => entry.results[0]!.status)).toEqual(['skipped-lww', 'skipped-lww']);
      expect(await serverRaw('assets', id)).toEqual(frozen); // not even server_seq or a clock moved
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ purgedAt: S + 200, deletedAt: S + 100, notes: null });
    });

    it('a purge on one device while the other has pending edits: the other adopts it and removes its files', async () => {
      const id = await seedAsset({ filename: 'k.jpg', thumbnailFilename: 'k-t.jpg' });
      await edit(A, S + 100, () => repo.deleteAssets(A, [id]));
      await settle();
      await edit(B, S + 150, () => repo.updateAsset(B, id, { notes: 'B notes', isFavorite: true }));
      await edit(B, S + 250, () => repo.updateAllAssets(B, [id], { deletedAt: null })); // and a restore, newer
      await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
      await sync(A);
      const removed: string[] = [];
      await sync(B, {
        removeFiles: async (files) => {
          removed.push(...files.map((f) => f.filename ?? ''));
        },
      });
      expect(removed).toEqual(['k.jpg']);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({
        purgedAt: S + 200,
        deletedAt: S + 100,
        notes: null,
        isFavorite: false,
      });
    });
  });

  describe('an old app (whole-record pushes) beside the new ones', () => {
    it('an older old-app edit keeps its field and loses its stale others: skipped-lww with the merged current', async () => {
      const id = await seedAsset({ notes: 'orig' });
      await edit(C, S + 100, () => repo.toggleFavorite(C, id));
      await edit(A, S + 200, () => repo.updateAsset(A, id, { notes: 'A' }));
      await sync(A);
      await sync(C);
      const [result] = pushLog.at(-1)!.results;
      expect(result).toMatchObject({ status: 'skipped-lww', current: { notes: 'A', isFavorite: true } });
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'A', isFavorite: true });
    });

    it('a newer old-app edit stamps every field it carries, so it rewrites an older edit of another field (§7)', async () => {
      const id = await seedAsset({ notes: 'orig' });
      await edit(A, S + 100, () => repo.updateAsset(A, id, { notes: 'A' }));
      await sync(A);
      await edit(C, S + 200, () => repo.toggleFavorite(C, id)); // C never pulled A's notes
      await sync(C);
      expect(pushLog.at(-1)!.results[0]!.status).toBe('applied');
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'orig', isFavorite: true });
    });

    it('interleaved on the same records, in every order, all converge and the old app never loses its edit unreported', async () => {
      const orders = [
        [A, C, B],
        [C, A, B],
        [B, C, A],
        [C, B, A],
      ];
      for (const order of orders) {
        const id = await seedAlbum({ name: 'orig', notes: 'orig' });
        await edit(A, S + 100, () => albumRepo.update(A, id, { name: 'A name' }));
        await edit(C, S + 200, () => albumRepo.update(C, id, { notes: 'C notes' }));
        await edit(B, S + 300, () => albumRepo.toggle(B, id, 'isFavorite'));
        await edit(C, S + 400, () => albumRepo.update(C, id, { archivedAt: 5 }));
        const before = pushLog.length;
        for (const device of order) await sync(device);
        await settle();
        const row = await expectConverged('albums', id);
        // C's whole record at S+400 is newer than everything: its stale name and favorite win too.
        expect(row).toMatchObject({ notes: 'C notes', archivedAt: 5, name: 'orig', isFavorite: false });
        // A or B lost their edit to it, each told so by the push that lost or by the pull after.
        const cPush = pushLog.slice(before).find((entry) => entry.device === C)!;
        expect(cPush.results[0]!.status).toBe('applied');
      }
    });

    it('an old-app restore with a stale record undeletes, and a new device’s newer delete beats it back', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.deleteAssets(A, [id]));
      await settle();
      await edit(C, S + 200, () => repo.updateAllAssets(C, [id], { deletedAt: null }));
      await sync(C);
      await edit(B, S + 300, () => repo.deleteAssets(B, [id]));
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 300 });
    });

    it('an old-app edit older than a purge never brings the record back', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.deleteAssets(A, [id]));
      await settle();
      await edit(C, S + 900, () => repo.updateAllAssets(C, [id], { deletedAt: null, notes: 'C' })); // newer even
      await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
      await sync(A);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ purgedAt: S + 200, deletedAt: S + 100 });
    });
  });

  describe('field groups', () => {
    it('the file flags come whole from the newer side, never mixed, and an edit of another field leaves them', async () => {
      for (const aNewer of [false, true]) {
        const id = await seedAsset({ isFileSynced: false, isThumbnailSynced: false, isSynced: false });
        await edit(A, aNewer ? S + 300 : S + 100, () =>
          repo.updateAsset(A, id, { isFileSynced: true, isThumbnailSynced: true, isSynced: true }),
        );
        await edit(B, S + 200, () => repo.updateAsset(B, id, { isThumbnailSynced: true }));
        await edit(C, S + 50, () => repo.updateAsset(C, id, { notes: 'C, oldest' })); // an old app, stale flags
        await sync(B);
        await sync(A);
        await sync(C);
        await settle();
        const row = await expectConverged('assets', id);
        expect(row).toMatchObject(
          aNewer
            ? { isFileSynced: true, isThumbnailSynced: true, isSynced: true }
            : { isFileSynced: false, isThumbnailSynced: true, isSynced: false },
        );
        expect(row.notes).toBe('C, oldest');
      }
    });
  });

  describe('editors', () => {
    it('EditPostScreen saves only what the user changed: another device’s newer text survives a stale form', async () => {
      at(S);
      const postId = randomUUID();
      const [asset1, asset2] = [randomUUID(), randomUUID()];
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'draft' }, [asset1]);
      await settle();
      // A opens the editor: its seed is the post as it is now.
      const seedRow = (await localRow(A, 'posts', postId))!;
      const seedEdges = await A.select().from(clientSchema.postAssets);
      const original = {
        text: seedRow.text,
        assetRefs: seedEdges.map((e) => ({ id: e.id, assetId: e.assetId })),
        postedAt: seedRow.postedAt,
      };
      await edit(B, S + 100, () => posts.update(B, postId, { text: 'B rewrote it' }));
      await sync(B);
      await sync(A); // the edit arrives while A's editor is open
      // A saves the form: the stale text, a post date and a second photo.
      const data = {
        ...original,
        postedAt: 12345,
        assetRefs: [...original.assetRefs, { id: randomUUID(), assetId: asset2 }],
      };
      await edit(A, S + 200, async () => {
        const changes = changedValues(original, data);
        expect(Object.keys(changes).sort()).toEqual(['assetRefs', 'postedAt']);
        const postEdges = makeEdgeRepository('post_assets', clientSchema.postAssets, 'postId');
        await A.transaction(async (tx) => {
          await postEdges.setRefs(tx, postId, changes.assetRefs, original.assetRefs);
          await posts.update(tx, postId, toModernChanges(changes));
        });
      });
      await settle();
      expect(await expectConverged('posts', postId)).toMatchObject({ text: 'B rewrote it', postedAt: 12345 });
      const edges = (await B.select().from(clientSchema.postAssets)).filter((e) => e.deletedAt === null);
      expect(edges.map((e) => e.assetId).sort()).toEqual([asset1, asset2].sort());
    });

    // Round 6: the seed as EditPostScreen really builds it (readPost → PostEditor's postData), and
    // the save as PostsProvider.updatePost writes it.
    const postEdges = makeEdgeRepository('post_assets', clientSchema.postAssets, 'postId');
    async function openEditor(device: SyncDb, postId: string) {
      const post = await readPost(device, postId);
      return { text: post.text, assetRefs: postAssetsToAssetRefs(post.postAssets), postedAt: post.postedAt };
    }
    async function savePost(
      device: SyncDb,
      postId: string,
      seed: Record<string, unknown>,
      data: Record<string, unknown>,
    ) {
      const updates = changedValues(seed, data);
      await device.transaction(async (tx) => {
        if ('assetRefs' in updates)
          await postEdges.setRefs(tx, postId, (updates.assetRefs as never) ?? [], seed.assetRefs as never);
        await posts.update(tx, postId, toModernChanges(updates));
      });
      return updates;
    }
    const postAssetIds = async (device: SyncDb, postId: string) =>
      ((await readPost(device, postId))?.postAssets ?? []).map((ref: { asset: { id: string } }) => ref.asset.id);

    it('EditPostScreen’s real seed: another device’s text and added photo, arriving while the editor is open, survive a date change', async () => {
      const [x, y] = [await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'draft', postedAt: null }, [x]);
      await settle();
      const seed = await openEditor(A, postId);
      expect(seed).toEqual({ text: 'draft', assetRefs: [{ id: expect.any(String), assetId: x }], postedAt: null });
      await edit(B, S + 100, async () => {
        await posts.update(B, postId, { text: 'B rewrote it' });
        await postEdges.createFromRefs(B, postId, [{ id: randomUUID(), assetId: y }]);
      });
      await sync(B);
      await sync(A); // arrives while A's editor is open
      at(S + 200);
      expect(await savePost(A, postId, seed, { ...seed, postedAt: 12345 })).toEqual({ postedAt: 12345 });
      await settle();
      expect(await expectConverged('posts', postId)).toMatchObject({ text: 'B rewrote it', postedAt: 12345 });
      for (const device of [A, B]) expect((await postAssetIds(device, postId)).sort()).toEqual([x, y].sort());
    });

    // A post's photo whose purge waits for the server is hidden from the post (postQuery never shows a
    // purged asset), so it is missing from the editor's seed. Saving a changed photo list removes only
    // the edges the user took out of the seed (edgesRepository setRefs), so a restore made elsewhere
    // that beats the purge (§7) puts the photo back where it was in the post.
    it('a post edited while one of its photos waits on a purge: a restore that beats the purge puts it back in the post', async () => {
      const [x, y, z] = [await seedAsset(), await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'trip', postedAt: null }, [x, y]);
      await edit(A, S + 50, () => repo.deleteAssets(A, [x]));
      await settle();
      await edit(B, S + 100, () => repo.updateAllAssets(B, [x], { deletedAt: null })); // B restores x
      await sync(B);
      await edit(A, S + 200, () => repo.purgeAssets(A, [x])); // A, not having pulled the restore
      const seed = await openEditor(A, postId);
      expect(seed.assetRefs.map((ref: { assetId: string }) => ref.assetId)).toEqual([y]); // x is hidden
      await edit(A, S + 300, () =>
        savePost(A, postId, seed, { ...seed, assetRefs: [...seed.assetRefs, { id: randomUUID(), assetId: z }] }),
      );
      await settle();
      expect(await expectConverged('assets', x)).toMatchObject({ deletedAt: null, purgedAt: null }); // the restore won
      for (const device of [A, B]) expect((await postAssetIds(device, postId)).sort()).toEqual([x, y, z].sort());
    });

    // The same rule keeps a photo another device added while the editor was open: the save removes
    // only what the user removed, as an album's reorder keeps the edges it wasn't given (§7).
    it('a photo another device added to the post while the editor was open survives a save that adds one too', async () => {
      const [x, y, z] = [await seedAsset(), await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'trip', postedAt: null }, [x]);
      await settle();
      const seed = await openEditor(A, postId);
      await edit(B, S + 100, () => postEdges.createFromRefs(B, postId, [{ id: randomUUID(), assetId: y }]));
      await sync(B);
      await sync(A); // arrives while A's editor is open
      await edit(A, S + 200, () =>
        savePost(A, postId, seed, { ...seed, assetRefs: [...seed.assetRefs, { id: randomUUID(), assetId: z }] }),
      );
      await settle();
      for (const device of [A, B]) expect((await postAssetIds(device, postId)).sort()).toEqual([x, y, z].sort());
    });

    // Two devices that add the same photo to a post offline each make an edge for it, and after the
    // sync the post has both; postQuery shows one per asset, so the editor's seed names only that one.
    // Taking the photo out tombstones every live edge to it, so it leaves the post.
    it('a photo both devices added to the post offline leaves it when the editor takes it out', async () => {
      const [x, y] = [await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'trip', postedAt: null }, [x]);
      await settle();
      for (const [device, t] of [
        [A, S + 100],
        [B, S + 150],
      ] as const) {
        const seed = await openEditor(device, postId);
        await edit(device, t, () =>
          savePost(device, postId, seed, { ...seed, assetRefs: [...seed.assetRefs, { id: randomUUID(), assetId: y }] }),
        );
      }
      await settle();
      expect(await postAssetIds(A, postId)).toEqual([x, y]); // one per asset

      const seed = await openEditor(A, postId);
      const kept = seed.assetRefs.filter((ref: { assetId: string }) => ref.assetId !== y);
      await edit(A, S + 300, () => savePost(A, postId, seed, { ...seed, assetRefs: kept }));
      await settle();
      for (const device of [A, B]) expect(await postAssetIds(device, postId)).toEqual([x]);
    });

    // The seed's other half: a seed edge another device removed while the editor was open stays out
    // when the user saves an unrelated photo change; only a ref the user added is restored.
    it('a photo another device took out of the post while the editor was open stays out after a save that adds one', async () => {
      const [x, y, z] = [await seedAsset(), await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'trip', postedAt: null }, [x, y]);
      await settle();
      const seed = await openEditor(A, postId);
      await edit(B, S + 100, () => postEdges.remove(B, postId, [y]));
      await sync(B);
      await sync(A); // arrives while A's editor is open
      await edit(A, S + 200, () =>
        savePost(A, postId, seed, { ...seed, assetRefs: [...seed.assetRefs, { id: randomUUID(), assetId: z }] }),
      );
      await settle();
      for (const device of [A, B]) expect((await postAssetIds(device, postId)).sort()).toEqual([x, z].sort());
    });

    it('a rename and an album notes edit from their seeds keep the other device’s fields', async () => {
      const id = await seedAlbum({ name: 'Trip', notes: null });
      const seed = (await localRow(A, 'albums', id))!;
      await edit(B, S + 100, () => albumRepo.update(B, id, { notes: 'B notes', isFavorite: true }));
      await sync(B);
      await sync(A);
      await edit(A, S + 200, async () => {
        // As the editors do (MoreAction's rename, EditAlbumNotesModal): write a field that changed.
        const name = 'Summer trip';
        if (name !== seed.name) await albumRepo.update(A, id, { name });
        // The notes modal opened before B's edit arrived and saved it unchanged: nothing to write.
        const notes = noteText(seed.notes ?? '');
        if (notes !== noteText(seed.notes)) await albumRepo.update(A, id, { notes });
      });
      await settle();
      expect(await expectConverged('albums', id)).toMatchObject({
        name: 'Summer trip',
        notes: 'B notes',
        isFavorite: true,
      });
    });

    // Round 8: a save is an edit of its seed (edgesRepository setRefs), and what the user moved is read
    // against the seed's order, not the edges' current keys. B drags z to the front of the post while
    // A's editor is open; A, seeded before that arrived, only adds w: B's move and A's add both survive.
    it('a photo another device moved while the editor was open stays where it moved it after a save that only adds one', async () => {
      const [x, y, z, w] = [await seedAsset(), await seedAsset(), await seedAsset(), await seedAsset()];
      at(S);
      const postId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S, text: 'trip', postedAt: null }, [x, y, z]);
      await settle();
      const seedA = await openEditor(A, postId);
      const seedB = await openEditor(B, postId);
      const [rx, ry, rz] = seedB.assetRefs;
      await edit(B, S + 100, () => savePost(B, postId, seedB, { ...seedB, assetRefs: [rz, rx, ry] }));
      await sync(B);
      await sync(A); // arrives while A's editor is open
      for (const device of [A, B]) expect(await postAssetIds(device, postId)).toEqual([z, x, y]);
      await edit(A, S + 200, () =>
        savePost(A, postId, seedA, { ...seedA, assetRefs: [...seedA.assetRefs, { id: randomUUID(), assetId: w }] }),
      );
      await settle();
      for (const device of [A, B]) expect(await postAssetIds(device, postId)).toEqual([z, x, y, w]);
    });
  });

  describe('a device library merged into the account library', () => {
    // D is this device's library from before the sign-in: it holds a copy of the account's asset
    // (an earlier merge copied it) with edits made there since, and merges into A, the account's.
    async function deviceLibraryWith(id: string) {
      const D = makeTestDb();
      await upsertRows(D, 'assets', clientSchema.assets, [{ ...(await localRow(A, 'assets', id))!, syncError: null }]);
      return D;
    }
    async function mergeInto(target: SyncDb, D: SyncDb, t: number) {
      at(t);
      await applyMerge(target, await planMerge(D, target, libraryPaths('device')));
    }

    it('replays the device’s edits field by field against the account’s newer pending edit and another device’s', async () => {
      const id = await seedAsset({ notes: 'orig' });
      const D = await deviceLibraryWith(id);
      await edit(D, S + 100, () => repo.updateAsset(D, id, { notes: 'device' }));
      await edit(D, S + 400, () => repo.updateAsset(D, id, { oldFileId: 'device' }));
      await edit(D, S + 450, () => repo.updateAsset(D, id, { mediaLibraryAssetId: 'device' }));
      await edit(A, S + 300, () => repo.updateAsset(A, id, { notes: 'account' }));
      await edit(B, S + 200, () => repo.toggleFavorite(B, id));
      await edit(B, S + 500, () => repo.updateAsset(B, id, { oldFileId: 'B' }));
      await sync(B);
      await mergeInto(A, D, S + 600);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({
        notes: 'account',
        isFavorite: true,
        oldFileId: 'B',
        mediaLibraryAssetId: 'device',
      });
    });

    // A device library sweeps a purge at once, "which nothing can restore" (§7a), but not once a merge
    // pass has copied its records into the account (the merge marker in its database): opened again
    // while the session is lost (resumeMerges skips it then), its purge of a copied photo reaches the
    // account only with the next pass, where a later restore on another device beats it. The photo is
    // then live in the account, and its files must still be there, the original included if it was
    // never uploaded.
    it('a purge in a device library already merged in part loses to a later restore: its files must still be there', async () => {
      const id = await seedAsset({
        filename: 'only-here.jpg',
        thumbnailFilename: 'only-here-t.jpg',
        isFileSynced: false,
        isThumbnailSynced: false,
        isSynced: false,
      });
      const D = await deviceLibraryWith(id); // a first merge pass copied it into the account
      await setOwner(D, { kind: 'device' });
      await setMergeTarget(D, { library: 'account', serverId: 's1', userId: 'u1' });
      await edit(D, S + 100, () => repo.deleteAssets(D, [id]));
      await edit(D, S + 200, () => repo.purgeAssets(D, [id]));
      const removed: string[] = [];
      // The device library's own sweep, at its open and after the purge.
      await sweepPurgedFiles(D, async (files) => {
        removed.push(...files.flatMap((f) => [f.filename, f.thumbnailFilename].filter((n): n is string => !!n)));
      });
      await edit(B, S + 150, () => repo.deleteAssets(B, [id]));
      await sync(B);
      await edit(B, S + 300, () => repo.updateAllAssets(B, [id], { deletedAt: null }));
      await sync(B);
      await mergeInto(A, D, S + 400); // the next pass
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: null, purgedAt: null });
      expect(removed).toEqual([]);
    });

    // "Target gone": a first pass copied the photo into the account's library T1, which pushed it, then
    // T1 left the list (resumeMerges clears the list's marker and keeps the source's). Opened while
    // the session is lost, the device library trashes the photo, whose file stays. The next sign-in's
    // merge into a new library T2 waits for T2's first full pull (mergeRun), which brings the photo,
    // so the device's deletion replays by id.
    it('after the target is gone, a deletion made in the device library reaches the account through the next merge', async () => {
      const id = await seedAsset({ isFileSynced: false, isThumbnailSynced: false, isSynced: false }); // T1 pushed it
      const D = await deviceLibraryWith(id);
      await setOwner(D, { kind: 'device' });
      await setMergeTarget(D, { library: 'gone', serverId: 's1', userId: 'u1' });
      await edit(D, S + 100, () => repo.deleteAssets(D, [id]));
      const T2 = makeTestDb(); // the account's new library
      await settle([A, B, T2]); // its first full pull
      at(S + 200);
      const plan = await planMerge(D, T2, libraryPaths('device'));
      await applyMerge(T2, plan);
      await settle([A, B, T2]);
      expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({ deletedAt: S + 100 });
    });

    // The device library's outbox is never cleared, so a pass run again (a crash after the commit, a
    // resumed merge) sees the same rows; replayed again, they would set the account's library back to
    // the device's values (a rename, an edge's asset, a restore) until the server's answer came back,
    // and push them once more. The target records the newest clock a committed pass replayed, and only
    // newer edits replay.
    it('a pass run again replays nothing a committed pass did, only what the device edited since', async () => {
      const id = await seedAsset({ notes: 'orig' });
      const D = await deviceLibraryWith(id);
      await edit(D, S + 100, () => repo.updateAsset(D, id, { notes: 'device' }));
      await edit(D, S + 110, () => repo.updateAllAssets(D, [id], { deletedAt: S + 110 }));
      await mergeInto(A, D, S + 200);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'device', deletedAt: S + 110 });
      await edit(B, S + 300, () => repo.updateAsset(B, id, { notes: 'account' }));
      await edit(B, S + 310, () => repo.updateAllAssets(B, [id], { deletedAt: null }));
      await sync(B);
      await settle();
      const again = await planMerge(D, A, libraryPaths('device'));
      expect(again.replays).toEqual([]);
      await applyMerge(A, again);
      expect(await localRow(A, 'assets', id)).toMatchObject({ notes: 'account', deletedAt: null }); // not set back
      // An edit the device makes after the commit still replays.
      await edit(D, S + 600, () => repo.updateAsset(D, id, { oldFileId: 'later' }));
      const later = await planMerge(D, A, libraryPaths('device'));
      expect(later.replays.map((row) => Object.keys(row.fields))).toEqual([['oldFileId']]);
      await applyMerge(A, later);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({
        notes: 'account',
        deletedAt: null,
        oldFileId: 'later',
      });
    });

    // Round 8 (was on main): the sign-in merged the device library right after the switch, into the
    // account's library on a new phone, new and empty: the camera-roll match found nothing, and the
    // account's photo arrived with the first full pull beside the copy. Every merge waits for the
    // target's first full pull now, and runs when it drains (useMergeAfterFirstSync).
    it('a photo the account has from the same camera-roll item isn’t duplicated by a sign-in on a new phone', async () => {
      await seedAsset({ mediaLibraryAssetId: 'camera-roll-1', filename: 'from-a.jpg' }); // on the account
      const D = makeTestDb(); // the new phone's device library, before the sign-in
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      await repo.createAsset(
        D,
        makeAssetRecord({ mediaLibraryAssetId: 'camera-roll-1', filename: 'on-phone.jpg', isFileSynced: false }),
      );
      const N = makeTestDb(); // the account's library on the new phone, just created by the switch
      expect(await mergeWaits(D, N)).toBe(true); // the sign-in: the merge waits
      await sync(N); // the first full pull
      expect(await mergeWaits(D, N)).toBe(false);
      await mergeInto(N, D, S + 300);
      await settle([A, B, N]);
      const live = (await N.select().from(clientSchema.assets)).filter((row) => row.deletedAt === null);
      expect(live.map((row) => row.mediaLibraryAssetId)).toEqual(['camera-roll-1']);
    });

    // Round 13: the iPhone's device library has its copy of camera-roll item x, a favorite with a note
    // (S+100). Later, the iPad (B) notes the account's photo of x and favorites it and takes that back
    // (S+200..S+220). At the sign-in on the iPhone, pass 1 into the account's library T1 merges the
    // device's photo into it at S+300 (the iPad's note, then the iPhone's; a favorite) and commits,
    // and T1 is lost before it pushes. The pass into the next library T2 redoes the match (T2's marks
    // don't hold it), stamped at the clock pass 1 merged it at (S+300), newer than the iPad's edits:
    // both notes and the favorite, everywhere.
    it('round 13: a redone match keeps what pass 1 merged after an earlier edit of the account', async () => {
      const id = await seedAsset({ mediaLibraryAssetId: 'camera-roll-x', notes: null, isFavorite: false });
      const D = makeTestDb(); // the iPhone's device library, before the sign-in
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      await repo.createAsset(
        D,
        makeAssetRecord({
          ...{ mediaLibraryAssetId: 'camera-roll-x', filename: 'on-phone.jpg', isFileSynced: false },
          ...{ isFavorite: true, notes: 'from the iPhone' },
        }),
      );
      await edit(B, S + 200, () => repo.updateAsset(B, id, { notes: 'from the iPad' }));
      await edit(B, S + 210, () => repo.toggleFavorite(B, id));
      await edit(B, S + 220, () => repo.toggleFavorite(B, id));
      await sync(B);

      // Pass 1 into T1 after its first pull: the marker, the commit, the marks in the source; T1 is lost.
      const T1 = makeTestDb();
      await sync(T1);
      at(S + 300);
      const plan = await planMerge(D, T1, libraryPaths('device'));
      await setMergeTarget(D, { library: 'T1', serverId: 's1', userId: 'u1' });
      await applyMerge(T1, plan);
      await setMergeMarks(D, libraryPaths('device').dbName, plan.marks.decided);
      expect(await localRow(T1, 'assets', id)).toMatchObject({
        notes: 'from the iPad\nfrom the iPhone',
        isFavorite: true,
      });

      const T2 = makeTestDb();
      await settle([A, B, T2]); // its first full pull
      at(S + 400);
      await applyMerge(T2, await planMerge(D, T2, libraryPaths('device')));
      await settle([A, B, T2]);

      expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({
        notes: 'from the iPad\nfrom the iPhone',
        isFavorite: true,
      });
    });

    // Round 14: pass 1 into T1 merges the iPhone's note into the account's photo of item x at S+300,
    // and T1 is lost before it pushes. The iPad then notes the photo, and favorites it and takes that
    // back (S+400..S+420). With T1 gone and no tokens, the device library is open again (libraryToOpen)
    // and the user edits the iPhone's photo at S+500: a new note, and a favorite. The pass into T2
    // (S+600) redoes pass 1's match at its clock (S+300), but with the photo's values as they are now,
    // the S+500 edits included; this pass's merge of those edits at now then finds nothing left to
    // change, so they only go at S+300 and lose to the iPad's older edits on the server.
    // Expected: the edits made on the iPhone after the iPad's (S+500) win: a favorite, and the new note.
    // Actual: the server keeps the iPad's (not a favorite, 'from the iPad'); the iPhone's edits are gone.
    it.fails(
      'round 14: an edit made on the device after a lost pass beats an earlier edit of the account',
      async () => {
        const id = await seedAsset({ mediaLibraryAssetId: 'camera-roll-x', notes: null, isFavorite: false });
        const D = makeTestDb();
        await setOwner(D, { kind: 'device' });
        at(S + 100);
        const photo = await repo.createAsset(
          D,
          makeAssetRecord({
            ...{ mediaLibraryAssetId: 'camera-roll-x', filename: 'on-phone.jpg', isFileSynced: false },
            ...{ isFavorite: false, notes: 'from the iPhone' },
          }),
        );

        const T1 = makeTestDb();
        await sync(T1);
        at(S + 300);
        const plan = await planMerge(D, T1, libraryPaths('device'));
        await setMergeTarget(D, { library: 'T1', serverId: 's1', userId: 'u1' });
        await applyMerge(T1, plan);
        await setMergeMarks(D, libraryPaths('device').dbName, plan.marks.decided);

        await edit(B, S + 400, () => repo.updateAsset(B, id, { notes: 'from the iPad' }));
        await edit(B, S + 410, () => repo.toggleFavorite(B, id));
        await edit(B, S + 420, () => repo.toggleFavorite(B, id));
        await sync(B);
        await edit(D, S + 500, () => repo.updateAsset(D, photo.id, { notes: 'from the iPhone, later' }));
        await edit(D, S + 510, () => repo.toggleFavorite(D, photo.id));

        const T2 = makeTestDb();
        await settle([A, B, T2]);
        at(S + 600);
        await applyMerge(T2, await planMerge(D, T2, libraryPaths('device')));
        await settle([A, B, T2]);

        expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({
          notes: 'from the iPad\nfrom the iPhone, later',
          isFavorite: true,
        });
      },
    );

    // Round 14: D holds the account's photo by id (an earlier library's pass copied it and pushed it,
    // then that library was lost; as in deviceLibraryWith). Opened again while the session had no
    // tokens, D notes the photo (S+100). Pass 1 into T1 replays that note onto T1's row (by id) and
    // commits; the source records the copy decision at the note's clock. T1 is lost before it pushes.
    // The pass into T2 (whose first pull brought the photo without the note) replays only edits newer
    // than the mark, so nothing: the replay T1 never pushed isn't made again, unlike a match's merge.
    // Expected: the device's note reaches the account. Actual: the account keeps 'orig'.
    it.fails('round 14: an edit replayed by id into a library lost before it pushed is replayed again', async () => {
      const id = await seedAsset({ notes: 'orig' });
      const D = await deviceLibraryWith(id);
      await setOwner(D, { kind: 'device' });
      await edit(D, S + 100, () => repo.updateAsset(D, id, { notes: 'device' }));

      const T1 = makeTestDb();
      await sync(T1);
      at(S + 300);
      const plan = await planMerge(D, T1, libraryPaths('device'));
      await setMergeTarget(D, { library: 'T1', serverId: 's1', userId: 'u1' });
      await applyMerge(T1, plan);
      await setMergeMarks(D, libraryPaths('device').dbName, plan.marks.decided);
      expect(await localRow(T1, 'assets', id)).toMatchObject({ notes: 'device' });

      const T2 = makeTestDb();
      await settle([A, B, T2]);
      at(S + 400);
      await applyMerge(T2, await planMerge(D, T2, libraryPaths('device')));
      await settle([A, B, T2]);

      expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({ notes: 'device' });
    });

    // Round 14: D holds the account's photo X of camera-roll item x by id (as in deviceLibraryWith), and
    // the same item imported again as P (S+100). Pass 1 into T1 matches P into X (S+300) and commits;
    // T1 is lost before it pushes. Opened again, D favorites X (S+500). The pass into T2 plans two
    // replays of X: the device's favorite (by id) and pass 1's redone match of P. applyMerge keys the
    // replays by record id (`sent`, a Map), so the redo replaces the by-id replay and the favorite
    // never reaches X.
    // Expected: X is a favorite with P's note. Actual: X has P's note but isn't a favorite.
    it.fails('round 14: a redone match of a record the device also edited by id keeps that edit', async () => {
      const id = await seedAsset({ mediaLibraryAssetId: 'camera-roll-x', notes: 'orig', isFavorite: false });
      const D = await deviceLibraryWith(id);
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      await repo.createAsset(
        D,
        makeAssetRecord({
          mediaLibraryAssetId: 'camera-roll-x',
          filename: 'again.jpg',
          isFileSynced: false,
          notes: 'imported again',
        }),
      );

      const T1 = makeTestDb();
      await sync(T1);
      at(S + 300);
      const plan = await planMerge(D, T1, libraryPaths('device'));
      await setMergeTarget(D, { library: 'T1', serverId: 's1', userId: 'u1' });
      await applyMerge(T1, plan);
      await setMergeMarks(D, libraryPaths('device').dbName, plan.marks.decided);
      expect(await localRow(T1, 'assets', id)).toMatchObject({ notes: 'orig\nimported again' });

      await edit(D, S + 500, () => repo.toggleFavorite(D, id));
      const T2 = makeTestDb();
      await settle([A, B, T2]);
      at(S + 600);
      await applyMerge(T2, await planMerge(D, T2, libraryPaths('device')));
      await settle([A, B, T2]);

      expect(await expectConverged('assets', id, [A, B, T2])).toMatchObject({
        notes: 'orig\nimported again',
        isFavorite: true,
      });
    });

    // Round 14: D holds the account's photo X of camera-roll item x by id (as in deviceLibraryWith),
    // and the same item imported again as P with a note (imports don't dedupe). The user deletes the
    // duplicate X on the device and keeps P. The merge plans P as a match of X (live in the account at
    // plan time) and replays X's deletion by id: applyMerge deletes X, then merges P's note into it.
    // P is gone with the source, so the photo the user kept is in the account's trash.
    // Expected: a live photo of item x with P's note. Actual: none; X is deleted, P's note on it.
    it.fails('round 14: a photo kept on the device isn’t merged into its duplicate the device deleted', async () => {
      const id = await seedAsset({ mediaLibraryAssetId: 'camera-roll-x', notes: null });
      const D = await deviceLibraryWith(id);
      await setOwner(D, { kind: 'device' });
      at(S + 100);
      await repo.createAsset(
        D,
        makeAssetRecord({ mediaLibraryAssetId: 'camera-roll-x', filename: 'kept.jpg', isFileSynced: false }),
      );
      await edit(D, S + 150, async () => {
        const [kept] = (await D.select().from(clientSchema.assets)).filter((row) => row.id !== id);
        await repo.updateAsset(D, kept!.id, { notes: 'the one I kept' });
      });
      await edit(D, S + 200, () => repo.deleteAssets(D, [id]));

      await mergeInto(A, D, S + 300);
      await settle();

      const live = (await A.select().from(clientSchema.assets)).filter((row) => row.deletedAt === null);
      expect(live.map((row) => [row.mediaLibraryAssetId, row.notes])).toEqual([['camera-roll-x', 'the one I kept']]);
    });

    it('a device purge older than the account’s pending restore loses to it everywhere', async () => {
      const id = await seedAsset();
      await edit(A, S + 50, () => repo.deleteAssets(A, [id]));
      await settle();
      const D = await deviceLibraryWith(id);
      await edit(D, S + 100, () => repo.purgeAssets(D, [id]));
      await edit(A, S + 200, () => repo.updateAllAssets(A, [id], { deletedAt: null }));
      await mergeInto(A, D, S + 300);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: null, purgedAt: null });
    });
  });

  describe('albums and their edges', () => {
    it('an album deleted on A while B reorders and renames it: it and its edges stay deleted, B’s values kept', async () => {
      const albumEdges = makeEdgeRepository('album_assets', clientSchema.albumAssets, 'albumId');
      const id = await seedAlbum({ name: 'Trip' });
      const [a1, a2, a3] = [randomUUID(), randomUUID(), randomUUID()];
      await edit(A, S + 10, () => albumEdges.add(A, id, [a1, a2, a3], randomUUID));
      await settle();
      await edit(A, S + 100, async () => {
        await albumRepo.remove(A, [id]);
        await albumEdges.tombstoneParent(A, id);
      });
      await edit(B, S + 200, async () => {
        await albumEdges.reorder(B, id, [a3, a1, a2]);
        await albumRepo.update(B, id, { name: 'Summer' });
      });
      await sync(B);
      await sync(A);
      await settle();
      expect(await expectConverged('albums', id)).toMatchObject({ name: 'Summer', deletedAt: S + 100 });
      const edges = await A.select().from(clientSchema.albumAssets);
      expect(edges).toHaveLength(3);
      for (const e of edges) {
        expect(e.deletedAt).toBe(S + 100);
        await expectConverged('album_assets', e.id);
      }
      expect(
        albumOrder(
          edges.map((e) => ({ ...e, deletedAt: null })),
          id,
        ),
      ).toEqual([a3, a1, a2]);
    });

    it('a post edge removed on A and put back on B later: the newer re-add wins', async () => {
      const postEdges = makeEdgeRepository('post_assets', clientSchema.postAssets, 'postId');
      at(S);
      const postId = randomUUID();
      const asset = randomUUID();
      const edgeId = randomUUID();
      await createPost(A, { id: postId, createdAt: S, updatedAt: S }, [asset], () => edgeId);
      await settle();
      await edit(A, S + 100, () => postEdges.remove(A, postId, [asset]));
      await sync(A);
      await sync(B);
      await edit(B, S + 300, () => postEdges.setRefs(B, postId, [{ id: edgeId, assetId: asset }], []));
      await settle();
      expect(await expectConverged('post_assets', edgeId)).toMatchObject({ deletedAt: null });
    });
  });

  describe('idempotency', () => {
    it('a replayed push (the request sent twice) is applied twice and changes nothing more', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.updateAsset(A, id, { notes: 'A', isFavorite: true }));
      at(SERVER_NOW);
      let seqAfterFirst: unknown;
      await runSyncOnce(A, {
        push: async (req) => {
          await serverPush(pgDb as any, USER2, req.mutations);
          seqAfterFirst = (await serverRaw('assets', id))!.serverSeq;
          const results = await serverPush(pgDb as any, USER2, req.mutations);
          await checkResults(req.mutations, results);
          expect(results.map((r) => r.status)).toEqual(['applied']);
          return { results };
        },
        pull: (req) => serverPull(pgDb as any, USER2, req),
      });
      expect((await serverRaw('assets', id))!.serverSeq).toBe(seqAfterFirst);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ notes: 'A', isFavorite: true });
    });

    it('an outbox pushed again after a crash before its results were applied converges, a newer edit elsewhere included', async () => {
      const contested = await seedAsset();
      const quiet = await seedAsset();
      await edit(A, S + 100, () => repo.updateAsset(A, contested, { notes: 'A' }));
      await edit(A, S + 110, () => repo.updateAsset(A, quiet, { notes: 'A quiet' }));
      at(SERVER_NOW);
      await expect(
        runSyncOnce(A, {
          push: async (req) => {
            await serverPush(pgDb as any, USER2, req.mutations);
            throw new Error('crashed before the results were applied');
          },
          pull: (req) => serverPull(pgDb as any, USER2, req),
        }),
      ).rejects.toThrow('crashed');
      expect(await A.select().from(clientSchema.outbox)).toHaveLength(2);
      const quietSeq = (await serverRaw('assets', quiet))!.serverSeq;

      await edit(B, S + 200, () => repo.updateAsset(B, contested, { notes: 'B, newer' }));
      await sync(B);
      await sync(A); // the re-push: the contested edit loses now, the other is a replay
      const replay = pushLog.at(-1)!.results;
      expect(replay.find((r) => r.id === contested)).toMatchObject({
        status: 'skipped-lww',
        current: { notes: 'B, newer' },
      });
      expect(replay.find((r) => r.id === quiet)!.status).toBe('applied');
      expect((await serverRaw('assets', quiet))!.serverSeq).toBe(quietSeq);
      await settle();
      expect((await expectConverged('assets', contested)).notes).toBe('B, newer');
      expect((await expectConverged('assets', quiet)).notes).toBe('A quiet');
    });
  });

  describe('a restore beats a purge', () => {
    function recorder() {
      const removed: string[] = [];
      const removeFiles: RemoveFiles = async (files) => {
        removed.push(...files.flatMap((f) => [f.filename, f.thumbnailFilename].filter((n): n is string => !!n)));
      };
      return { removed, removeFiles };
    }

    it('a restore beats a purge that hadn’t seen it when the deleting device’s clock is ahead', async () => {
      const id = await seedAsset({ filename: 'skew.jpg', thumbnailFilename: 'skew-t.jpg' });
      await edit(B, S + HOUR + 100, () => repo.deleteAssets(B, [id])); // B's clock is an hour ahead
      await sync(B, { now: S + 100 });
      await sync(A, { now: S + 150 });
      await edit(A, S + 200, () => repo.updateAllAssets(A, [id], { deletedAt: null }));
      await sync(A, { now: S + 200 });
      await edit(B, S + HOUR + 300, () => repo.purgeAssets(B, [id])); // B never pulled the restore
      await sync(B, { now: S + 300 });
      const { removed, removeFiles } = recorder();
      await sync(A, { now: S + 400, removeFiles });
      await settle();
      expect(removed).toEqual([]);
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: null, purgedAt: null });
    });

    it('a purge that loses keeps a file it shares with a purge that wins in the same push', async () => {
      const x = await seedAsset({ filename: 'shared.jpg', thumbnailFilename: 'x-t.jpg' });
      const y = await seedAsset({ filename: 'shared.jpg', thumbnailFilename: 'y-t.jpg' });
      await edit(A, S + 100, () => repo.deleteAssets(A, [x, y]));
      await settle();
      await edit(B, S + 200, () => repo.updateAllAssets(B, [y], { deletedAt: null }));
      await sync(B);
      await edit(A, S + 300, () => repo.purgeAssets(A, [x, y])); // A never saw y restored
      const { removed, removeFiles } = recorder();
      await sync(A, { removeFiles });
      expect(await localRow(A, 'assets', y)).toMatchObject({ deletedAt: null, purgedAt: null });
      expect(removed).toEqual(['x-t.jpg']); // shared.jpg is y's file too, and y is back
      await settle();
      expect(await expectConverged('assets', x)).toMatchObject({ purgedAt: S + 300 });
      expect(await expectConverged('assets', y)).toMatchObject({ deletedAt: null, purgedAt: null });
    });

    it('purge, restore, delete again, purge again across three devices: the last deletion is purged, files go once per device', async () => {
      const id = await seedAsset({ filename: 'cycle.jpg', thumbnailFilename: 'cycle-t.jpg' });
      await edit(A, S + 100, () => repo.deleteAssets(A, [id]));
      await settle();
      await edit(A, S + 200, () => repo.purgeAssets(A, [id])); // A, offline
      await edit(B, S + 300, () => repo.updateAllAssets(B, [id], { deletedAt: null }));
      await sync(B);
      await edit(C, S + 50, () => repo.toggleFavorite(C, id)); // the old app, older than everything
      await sync(C);
      const onA = recorder();
      await sync(A, { removeFiles: onA.removeFiles }); // A's purge loses to the restore it hadn't seen
      expect(onA.removed).toEqual([]);
      expect(await localRow(A, 'assets', id)).toMatchObject({ deletedAt: null, purgedAt: null });
      await settle();
      await edit(B, S + 400, () => repo.deleteAssets(B, [id]));
      await settle();
      await edit(A, S + 500, () => repo.purgeAssets(A, [id])); // this one saw the restore and the delete
      await edit(B, S + 600, () => repo.purgeAssets(B, [id])); // and B purges too, unaware
      const onB = recorder();
      await sync(A, { removeFiles: onA.removeFiles });
      await sync(B, { removeFiles: onB.removeFiles });
      for (let i = 0; i < 3; i++)
        for (const [device, removeFiles] of [
          [A, onA.removeFiles],
          [B, onB.removeFiles],
        ] as const)
          await sync(device, { removeFiles });
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 400, purgedAt: S + 500 });
      expect(onA.removed).toEqual(['cycle.jpg', 'cycle-t.jpg']);
      expect(onB.removed).toEqual(['cycle.jpg', 'cycle-t.jpg']);
    });

    it('an old app’s stale whole record re-deletes a restored photo, and a purge that hadn’t seen the restore then applies', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.deleteAssets(A, [id]));
      await settle();
      await edit(B, S + 200, () => repo.updateAllAssets(B, [id], { deletedAt: null }));
      await sync(B);
      await edit(C, S + 300, () => repo.updateAsset(C, id, { notes: 'C, in the Deleted album' })); // stale: deleted
      await sync(C); // its whole record re-deletes the photo at S+300 (§7)
      await edit(A, S + 250, () => repo.purgeAssets(A, [id])); // A never saw the restore
      await settle();
      // C's stale deletedAt (S+100) is newer by clock than B's restore, so A's purge of it applies.
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 100, purgedAt: S + 250 });
    });

    // An app from before "Delete permanently": no `fields`, and no purgedAt in its records.
    async function syncAsPrePurgeApp(device: SyncDb) {
      at(SERVER_NOW);
      const base = transportOf(device);
      await runSyncOnce(device, {
        ...base,
        push: (req) =>
          base.push({
            mutations: req.mutations.map((m) => {
              const { purgedAt: _purgedAt, ...record } = m.record as Record<string, unknown>;
              return { ...m, record: record as PushMutation['record'] };
            }),
          }),
      });
    }

    it('old apps against the purge rule: a whole-record purge keeps its whole-record rule, a pre-purge restore beats a later purge', async () => {
      // C (no fields) purges, unaware of B's restore: newer, its whole record re-deletes and purges (the
      // installed app removed its files at once, so refusing it would strand a live photo without them).
      const first = await seedAsset();
      await edit(A, S + 100, () => repo.deleteAssets(A, [first]));
      await settle();
      await edit(B, S + 200, () => repo.updateAllAssets(B, [first], { deletedAt: null }));
      await sync(B);
      await edit(C, S + 300, () => repo.purgeAssets(C, [first]));
      await sync(C);
      expect(pushLog.at(-1)!.results[0]!.status).toBe('applied');
      await settle();
      expect(await expectConverged('assets', first)).toMatchObject({ deletedAt: S + 100, purgedAt: S + 300 });

      // C, as an app from before purges, restores; A, unaware, purges later by clock.
      const second = await seedAsset();
      await edit(A, S + 100, () => repo.deleteAssets(A, [second]));
      await settle();
      await edit(C, S + 200, () => repo.updateAllAssets(C, [second], { deletedAt: null }));
      await syncAsPrePurgeApp(C);
      await edit(A, S + 300, () => repo.purgeAssets(A, [second]));
      await settle([A, B]);
      await syncAsPrePurgeApp(C);
      await settle();
      expect(await expectConverged('assets', second)).toMatchObject({ deletedAt: null, purgedAt: null });
    });

    it('an app from before purges pushing a stale record to a purged row: frozen, told so, and it converges', async () => {
      const id = await seedAsset();
      await edit(A, S + 100, () => repo.deleteAssets(A, [id]));
      await settle();
      await edit(A, S + 200, () => repo.purgeAssets(A, [id]));
      await sync(A);
      const frozen = await serverRaw('assets', id);
      await edit(C, S + 900, () => repo.updateAllAssets(C, [id], { deletedAt: null, notes: 'C' }));
      await syncAsPrePurgeApp(C);
      expect(pushLog.at(-1)!.results[0]).toMatchObject({ status: 'skipped-lww', current: { purgedAt: S + 200 } });
      expect(await serverRaw('assets', id)).toEqual(frozen);
      await settle();
      expect(await expectConverged('assets', id)).toMatchObject({ deletedAt: S + 100, purgedAt: S + 200, notes: null });
    });

    it('purges and restores across push batches of 500 and pull pages with pending edits converge; files go only for the purges that won', async () => {
      const n = 1100;
      at(S);
      const created = await repo.createAssets(
        A,
        Array.from({ length: n }, (_, i) =>
          makeAssetRecord({ createdAt: S, updatedAt: S, filename: `g${i}.jpg`, thumbnailFilename: `g${i}-t.jpg` }),
        ),
      );
      const ids = created.map((r) => r.id);
      await settle([A, B]);
      await edit(A, S + 100, () => repo.deleteAssets(A, ids));
      await settle([A, B]);
      const restored = new Set(ids.filter((_, i) => i % 7 === 0));
      await edit(B, S + 200, () => repo.updateAllAssets(B, [...restored], { deletedAt: null }));
      await edit(B, S + 250, () =>
        repo.updateAllAssets(
          B,
          ids.filter((_, i) => i % 11 === 0),
          { notes: 'B' },
        ),
      );
      await sync(B);
      await edit(A, S + 300, () => repo.purgeAssets(A, ids)); // A never saw the restores
      const pending = ids.filter((_, i) => i % 13 === 0);
      await edit(B, S + 350, () => repo.updateAllAssets(B, pending, { isFavorite: true })); // B, still offline
      const onA = recorder();
      await sync(A, { removeFiles: onA.removeFiles });
      const onB = recorder();
      // B pulls the purges around its pending favorites (its push refused), then pushes them.
      const refused: SyncTransport['push'] = async (req) => ({
        results: req.mutations.map((m) => ({
          id: String(m.record.id),
          collection: m.collection,
          status: 'rejected' as const,
          reason: 'offline',
        })),
      });
      at(SERVER_NOW);
      await runSyncOnce(B, { ...transportOf(B), push: refused }, { removeFiles: onB.removeFiles });
      await retryFailures(B);
      await runSyncOnce(B, transportOf(B), { removeFiles: onB.removeFiles });
      await settle([A, B]);
      const won = ids.filter((id) => !restored.has(id));
      const files = (list: string[]) =>
        list.flatMap((id) => {
          const i = ids.indexOf(id);
          return [`g${i}.jpg`, `g${i}-t.jpg`];
        });
      expect(onA.removed.sort()).toEqual(files(won).sort());
      expect(onB.removed.sort()).toEqual(files(won).sort());
      const serverRows = await pgDb.select().from(serverSchema.assets).where(eq(serverSchema.assets.userId, USER2));
      const server = new Map(serverRows.map((row) => [row.id, synced('assets', row)]));
      for (const device of [A, B]) {
        const local = new Map(
          (await device.select().from(clientSchema.assets)).map((row) => [row.id, synced('assets', row)]),
        );
        expect(local).toEqual(server);
        expect(await device.select().from(clientSchema.outbox)).toEqual([]);
      }
      for (const [i, id] of ids.entries()) {
        const row = server.get(id)!;
        if (restored.has(id))
          expect(row).toMatchObject({ deletedAt: null, purgedAt: null, notes: i % 11 === 0 ? 'B' : null });
        else expect(row).toMatchObject({ deletedAt: S + 100, purgedAt: S + 300 });
        // B's favorite survives on a restored photo; a purged one is frozen without it.
        expect(row.isFavorite).toBe(restored.has(id) && i % 13 === 0);
      }
    }, 120_000);
  });

  describe('random interleavings (seeded, the real client and server)', () => {
    function prng(seed: number) {
      let a = seed >>> 0;
      const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      return {
        pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!,
        chance: (p: number) => next() < p,
      };
    }

    // One seeded case: four photos (two share a file), devices A and B, C an old app half the time,
    // random clock skew, edits, deletes, restores and purges, syncs, pushes whose answer is lost and
    // pulls around a waiting edit. Then every device syncs until quiet.
    async function fuzzCase(seed: number, steps: number): Promise<string[]> {
      const rand = prng(seed);
      const problems: string[] = [];
      const fail = (step: number, message: string) => problems.push(`seed ${seed} step ${step}: ${message}`);
      await clearServer();
      A = makeTestDb();
      B = makeTestDb();
      C = makeTestDb();
      const devices = [A, B, C];
      const names = new Map<SyncDb, string>([
        [A, 'A'],
        [B, 'B'],
        [C, 'C'],
      ]);
      oldApps.clear();
      if (rand.chance(0.5)) oldApps.add(C);
      const skews = [0, 0, HOUR, -HOUR, 2_000, -2_000];
      const skew = new Map(devices.map((device) => [device, rand.pick(skews)]));
      const removed = new Map(devices.map((device) => [device, [] as string[]]));
      const removeFilesOf =
        (device: SyncDb): RemoveFiles =>
        async (files) => {
          const names = new Set(
            files.flatMap((f) => [f.filename, f.thumbnailFilename].filter((n): n is string => !!n)),
          );
          removed.get(device)!.push(...names);
        };

      at(S);
      const created = await repo.createAssets(
        A,
        [0, 1, 2, 3].map((i) =>
          makeAssetRecord({
            createdAt: S,
            updatedAt: S,
            filename: i < 2 ? 'shared.jpg' : `own${i}.jpg`,
            thumbnailFilename: `thumb${i}.jpg`,
          }),
        ),
      );
      const ids = created.map((r) => r.id);
      let t = S + 10;
      const syncAt = async (device: SyncDb, now: number) => {
        at(now);
        await runSyncOnce(device, transportOf(device), { removeFiles: removeFilesOf(device) });
      };
      for (let round = 0; round < 2; round++) for (const device of devices) await syncAt(device, t);

      // The server rows, raw (server_seq and field_clock included), to check every step against.
      const rawRows = async () =>
        new Map(
          (await pgDb.select().from(serverSchema.assets).where(eq(serverSchema.assets.userId, USER2))).map((row) => [
            row.id,
            row as Record<string, any>,
          ]),
        );
      let before = await rawRows();
      const unanswered = new Set<SyncDb>();
      const ops = [
        'delete',
        'restore',
        'purge',
        'favorite',
        'notes',
        'sync',
        'sync',
        'sync',
        'lost',
        'pullOnly',
      ] as const;

      for (let step = 0; step < steps; step++) {
        t += rand.pick([1, 5, 50, 300]);
        const device = rand.pick(devices);
        const subset = ids.filter(() => rand.chance(0.5));
        const rows = (await device.select().from(clientSchema.assets)).filter((row) => subset.includes(row.id));
        const alive = rows.filter((row) => row.purgedAt === null);
        const deleted = alive.filter((row) => row.deletedAt !== null);
        const op = rand.pick(ops);
        if (process.env.FUZZ_LOG)
          console.log(
            step,
            t - S,
            names.get(device),
            op,
            rows
              .map(
                (r) =>
                  `${ids.indexOf(r.id)}:${r.deletedAt ? 'd' : ''}${r.purgedAt ? 'p' : ''}${r.purgedAt && r.filesRemovedFor === r.purgedAt ? 'r' : ''}`,
              )
              .join(' '),
            JSON.stringify(
              (await device.select().from(clientSchema.outbox)).map((o) => [
                ids.indexOf(o.recordId),
                Object.keys(o.fields).join(','),
                o.error,
              ]),
            ),
          );
        at(t + skew.get(device)!);
        if (op === 'delete')
          await repo.deleteAssets(
            device,
            alive.filter((row) => row.deletedAt === null).map((row) => row.id),
          );
        if (op === 'restore')
          await repo.updateAllAssets(
            device,
            deleted.map((row) => row.id),
            { deletedAt: null },
          );
        if (op === 'purge')
          await repo.purgeAssets(
            device,
            deleted.map((row) => row.id),
          );
        if (op === 'favorite' && alive[0]) await repo.toggleFavorite(device, alive[0].id);
        if (op === 'notes' && alive[0])
          await repo.updateAsset(device, alive[0].id, { notes: `${names.get(device)}${step}` });
        if (op === 'sync' || (op === 'pullOnly' && unanswered.has(device))) {
          unanswered.delete(device);
          await syncAt(device, t);
        }
        if (op === 'lost') {
          // The push lands, but the device never hears back: the run fails, and the next one pushes again.
          at(t);
          const base = transportOf(device);
          await runSyncOnce(
            device,
            {
              ...base,
              push: async (req) => {
                await base.push(req);
                throw new Error('no answer');
              },
            },
            { removeFiles: removeFilesOf(device) },
          ).catch(() => {});
          unanswered.add(device);
        }
        if (op === 'pullOnly' && !unanswered.has(device)) {
          // Offline for pushes (each refused), so the pull applies around the waiting edits (§5).
          at(t);
          await runSyncOnce(
            device,
            {
              ...transportOf(device),
              push: async (req) => ({
                results: req.mutations.map((m) => ({
                  id: String(m.record.id),
                  collection: m.collection,
                  status: 'rejected' as const,
                  reason: 'offline',
                })),
              }),
            },
            { removeFiles: removeFilesOf(device) },
          );
          await retryFailures(device);
        }

        const after = await rawRows();
        for (const [id, row] of after) {
          const prev = before.get(id)!;
          if (prev.purgedAt !== null && JSON.stringify(row) !== JSON.stringify(prev))
            fail(step, `the purged row ${id} changed: ${JSON.stringify(prev)} → ${JSON.stringify(row)}`);
          const { serverSeq: _s, ...rest } = row;
          const { serverSeq: _p, ...restBefore } = prev;
          if (row.serverSeq !== prev.serverSeq && JSON.stringify(rest) === JSON.stringify(restBefore))
            fail(step, `a new server_seq for an unchanged row ${id}`);
        }
        before = after;
      }

      for (let round = 0; round < 4; round++) for (const device of devices) await syncAt(device, t + 10_000_000);

      const server = await rawRows();
      for (const id of ids) {
        const expected = synced('assets', server.get(id));
        for (const device of devices) {
          const local = synced('assets', await localRow(device, 'assets', id));
          if (JSON.stringify(local) !== JSON.stringify(expected))
            fail(
              steps,
              `${names.get(device)} diverged on ${id}: ${JSON.stringify(local)} vs ${JSON.stringify(expected)}`,
            );
        }
      }
      for (const device of devices)
        if ((await device.select().from(clientSchema.outbox)).length > 0)
          fail(steps, `${names.get(device)} has pending rows`);

      // Files: each device removed, once, exactly the names only purged photos use.
      const live = [...server.values()].filter((row) => row.purgedAt === null);
      const inUse = new Set(live.flatMap((row) => [row.filename, row.thumbnailFilename]));
      const gone = new Set(
        [...server.values()]
          .filter((row) => row.purgedAt !== null)
          .flatMap((row) => [row.filename, row.thumbnailFilename])
          .filter((name) => !inUse.has(name)),
      );
      for (const device of devices) {
        const list = removed.get(device)!;
        if (new Set(list).size !== list.length) fail(steps, `${names.get(device)} removed a file twice: ${list}`);
        if (JSON.stringify([...new Set(list)].sort()) !== JSON.stringify([...gone].sort()))
          fail(steps, `${names.get(device)} removed ${[...list].sort()}, expected ${[...gone].sort()}`);
      }
      return problems;
    }

    it('60 seeded cases of 30 steps converge, keep purged rows frozen and remove each purged file once per device', async () => {
      const problems: string[] = [];
      const only = Number(process.env.FUZZ_SEED);
      const cases = Number(process.env.FUZZ_CASES ?? 60);
      for (let seed = 1; seed <= cases; seed++)
        if (!only || seed === only) problems.push(...(await fuzzCase(seed, 30)));
      expect(problems.slice(0, 8)).toEqual([]);
    }, 300_000);
  });

  describe('many records', () => {
    it('1,200 records across push batches of 500, mixed with conflicts and an edit during the push, converge', async () => {
      const n = 1200;
      at(S);
      const created = await repo.createAssets(
        A,
        Array.from({ length: n }, (_, i) => makeAssetRecord({ createdAt: S, updatedAt: S, filename: `f${i}.jpg` })),
      );
      const ids = created.map((r) => r.id);
      await settle([A, B]);

      await edit(A, S + 100, () => repo.updateAllAssets(A, ids, { notes: 'A' }));
      await edit(B, S + 200, () => repo.updateAllAssets(B, ids, { isFavorite: true }));
      await edit(B, S + 300, () =>
        repo.updateAllAssets(
          B,
          ids.filter((_, i) => i % 3 === 0),
          { notes: 'B' },
        ),
      );
      await edit(A, S + 400, () =>
        repo.deleteAssets(
          A,
          ids.filter((_, i) => i % 5 === 0),
        ),
      );
      await sync(B);

      // While A's first batch is at the server, A edits a record of that batch again.
      let pushes = 0;
      const base = transportOf(A);
      at(SERVER_NOW);
      await runSyncOnce(A, {
        pull: base.pull,
        push: async (req) => {
          pushes += 1;
          expect(req.mutations.length).toBeLessThanOrEqual(500);
          const response = await base.push(req);
          if (pushes === 1) {
            const pushedId = String(req.mutations[9]!.record.id);
            at(S + 500);
            await repo.updateAsset(A, pushedId, { notes: 'A, during the push' });
            at(SERVER_NOW);
          }
          return response;
        },
      });
      expect(pushes).toBe(3);
      await settle([A, B]);

      const byId = async (device: SyncDb) =>
        new Map((await device.select().from(clientSchema.assets)).map((row) => [row.id, synced('assets', row)]));
      const serverRows = await pgDb.select().from(serverSchema.assets).where(eq(serverSchema.assets.userId, USER2));
      const server = new Map(serverRows.map((row) => [row.id, synced('assets', row)]));
      expect(server.size).toBe(n);
      expect(await byId(A)).toEqual(server);
      expect(await byId(B)).toEqual(server);
      for (const device of [A, B]) expect(await device.select().from(clientSchema.outbox)).toEqual([]);

      const duringPush = String(pushLog.find((entry) => entry.device === A)!.mutations[9]!.record.id);
      for (const [i, id] of ids.entries()) {
        const row = server.get(id)!;
        const notes = id === duringPush ? 'A, during the push' : i % 3 === 0 ? 'B' : 'A';
        expect(row).toMatchObject({ notes, isFavorite: true, deletedAt: i % 5 === 0 ? expect.any(Number) : null });
      }
    }, 120_000);
  });
});
