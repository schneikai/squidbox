import { collectionsByName, type AssetRecord, type PushMutation, type PushResult } from '@squidbox/shared';
import { fakeClock } from '@squidbox/shared/testing/fakeClock';
import { and, eq } from 'drizzle-orm';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest';

import { makeAlbumRecord, makeAssetRecord } from './factory';
import { pushViolations } from './pushViolations';
import { makeTestDb } from './testDb';
import * as serverSchema from '../../../server/src/db/schema.js';
import { serverCollections } from '../../../server/src/sync/collections.js';
import { pull as serverPull } from '../../../server/src/sync/pull.js';
import { push as serverPush } from '../../../server/src/sync/push.js';
import * as repo from '../../src/sync/assetsRepository';
import { clientCollectionTables } from '../../src/sync/clientCollections';
import * as clientSchema from '../../src/sync/db/schema';
import type { SyncDb } from '../../src/sync/db/types';
import { retryFailures } from '../../src/sync/outbox';
import { makeRepository } from '../../src/sync/repository';
import type { RemoveFiles } from '../../src/sync/sweepPurgedFiles';
import type { SyncTransport } from '../../src/sync/transport';
import { runSyncOnce } from '../../src/sync/worker';

/*
 * The two-device world of the e2e tests: devices A and B run this app; C runs an app without
 * per-field merge (whole-record pushes: no `fields`, so the server merges the whole record at its
 * updatedAt), against the real server engine on Postgres. Date is faked so each edit gets the clock
 * the scenario names; the server's clock is SERVER_NOW unless a scenario sets it. Every push is
 * checked as it lands (pushViolations), and a test fails on what it found. Each e2e file calls
 * `useTwoDeviceServer()` once, inside its top describe. The user is one of its own per file, so a
 * file beside another (or another checkout's run on the same Postgres) can't see its rows.
 */
export const USER = randomUUID();
export const S = 1_800_000_000_000; // the clock's origin: device edits happen at S + offset
export const SERVER_NOW = S + 10_000_000; // after every edit, so nothing is clamped
export const HOUR = 3_600_000;

// Rebound for each test: read them inside a test or hook, never in a describe body.
export let pgDb: ReturnType<typeof pgDrizzle>;
export let A: SyncDb;
export let B: SyncDb;
export let C: SyncDb;
let pool: pg.Pool;

/** What the pushes broke (pushViolations), for the test that made them. */
export const violations: string[] = [];
export const pushLog: { device: SyncDb; mutations: PushMutation[]; results: PushResult[] }[] = [];
/** The devices that run the app without per-field merge. */
export const oldApps = new Set<SyncDb>();
export const albumRepo = makeRepository('albums', clientSchema.albums);
export const posts = makeRepository('posts', clientSchema.posts);

export const at = (t: number) => vi.setSystemTime(t);
const syncedKeys = (collection: string) =>
  Object.keys((collectionsByName[collection]!.schema as unknown as { shape: object }).shape);
/** The synced fields of a row, as the wire carries them. */
export const synced = (collection: string, row: Record<string, unknown> | undefined) =>
  row && Object.fromEntries(syncedKeys(collection).map((key) => [key, row[key] ?? null]));

export async function serverRaw(collection: string, id: string) {
  const table = serverCollections[collection]!.table as any;
  const [row] = await pgDb
    .select()
    .from(table)
    .where(and(eq(table.userId, USER), eq(table.id, id)));
  return row as Record<string, any> | undefined;
}
export async function serverRow(collection: string, id: string) {
  const { table, wireColumns } = serverCollections[collection]!;
  const [row] = await pgDb
    .select(wireColumns)
    .from(table)
    .where(and(eq((table as any).userId, USER), eq((table as any).id, id)));
  return row as Record<string, any> | undefined;
}
export async function localRow(device: SyncDb, collection: string, id: string) {
  const table = clientCollectionTables[collection] as any;
  const [row] = await device.select().from(table).where(eq(table.id, id));
  return row as Record<string, any> | undefined;
}

export function transportOf(device: SyncDb): SyncTransport {
  return {
    push: async (req) => {
      const mutations = oldApps.has(device) ? req.mutations.map(({ fields: _fields, ...m }) => m) : req.mutations;
      const results = await serverPush(pgDb as any, USER, mutations);
      violations.push(...(await pushViolations(mutations, results, serverRow)));
      pushLog.push({ device, mutations, results });
      return { results };
    },
    pull: (req) => serverPull(pgDb as any, USER, { cursor: req.cursor, limit: req.limit }),
  };
}
export async function sync(
  device: SyncDb,
  { now = SERVER_NOW, removeFiles }: { now?: number; removeFiles?: RemoveFiles } = {},
) {
  at(now);
  await runSyncOnce(device, transportOf(device), { removeFiles });
}
export async function settle(devices = [A, B, C], now = SERVER_NOW) {
  for (let i = 0; i < 3; i++) for (const device of devices) await sync(device, { now });
}
// A pull while the device's edits wait (its push is refused, then retried later), so the pull
// applies around the pending fields (§5).
export async function pullOnly(device: SyncDb, now = SERVER_NOW) {
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
    pull: (req) => serverPull(pgDb as any, USER, { cursor: req.cursor, limit: req.limit }),
  });
  await retryFailures(device);
}
export async function edit(device: SyncDb, t: number, write: () => Promise<unknown>) {
  at(t);
  await write();
}

// Every device and the server hold the same synced record, and nothing waits in an outbox.
export async function expectConverged(collection: string, id: string, devices = [A, B, C]) {
  const server = synced(collection, await serverRow(collection, id));
  expect(server).toBeDefined();
  for (const device of devices) {
    expect(synced(collection, await localRow(device, collection, id))).toEqual(server);
    expect(await device.select().from(clientSchema.outbox)).toEqual([]);
  }
  return server as Record<string, any>;
}

export async function seedAsset(over: Partial<AssetRecord> = {}) {
  at(S);
  const rec = await repo.create(A, makeAssetRecord({ createdAt: S, updatedAt: S, ...over }));
  await settle();
  return rec.id;
}
export async function seedAlbum(over: Record<string, unknown> = {}) {
  at(S);
  const rec = await albumRepo.create(A, makeAlbumRecord({ createdAt: S, updatedAt: S, ...over }));
  await settle();
  return rec.id;
}

export async function clearServer() {
  for (const table of [
    serverSchema.albumAssets,
    serverSchema.postAssets,
    serverSchema.posts,
    serverSchema.albums,
    serverSchema.assets,
  ])
    await pgDb.delete(table).where(eq(table.userId, USER));
}

/** An empty server, and devices A, B and C made anew, C an old app. */
export async function freshDevices() {
  await clearServer();
  A = makeTestDb();
  B = makeTestDb();
  C = makeTestDb();
  oldApps.clear();
  oldApps.add(C);
}

/** The pool and the user for the file, a fresh world for each test, and its pushes' violations checked. */
export function useTwoDeviceServer() {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    pgDb = pgDrizzle(pool, { schema: serverSchema });
    await pgDb
      .insert(serverSchema.users)
      .values({ id: USER, email: `fieldmerge-${USER}@test.local`, passwordDigest: 'x', storageBucket: null })
      .onConflictDoNothing();
  });
  afterAll(async () => {
    await clearServer();
    await pgDb.delete(serverSchema.users).where(eq(serverSchema.users.id, USER));
    await pool.end();
  });
  beforeEach(async () => {
    fakeClock();
    at(S);
    await freshDevices();
    violations.length = 0;
    pushLog.length = 0;
  });
  afterEach(() => {
    expect(violations).toEqual([]);
  });
}
