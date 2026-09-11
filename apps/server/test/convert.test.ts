import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../src/db/schema.js';
import { importLegacy } from '../src/convert/legacy.js';
import { pull } from '../src/sync/pull.js';

// Server-side legacy converter, against a real Postgres (docker). Run via `npm run test:db`.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER = '44444444-4444-4444-4444-444444444444';
// Real app ids are uuids (getNewItemId); the id columns are uuid, so use valid uuids here.
const A1 = randomUUID();
const A2 = randomUUID();
const AL1 = randomUUID();
const P1 = randomUUID();

const legacyAssets = {
  [A1]: {
    id: A1,
    mediaLibraryAssetId: 'm1',
    mediaType: 'image', // legacy → should become 'photo'
    width: 10,
    height: 10,
    fileSize: 100,
    duration: null,
    filename: 'a1.jpg',
    thumbnailFilename: 't1.jpg',
    isFileSynced: true,
    isThumbnailSynced: true,
    isSynced: true,
    syncError: null,
    isFavorite: false,
    isDeleted: false,
    createdAt: 1000,
    updatedAt: 1000,
    postHistory: [],
    lastPostedAt: null,
    oldFileId: null,
    notes: null,
  },
  [A2]: { id: A2, mediaLibraryAssetId: 'm2', mediaType: 'video', width: 1, height: 1, fileSize: 5, duration: 3, filename: 'a2.mp4', thumbnailFilename: 't2.jpg', isFileSynced: true, isThumbnailSynced: true, isSynced: true, syncError: null, isFavorite: true, isDeleted: true, createdAt: 900, updatedAt: 2000, postHistory: [], lastPostedAt: null, oldFileId: null, notes: null },
};
const legacyAlbums = {
  [AL1]: { id: AL1, name: 'Trip', assets: [A1], isFavorite: false, archivedAt: null, isDeleted: false, createdAt: 1000, updatedAt: 1000, postHistory: [], lastPostedAt: null, showInPostSuggestionsAfter: null, oldCollectionName: null, notes: null, sortOrder: null, smartAlbumType: null },
};
const legacyPosts = {
  [P1]: { id: P1, text: 'hi', assetRefs: [{ id: randomUUID(), assetId: A1 }], isFavorite: false, isDeleted: false, postedAt: null, createdAt: 1000, updatedAt: 1000, rePostId: null, isIgnoredForRepost: false, suggestRepostAt: 1000, hasBeenReposted: false },
};

d('legacy converter (server-side)', () => {
  let pool: pg.Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema });
    await db
      .insert(schema.users)
      .values({ id: USER, email: 'convert@test.local', passwordDigest: 'x', storageBucket: null })
      .onConflictDoNothing();
  });
  afterAll(async () => {
    for (const t of [schema.postAssets, schema.albumAssets, schema.posts, schema.albums, schema.assets]) await db.delete(t).where(eq((t as any).userId, USER));
    await pool.end();
  });
  beforeEach(async () => {
    for (const t of [schema.postAssets, schema.albumAssets, schema.posts, schema.albums, schema.assets]) await db.delete(t).where(eq((t as any).userId, USER));
  });

  it('imports all three collections with legacy→modern mapping', async () => {
    const results = await importLegacy(db, USER, { assets: legacyAssets, albums: legacyAlbums, posts: legacyPosts });
    expect(results.find((r) => r.collection === 'assets')).toMatchObject({ applied: 2, rejected: 0 });
    expect(results.find((r) => r.collection === 'albums')).toMatchObject({ applied: 1, rejected: 0 });
    expect(results.find((r) => r.collection === 'posts')).toMatchObject({ applied: 1, rejected: 0 });

    const page = await pull(db, USER, { cursor: 0 });
    const assets = page.changes.assets.records as any[];
    const a1 = assets.find((r) => r.id === A1);
    const a2 = assets.find((r) => r.id === A2);
    expect(a1.mediaType).toBe('photo'); // 'image' → 'photo'
    expect(a1.deletedAt).toBeNull();
    expect(a2.mediaType).toBe('video');
    expect(a2.deletedAt).toBe(2000); // isDeleted → deletedAt tombstone

    // Parents no longer carry membership arrays.
    expect(page.changes.albums.records[0]).toMatchObject({ id: AL1, name: 'Trip' });
    expect(page.changes.albums.records[0]).not.toHaveProperty('assets');
    expect(page.changes.posts.records[0]).toMatchObject({ id: P1, text: 'hi' });
    expect(page.changes.posts.records[0]).not.toHaveProperty('assetRefs');

    // Membership is now junction edges with a fractional position.
    const albumEdges = page.changes.album_assets.records as any[];
    expect(albumEdges).toHaveLength(1);
    expect(albumEdges[0]).toMatchObject({ albumId: AL1, assetId: A1 });
    expect(albumEdges[0].position).toBeTruthy();

    const postEdges = page.changes.post_assets.records as any[];
    expect(postEdges).toHaveLength(1);
    expect(postEdges[0]).toMatchObject({ postId: P1, assetId: A1 });
    expect(postEdges[0].position).toBeTruthy();
  });

  it('is idempotent (re-run is a no-op via LWW)', async () => {
    await importLegacy(db, USER, { assets: legacyAssets });
    const again = await importLegacy(db, USER, { assets: legacyAssets });
    // equal updatedAt → strict-> LWW skips; nothing re-applied
    expect(again.find((r) => r.collection === 'assets')).toMatchObject({ applied: 0, skipped: 2 });
    const page = await pull(db, USER, { cursor: 0 });
    expect(page.changes.assets.records).toHaveLength(2); // no duplicates
  });
});
