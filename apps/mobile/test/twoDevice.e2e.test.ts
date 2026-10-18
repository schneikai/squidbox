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
import { libraryPaths } from '../src/library/libraryPaths';
import { applyMerge, planMerge } from '../src/library/mergeLibrary';
import * as repo from '../src/sync/assetsRepository';
import type { RemoveFiles } from '../src/sync/assetsRepository';
import { clientCollectionTables } from '../src/sync/clientCollections';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { makeEdgeRepository } from '../src/sync/edgesRepository';
import { toModernChanges } from '../src/sync/legacyBase';
import { retryFailures } from '../src/sync/outbox';
import { makeRepository } from '../src/sync/repository';
import type { SyncTransport } from '../src/sync/transport';
import { upsertRows } from '../src/sync/upsertRows';
import { runSyncOnce } from '../src/sync/worker';
import changedValues from '../src/utils/changedValues';

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

const USER = '33333333-3333-3333-3333-333333333333';

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

    // B restores it while offline, after A purged it (B's clock is later).
    const removedOnA: string[] = [];
    await repo.purgeAssets(deviceA, [rec.id], async (files) => {
      removedOnA.push(
        ...files.flatMap((file) => [file.filename, file.thumbnailFilename]).filter((n) => n !== undefined),
      );
    });
    expect(removedOnA).toEqual(['p.jpg', 'p-t.jpg']);
    await new Promise((resolve) => setTimeout(resolve, 2));
    await repo.updateAllAssets(deviceB, [rec.id], { deletedAt: null });

    await runSyncOnce(deviceA, transport); // the purge; the server deletes its files after the push
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

    await repo.purgeAssets(deviceA, [rec.id], async () => {}); // A, offline
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
const USER2 = '55555555-5555-5555-5555-555555555555';
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
      const final = col.finalField;
      const purgeMissing = !!final && row?.[final] != null && !Object.is(row[final], record[final] ?? null);
      const where = `${mutation.collection} ${result.id}`;
      if (result.status === 'applied' && (lost.length > 0 || purgeMissing))
        violations.push(`${where}: applied, but lost ${lost}${purgeMissing ? ' (no purge)' : ''}`);
      if (result.status === 'skipped-lww') {
        if (lost.length === 0 && !purgeMissing) violations.push(`${where}: skipped-lww, but every pushed field holds`);
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
      .values({ id: USER2, email: 'fieldmerge@test.local', passwordDigest: 'x', storageBucket: null })
      .onConflictDoNothing();
  });
  afterAll(async () => {
    await clearServer();
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
        await edit(A, S + 200, () => repo.purgeAssets(A, [id], async () => {}));
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

    // deletedAt and purgedAt are one field group: a purge carries the deletion at its own clock, so
    // against a restore it hadn't seen the later of the two wins, like any write of one field.
    it('a purge and a restore it hadn’t seen: the later one wins', async () => {
      for (const purgeLater of [true, false]) {
        const id = await seedAsset();
        await edit(B, S + 100, () => repo.deleteAssets(B, [id]));
        await settle();
        await edit(B, purgeLater ? S + 200 : S + 400, () => repo.updateAllAssets(B, [id], { deletedAt: null }));
        await sync(B);
        await edit(A, S + 300, () => repo.purgeAssets(A, [id], async () => {}));
        await settle();
        expect(await expectConverged('assets', id)).toMatchObject(
          purgeLater ? { deletedAt: S + 100, purgedAt: S + 300 } : { deletedAt: null, purgedAt: null },
        );
      }
    });

    it('an offline delete and purge coalesced in one push go as one group, at the purge’s clock', async () => {
      const id = await seedAsset();
      await edit(B, S + 100, () => repo.deleteAssets(B, [id]));
      await sync(B);
      await edit(B, S + 300, () => repo.updateAllAssets(B, [id], { deletedAt: null }));
      await sync(B);
      await edit(A, S + 200, () => repo.deleteAssets(A, [id])); // A saw neither
      await edit(A, S + 400, () => repo.purgeAssets(A, [id], async () => {}));
      expect((await A.select().from(clientSchema.outbox))[0]!.fields).toEqual({
        deletedAt: S + 400,
        purgedAt: S + 400,
      });
      await settle();
      // Newer than the restore it hadn't seen, so it wins (an older one loses, as above).
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
      await edit(A, S + 200, () => repo.purgeAssets(A, [id], async () => {}));
      await sync(A);

      const removed: string[] = [];
      const removeFiles: RemoveFiles = async (files) => {
        removed.push(...files.flatMap((f) => (f.filename ? [f.filename] : [])));
      };
      at(SERVER_NOW);
      await runSyncOnce(B, { push: async (req) => refused(req), pull }, { removeFiles }); // pulls the purge
      expect(await localRow(B, 'assets', id)).toMatchObject({ purgedAt: S + 200 });
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
      await edit(A, S + 200, () => repo.purgeAssets(A, [id], async () => {}));
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
      await edit(A, S + 200, () => repo.purgeAssets(A, [id], async () => {}));
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
      await edit(A, S + 200, () => repo.purgeAssets(A, [id], async () => {}));
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
          await postEdges.setRefs(tx, postId, changes.assetRefs);
          await posts.update(tx, postId, toModernChanges(changes));
        });
      });
      await settle();
      expect(await expectConverged('posts', postId)).toMatchObject({ text: 'B rewrote it', postedAt: 12345 });
      const edges = (await B.select().from(clientSchema.postAssets)).filter((e) => e.deletedAt === null);
      expect(edges.map((e) => e.assetId).sort()).toEqual([asset1, asset2].sort());
    });

    it('a rename and an album notes edit from their seeds keep the other device’s fields', async () => {
      const id = await seedAlbum({ name: 'Trip', notes: null });
      const seed = (await localRow(A, 'albums', id))!;
      await edit(B, S + 100, () => albumRepo.update(B, id, { notes: 'B notes', isFavorite: true }));
      await sync(B);
      await sync(A);
      await edit(A, S + 200, async () => {
        const rename = changedValues({ name: seed.name }, { name: 'Summer trip' });
        await albumRepo.update(A, id, rename);
        // The notes modal opened before B's edit arrived and saved it unchanged: nothing to write.
        const notes = changedValues({ notes: (seed.notes ?? '') || null }, { notes: null });
        expect(notes).toEqual({});
      });
      await settle();
      expect(await expectConverged('albums', id)).toMatchObject({
        name: 'Summer trip',
        notes: 'B notes',
        isFavorite: true,
      });
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

    // BUG (mergeLibrary.ts replayed() + withDeletionPair): see mergeLibrary.test.ts. The device's
    // older purge replays with its old deletedAt under the account's newer restore clock, so the
    // server takes the stale delete, applies the purge, and the restore is lost on every device.
    it('a device purge older than the account’s pending restore loses to it everywhere', async () => {
      const id = await seedAsset();
      await edit(A, S + 50, () => repo.deleteAssets(A, [id]));
      await settle();
      const D = await deviceLibraryWith(id);
      await edit(D, S + 100, () => repo.purgeAssets(D, [id], async () => {}));
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
      await edit(B, S + 300, () => postEdges.setRefs(B, postId, [{ id: edgeId, assetId: asset }]));
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
