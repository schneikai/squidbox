import { afterAll, beforeAll, beforeEach, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PushMutation, PushResult } from '@squidbox/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, getTableColumns, inArray } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../../src/db/schema.js';
import { serverCollections } from '../../src/sync/collections.js';
import { push } from '../../src/sync/push.js';

type Db = ReturnType<typeof drizzle<typeof schema>>;
// Bound by useSyncDb's beforeAll: read them inside a test or hook, never in a describe body. The
// users are two of the file's own, so files beside each other on one Postgres never see or clear
// each other's rows, whether or not they share this module.
export let USER_A: string;
export let USER_B: string;
export let pool: pg.Pool;
export let db: Db;

/** Deletes these users' rows in every collection. */
export async function clearRows(users = [USER_A, USER_B]) {
  await Promise.all(
    Object.values(serverCollections).map(({ table }) =>
      db.delete(table).where(inArray(getTableColumns(table).userId!, users)),
    ),
  );
}

/** Opens the pool and adds the two users for the file, and empties their rows before each test. */
export function useSyncDb() {
  beforeAll(async () => {
    USER_A = randomUUID();
    USER_B = randomUUID();
    pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    db = drizzle(pool, { schema });
    await db.insert(schema.users).values([
      { id: USER_A, email: `sync-a-${USER_A}@test.local`, passwordDigest: 'x', storageBucket: null },
      { id: USER_B, email: `sync-b-${USER_B}@test.local`, passwordDigest: 'x', storageBucket: null },
    ]);
  });
  beforeEach(async () => {
    await clearRows();
  });
  afterAll(async () => {
    await clearRows();
    await db.delete(schema.users).where(inArray(schema.users.id, [USER_A, USER_B]));
    await pool.end();
  });
}

/**
 * An asset as a client without the optional columns (purgedAt, favoritedAt, takenAt,
 * originalFilename, latitude, longitude, tags) pushes it. A test adds purgedAt where it needs it.
 */
export function assetRecord(over: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null as number | null,
    mediaLibraryAssetId: 'm1',
    mediaType: 'photo',
    width: 100,
    height: 100,
    fileSize: 500,
    duration: null as number | null,
    filename: 'a.jpg',
    thumbnailFilename: 't.jpg',
    isFavorite: false,
    notes: null as string | null,
    oldFileId: null as string | null,
    isFileSynced: true,
    isThumbnailSynced: true,
    isSynced: true,
    ...over,
  };
}

/** An asset as a client that knows every column pushes it, the optional ones empty. */
export function fullAssetRecord(over: Record<string, unknown> = {}) {
  return assetRecord({
    purgedAt: null,
    favoritedAt: null,
    takenAt: null,
    originalFilename: null,
    latitude: null,
    longitude: null,
    tags: null,
    ...over,
  }) as Record<string, any> & { id: string; updatedAt: number };
}

export function postRecord(over: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null as number | null,
    text: 'hi',
    isFavorite: false,
    postedAt: null as number | null,
    rePostId: null as string | null,
    isIgnoredForRepost: false,
    suggestRepostAt: 1000,
    hasBeenReposted: false,
    ...over,
  };
}

export function albumRecord(over: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null as number | null,
    name: 'A',
    isFavorite: false,
    archivedAt: null,
    showInPostSuggestionsAfter: null,
    oldCollectionName: null,
    notes: null as string | null,
    sortOrder: null,
    smartAlbumType: null,
    position: null as string | null,
    ...over,
  };
}

/** A whole-record push of `record`. */
export const mut = (record: Record<string, unknown>, collection = 'assets'): PushMutation => ({
  collection,
  record: record as PushMutation['record'],
});

/** A push of `record` naming the fields it changed: each at `clock`, or the clocks of a map. */
export function fieldPush(
  record: Record<string, unknown>,
  fields: string[] | Record<string, number>,
  clock = record.updatedAt as number,
  collection = 'assets',
): PushMutation {
  const clocks = Array.isArray(fields) ? Object.fromEntries(fields.map((field) => [field, clock])) : fields;
  return { collection, record: record as PushMutation['record'], fields: clocks };
}

/** A user's stored row, every column. */
export async function rowOf(id: string, { user = USER_A, collection = 'assets' } = {}) {
  const table = serverCollections[collection]!.table as any;
  const [row] = await db
    .select()
    .from(table)
    .where(and(eq(table.userId, user), eq(table.id, id)));
  return row as Record<string, any> | undefined;
}

export async function serverSeqOf(user: string, id: string): Promise<number | null> {
  return ((await rowOf(id, { user }))?.serverSeq as number | undefined) ?? null;
}

/** Results as the wire carries them: JSON, where an undefined field reads as a missing one. */
export const wire = (results: PushResult[]) => results.map((result) => JSON.stringify(result));

/** `mutations` pushed for `user` in batches of `size`, one after the other. */
export async function inBatches(user: string, mutations: PushMutation[], size: number) {
  const results: PushResult[] = [];
  for (let i = 0; i < mutations.length; i += size)
    results.push(...(await push(db, user, mutations.slice(i, i + size))));
  return results;
}

/**
 * The same mutations pushed for USER_A in batches of `size` (all at once by default) and for USER_B
 * one by one.
 */
export async function batchedAndOneByOne(mutations: PushMutation[], size = mutations.length) {
  return { batched: await inBatches(USER_A, mutations, size), single: await inBatches(USER_B, mutations, 1) };
}

/**
 * A user's rows of a collection (only `ids`, when given) by id, without what differs between users by
 * construction (userId, serverSeq).
 */
export async function rowsOf(collection: string, user: string, ids?: string[]) {
  const table = serverCollections[collection]!.table as any;
  const ofUser = eq(table.userId, user);
  const where = ids
    ? and(
        ofUser,
        inArray(
          table.id,
          ids.map((id) => id.toLowerCase()),
        ),
      )
    : ofUser;
  const rows = (await db.select().from(table).where(where)) as Record<string, any>[];
  return new Map(rows.map(({ userId: _u, serverSeq: _s, ...row }) => [row.id as string, row]));
}

/** USER_A's and USER_B's rows of a collection (only `ids`, when given) hold the same. */
export async function expectSameRows(collection: string, ids?: string[]) {
  const mine = await rowsOf(collection, USER_A, ids);
  const twin = await rowsOf(collection, USER_B, ids);
  expect([...mine.keys()].sort(), collection).toEqual([...twin.keys()].sort());
  for (const [id, row] of mine)
    if (JSON.stringify(row) !== JSON.stringify(twin.get(id))) expect(row, `${collection} ${id}`).toEqual(twin.get(id));
}
