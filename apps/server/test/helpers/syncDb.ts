import { afterAll, beforeAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, getTableColumns, inArray } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../../src/db/schema.js';
import { serverCollections } from '../../src/sync/collections.js';

// Two users of their own per test file, so files running beside each other on one Postgres never
// see or clear each other's rows.
export const USER_A = randomUUID();
export const USER_B = randomUUID();

type Db = ReturnType<typeof drizzle<typeof schema>>;
// Bound in useSyncDb's beforeAll: read them inside a test or hook, never in a describe body.
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

export async function serverSeqOf(userId: string, id: string): Promise<number | null> {
  const [row] = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.userId, userId), eq(schema.assets.id, id)));
  return row ? (row.serverSeq as number | null) : null;
}
