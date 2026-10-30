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

async function clearAll() {
  const users = [USER_A, USER_B];
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
    await clearAll();
  });
  afterAll(async () => {
    await clearAll();
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

export const mut = (record: Record<string, unknown>) => ({ collection: 'assets', record });

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

/**
 * The same mutations pushed for USER_A in batches of `size` (all at once by default) and for USER_B
 * one by one.
 */
export async function batchedAndOneByOne(mutations: PushMutation[], size = mutations.length) {
  const batched: PushResult[] = [];
  for (let i = 0; i < mutations.length; i += size)
    batched.push(...(await push(db, USER_A, mutations.slice(i, i + size))));
  const single: PushResult[] = [];
  for (const mutation of mutations) single.push(...(await push(db, USER_B, [mutation])));
  return { batched, single };
}

/** USER_A's and USER_B's rows hold the same, but for what differs between users by construction. */
export async function expectSameRows(collection: string, ids: string[]) {
  for (const id of ids) {
    const { userId: _a, serverSeq: _b, ...a } = (await rowOf(id.toLowerCase(), { user: USER_A, collection })) ?? {};
    const { userId: _c, serverSeq: _d, ...b } = (await rowOf(id.toLowerCase(), { user: USER_B, collection })) ?? {};
    expect(a, `${collection} ${id}`).toEqual(b);
  }
}
