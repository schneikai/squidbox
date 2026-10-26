import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import { collectionNames, keyBetween } from '@squidbox/shared';
import * as schema from '../src/db/schema.js';
import { serverCollections } from '../src/sync/collections.js';
import { push } from '../src/sync/push.js';
import { pull } from '../src/sync/pull.js';
import {
  cleanUpPurgedFiles,
  deletePurgedFiles,
  isPurgedFileKey,
  purgedFileCleanupsSettled,
} from '../src/sync/purgedFiles.js';

// DB-backed integration tests (advisory locks, trigger, ON CONFLICT) — require a real
// Postgres. Run with `npm run test:db` (points at the docker-compose stack); plain `npm test`
// skips them.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

type Db = ReturnType<typeof drizzle<typeof schema>>;
let pool: pg.Pool;
let db: Db;

function assetRecord(over: Record<string, unknown> = {}) {
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
function postRecord(over: Record<string, unknown> = {}) {
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
function albumRecord(over: Record<string, unknown> = {}) {
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
const mut = (record: Record<string, unknown>) => ({ collection: 'assets', record });

async function serverSeqOf(userId: string, id: string): Promise<number | null> {
  const [row] = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.userId, userId), eq(schema.assets.id, id)));
  return row ? (row.serverSeq as number | null) : null;
}

d('sync engine (Postgres)', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema });
    await db
      .insert(schema.users)
      .values([
        { id: USER_A, email: 'a-sync@test.local', passwordDigest: 'x', storageBucket: null },
        { id: USER_B, email: 'b-sync@test.local', passwordDigest: 'x', storageBucket: null },
      ])
      .onConflictDoNothing();
  });
  async function clearAll() {
    // Scope deletes to THIS test's users — vitest runs test files in parallel against the same
    // Postgres, so an unscoped delete would wipe other files' rows mid-test (a real race).
    const users = [USER_A, USER_B];
    await db.delete(schema.albumAssets).where(inArray(schema.albumAssets.userId, users));
    await db.delete(schema.postAssets).where(inArray(schema.postAssets.userId, users));
    await db.delete(schema.posts).where(inArray(schema.posts.userId, users));
    await db.delete(schema.albums).where(inArray(schema.albums.userId, users));
    await db.delete(schema.assets).where(inArray(schema.assets.userId, users));
  }
  afterAll(async () => {
    await clearAll();
    await pool.end();
  });
  beforeEach(async () => {
    await clearAll();
  });

  it('an update without an optional column keeps its stored value (older clients)', async () => {
    const album = {
      id: randomUUID(),
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
      name: 'Shots',
      isFavorite: false,
      archivedAt: null,
      showInPostSuggestionsAfter: null,
      oldCollectionName: null,
      notes: null,
      sortOrder: null,
      smartAlbumType: null,
      position: 'a0',
    };
    const stored = async () =>
      (
        await db
          .select()
          .from(schema.albums)
          .where(and(eq(schema.albums.userId, USER_A), eq(schema.albums.id, album.id)))
      )[0];
    await push(db as any, USER_A, [{ collection: 'albums', record: album }]);

    const { position: _position, ...withoutPosition } = album; // what an app without `position` sends
    const renamed = { ...withoutPosition, name: 'Renamed', updatedAt: 2000 };
    await push(db as any, USER_A, [{ collection: 'albums', record: renamed }]);
    expect(await stored()).toMatchObject({ name: 'Renamed', position: 'a0' });

    await push(db as any, USER_A, [{ collection: 'albums', record: { ...album, position: null, updatedAt: 3000 } }]);
    expect((await stored())?.position).toBeNull();
  });

  it('a whole-record push stamps each field it carries with its clock; the others keep theirs', async () => {
    const album = albumRecord({ position: 'a0' });
    const clocks = async () =>
      (await pool.query('SELECT field_clock FROM albums WHERE user_id = $1 AND id = $2', [USER_A, album.id])).rows[0]
        .field_clock;
    await push(db, USER_A, [{ collection: 'albums', record: album }]);
    expect(await clocks()).toBeNull(); // every clock is the row's updated_at: none stored

    const { position: _position, ...withoutPosition } = album; // an app without `position`
    await push(db, USER_A, [{ collection: 'albums', record: { ...withoutPosition, name: 'B', updatedAt: 2000 } }]);
    expect(await clocks()).toMatchObject({ name: 2000, position: 1000 });
    expect(await clocks()).not.toHaveProperty('updatedAt');

    // A row written before per-field merge has no clocks: each field's is its updated_at.
    await pool.query('UPDATE albums SET field_clock = NULL WHERE user_id = $1 AND id = $2', [USER_A, album.id]);
    await push(db, USER_A, [{ collection: 'albums', record: { ...withoutPosition, name: 'C', updatedAt: 3000 } }]);
    expect(await clocks()).toMatchObject({ name: 3000, position: 2000 });

    const { changes } = await pull(db, USER_A, { cursor: 0 });
    expect(changes.albums.records[0]).toMatchObject({ name: 'C', position: 'a0' });
    expect(changes.albums.records[0]).not.toHaveProperty('fieldClock'); // server-only
  });

  it('a persona from an older build that still sends useEmoji is applied without it', async () => {
    const id = randomUUID();
    const persona = {
      id,
      createdAt: 1000,
      updatedAt: 1000,
      deletedAt: null,
      aboutYou: 'Me.',
      contentTags: [],
      tone: '',
      rules: [],
    };
    const [result] = await push(db, USER_A, [
      { collection: 'personas', record: { ...persona, useEmoji: true }, fields: { aboutYou: 1000, useEmoji: 1000 } },
    ]);
    expect(result.status).toBe('applied');
    const { changes } = await pull(db, USER_A, { cursor: 0 });
    const pulled = changes.personas.records.find((record) => record.id === id);
    expect(pulled).toMatchObject({ aboutYou: 'Me.' });
    expect(pulled).not.toHaveProperty('useEmoji');
    await pool.query('DELETE FROM personas WHERE user_id = $1 AND id = $2', [USER_A, id]);
  });

  it('an unknown collection, Object.prototype’s names included, is rejected per mutation', async () => {
    const album = albumRecord();
    const results = await push(db as any, USER_A, [
      ...['constructor', '__proto__', 'toString', 'nope'].map((collection) => ({ collection, record: album })),
      { collection: 'albums', record: album },
    ]);
    expect(results.map((result) => result.reason ?? result.status)).toEqual([
      'unknown-collection',
      'unknown-collection',
      'unknown-collection',
      'unknown-collection',
      'applied',
    ]);
  });

  it('pull window + tombstone delivery', async () => {
    const r1 = assetRecord();
    const r2 = assetRecord();
    const res = await push(db, USER_A, [mut(r1), mut(r2)]);
    expect(res.map((r) => r.status)).toEqual(['applied', 'applied']);

    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records.map((r: any) => r.id).sort()).toEqual([r1.id, r2.id].sort());
    expect(page.hasMore).toBe(false);

    // nothing new after the cursor
    const empty = await pull(db, USER_A, { cursor: page.cursor });
    expect(empty.changes.assets.records).toHaveLength(0);

    // delete r1 (tombstone) → flows through pull with deletedAt set
    await push(db, USER_A, [mut({ ...r1, updatedAt: 2000, deletedAt: 2000 })]);
    const afterDelete = await pull(db, USER_A, { cursor: page.cursor });
    expect(afterDelete.changes.assets.records).toHaveLength(1);
    expect(afterDelete.changes.assets.records[0]).toMatchObject({ id: r1.id, deletedAt: 2000 });
  });

  it('album_assets: a concurrent add and reorder both survive (no membership loss)', async () => {
    const albumId = randomUUID();
    const [a1, a2, a3, a4] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const edge = (assetId: string, position: string, over: Record<string, unknown> = {}) => ({
      collection: 'album_assets',
      record: {
        id: randomUUID(),
        createdAt: 1000,
        updatedAt: 1000,
        deletedAt: null,
        albumId,
        assetId,
        position,
        ...over,
      },
    });

    // Initial membership [a1, a2, a3].
    const e1 = edge(a1, 'a');
    const e2 = edge(a2, 'b');
    const e3 = edge(a3, 'c');
    await push(db, USER_A, [e1, e2, e3]);

    // Device A adds a4 (new edge row). Device B reorders a3 to the front (updates only e3.position).
    // These touch DIFFERENT rows, so whole-record LWW can't clobber either.
    const e4 = edge(a4, keyBetween('c', null), { updatedAt: 1100 });
    await push(db, USER_A, [e4]);
    await push(db, USER_A, [{ ...e3, record: { ...e3.record, position: keyBetween(null, 'a'), updatedAt: 1200 } }]);

    const page = await pull(db, USER_A, { cursor: 0 });
    const edges = page.changes.album_assets.records as any[];
    const byAsset = Object.fromEntries(edges.map((e) => [e.assetId, e]));
    expect(edges).toHaveLength(4); // a4 add survived
    expect(byAsset[a4]).toBeTruthy();
    // a3 moved to the front (its new position sorts before a1's).
    expect(byAsset[a3].position < byAsset[a1].position).toBe(true);
    const order = edges.sort((x, y) => (x.position < y.position ? -1 : 1)).map((e) => e.assetId);
    expect(order).toEqual([a3, a1, a2, a4]);
  });

  it('LWW: newer wins, older is skipped with the winning current', async () => {
    const r = assetRecord({ updatedAt: 2000, notes: 'new' });
    expect((await push(db, USER_A, [mut(r)]))[0].status).toBe('applied');

    const older = await push(db, USER_A, [mut({ ...r, updatedAt: 1500, notes: 'old' })]);
    expect(older[0].status).toBe('skipped-lww');
    expect(older[0].current).toMatchObject({ id: r.id, updatedAt: 2000, notes: 'new' });

    const newer = await push(db, USER_A, [mut({ ...r, updatedAt: 3000, notes: 'newest' })]);
    expect(newer[0].status).toBe('applied');
  });

  it('a purge is final: it beats a newer edit in the Deleted album, and no later version applies', async () => {
    const r = assetRecord({ updatedAt: 2000, deletedAt: 2000 });
    await push(db, USER_A, [mut(r)]);
    await push(db, USER_A, [mut({ ...r, updatedAt: 4000, notes: 'edited in the Deleted album' })]);

    // The purge was made before that edit, on a device that hadn't seen it: it still applies, and
    // the edit's newer notes stay, so the push reports the merged record.
    const purged = { ...r, updatedAt: 3000, purgedAt: 3000 };
    expect((await push(db, USER_A, [mut(purged)]))[0]).toMatchObject({
      status: 'skipped-lww',
      current: { purgedAt: 3000, notes: 'edited in the Deleted album' },
    });

    // A stale device's newer restore, an older app that doesn't send purgedAt, or a newer purge: none applies.
    const restore = await push(db, USER_A, [mut({ ...r, updatedAt: 9000, deletedAt: null, purgedAt: null })]);
    expect(restore[0]).toMatchObject({ status: 'skipped-lww', current: { purgedAt: 3000, deletedAt: 2000 } });
    const olderApp = { ...r, updatedAt: 9001, deletedAt: null }; // no purgedAt key at all
    expect((await push(db, USER_A, [mut(olderApp)]))[0].status).toBe('skipped-lww');
    expect((await push(db, USER_A, [mut({ ...purged, updatedAt: 9002, isFileSynced: false })]))[0].status).toBe(
      'skipped-lww',
    );

    const { changes } = await pull(db, USER_A, { cursor: 0, limit: 100 });
    expect(changes.assets.records).toEqual([expect.objectContaining({ id: r.id, purgedAt: 3000, isFileSynced: true })]);
    expect(changes.assets.records[0]).not.toHaveProperty('filesDeletedAt'); // server-only
  });

  it('an offline device’s purge loses to a newer restore made on another device', async () => {
    const r = assetRecord({ updatedAt: 2000, deletedAt: 2000 });
    await push(db, USER_A, [mut(r)]);
    await push(db, USER_A, [mut({ ...r, updatedAt: 4000, deletedAt: null })]); // restored on device B

    const purge = await push(db, USER_A, [mut({ ...r, updatedAt: 3000, purgedAt: 3000 })]); // device A, offline
    expect(purge[0]).toMatchObject({ status: 'skipped-lww', current: { deletedAt: null, purgedAt: null } });

    // Once it's in the Deleted album again, a purge applies, even one older than that delete (whose
    // newer deletedAt stays).
    await push(db, USER_A, [mut({ ...r, updatedAt: 5000, deletedAt: 5000 })]);
    expect((await push(db, USER_A, [mut({ ...r, updatedAt: 3000, purgedAt: 3000 })]))[0]).toMatchObject({
      status: 'skipped-lww',
      current: { purgedAt: 3000, deletedAt: 5000 },
    });
  });

  describe('S3 files of purged assets', () => {
    let deleted: string[][] = [];
    let failing = new Set<string>();
    const deleteKeys = async (keys: string[]) => {
      deleted.push(keys);
      return keys.filter((key) => failing.has(key));
    };
    beforeEach(() => {
      deleted = [];
      failing = new Set();
    });
    const stored = async (id: string) =>
      (
        await db
          .select()
          .from(schema.assets)
          .where(and(eq(schema.assets.userId, USER_A), eq(schema.assets.id, id)))
      )[0];
    const purgedAsset = (over: Record<string, unknown>) => assetRecord({ purgedAt: 1000, deletedAt: 1000, ...over });

    it('are deleted once, whatever the file flags say, keeping a key a live asset names', async () => {
      // A device's upload finished but its flags weren't pushed before the purge: all false here.
      const unflagged = { isFileSynced: false, isThumbnailSynced: false, isSynced: false };
      const r = assetRecord({ filename: 'p.jpg', thumbnailFilename: 'p-t.jpg', deletedAt: 1000, ...unflagged });
      await push(db, USER_A, [mut(r)]);
      const shared = assetRecord({ filename: 'p.jpg', thumbnailFilename: 'other-t.jpg' }); // a live asset, same file
      const untouched = purgedAsset({ filename: 'b.jpg', thumbnailFilename: 'b-t.jpg' });
      await push(db, USER_A, [mut(shared)]);
      await push(db, USER_B, [mut(untouched)]); // another user's purge isn't this user's work
      const { cursor } = await pull(db, USER_A, { cursor: 0, limit: 100 });
      await push(db, USER_A, [mut({ ...r, updatedAt: 2000, purgedAt: 2000 })]);

      await deletePurgedFiles(db, USER_A, deleteKeys);

      expect(deleted).toEqual([['p-t.jpg']]);
      expect(await stored(r.id)).toMatchObject({ ...unflagged, updatedAt: 2000, filesDeletedAt: expect.any(Number) });
      const { changes } = await pull(db, USER_A, { cursor, limit: 100 });
      expect(changes.assets.records).toEqual([expect.objectContaining({ id: r.id, purgedAt: 2000 })]);

      await deletePurgedFiles(db, USER_A, deleteKeys);
      expect(deleted).toHaveLength(1); // done for good
    });

    it('stay to do when the request fails, so the next cleanup retries them', async () => {
      const r = purgedAsset({});
      await push(db, USER_A, [mut(r)]);
      const failure = new Error('S3 down');
      await expect(deletePurgedFiles(db, USER_A, async () => Promise.reject(failure))).rejects.toBe(failure);
      expect((await stored(r.id))!.filesDeletedAt).toBeNull();
      await deletePurgedFiles(db, USER_A, deleteKeys);
      expect(deleted).toEqual([['a.jpg', 't.jpg']]);
    });

    it('a key that fails, or can’t be a key, holds up no other asset', async () => {
      const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
      const failingAsset = purgedAsset({ id: ids[0], filename: 'bad.jpg', thumbnailFilename: 'bad-t.jpg' });
      const ok = purgedAsset({ id: ids[1], filename: 'ok.jpg', thumbnailFilename: 'ok-t.jpg' });
      const invalid = purgedAsset({ filename: '../x.jpg', thumbnailFilename: '' });
      await push(db, USER_A, [mut(failingAsset), mut(ok), mut(invalid)]);
      failing = new Set(['bad.jpg']);

      await deletePurgedFiles(db, USER_A, deleteKeys);

      expect(deleted).toEqual([['bad.jpg', 'bad-t.jpg', 'ok.jpg', 'ok-t.jpg']]); // id order, the invalid keys skipped
      expect((await stored(failingAsset.id))!.filesDeletedAt).toBeNull();
      expect((await stored(ok.id))!.filesDeletedAt).not.toBeNull();
      expect((await stored(invalid.id))!.filesDeletedAt).not.toBeNull();

      failing = new Set();
      await deletePurgedFiles(db, USER_A, deleteKeys);
      expect(deleted[1]).toEqual(['bad.jpg', 'bad-t.jpg']);
      expect((await stored(failingAsset.id))!.filesDeletedAt).not.toBeNull();
    });

    it('run one at a time per user after the push, a push meanwhile asking for one more pass', async () => {
      await push(db, USER_A, [mut(purgedAsset({ filename: 'first.jpg', thumbnailFilename: 'first-t.jpg' }))]);
      let running = 0;
      let overlapped = false;
      const errors: unknown[] = [];
      const slowDelete = async (keys: string[]) => {
        overlapped ||= running > 0;
        running += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        running -= 1;
        return deleteKeys(keys);
      };

      cleanUpPurgedFiles(db, USER_A, slowDelete, (error) => errors.push(error));
      await new Promise((resolve) => setTimeout(resolve, 5));
      await push(db, USER_A, [mut(purgedAsset({ filename: 'second.jpg', thumbnailFilename: 'second-t.jpg' }))]);
      cleanUpPurgedFiles(db, USER_A, slowDelete, (error) => errors.push(error));
      cleanUpPurgedFiles(db, USER_A, slowDelete, (error) => errors.push(error));
      await purgedFileCleanupsSettled();

      expect(overlapped).toBe(false);
      expect(deleted.flat().sort()).toEqual(['first-t.jpg', 'first.jpg', 'second-t.jpg', 'second.jpg']);
      expect(errors).toEqual([]);

      await push(db, USER_A, [mut(purgedAsset({ filename: 'third.jpg' }))]);
      const failure = new Error('S3 down');
      cleanUpPurgedFiles(
        db,
        USER_A,
        async () => Promise.reject(failure),
        (error) => errors.push(error),
      );
      await purgedFileCleanupsSettled();
      expect(errors).toEqual([failure]); // logged, not thrown into the push
    });

    it('a key is purged when every asset naming it is', async () => {
      await push(db, USER_A, [mut(purgedAsset({ filename: 'gone.jpg' }))]);
      await push(db, USER_A, [mut(assetRecord({ filename: 'kept.jpg', thumbnailFilename: 'gone.jpg' }))]);
      await push(db, USER_A, [mut(purgedAsset({ filename: 'only.jpg' }))]);
      expect(await isPurgedFileKey(db, USER_A, 'gone.jpg')).toBe(false); // a live asset still names it
      expect(await isPurgedFileKey(db, USER_A, 'only.jpg')).toBe(true);
      expect(await isPurgedFileKey(db, USER_A, 'new.jpg')).toBe(false); // its record isn't pushed yet
      expect(await isPurgedFileKey(db, USER_B, 'only.jpg')).toBe(false);
    });
  });

  describe('per-field merge', () => {
    // A push of `record` that names the fields it changed, all at the record's clock.
    const edit = (record: Record<string, unknown>, fields: string[], collection = 'assets') => ({
      collection,
      record,
      fields: Object.fromEntries(fields.map((field) => [field, record.updatedAt as number])),
    });
    const stored = async (id: string) =>
      (
        await db
          .select()
          .from(schema.assets)
          .where(and(eq(schema.assets.userId, USER_A), eq(schema.assets.id, id)))
      )[0]!;

    it('edits of different fields both survive, whichever is pushed last', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      const newer = edit({ ...r, updatedAt: 3000, notes: 'from the phone' }, ['notes']);
      const older = edit({ ...r, updatedAt: 2000, isFavorite: true }, ['isFavorite']);
      expect((await push(db, USER_A, [newer]))[0].status).toBe('applied');
      expect((await push(db, USER_A, [older]))[0].status).toBe('applied');
      expect(await stored(r.id)).toMatchObject({ notes: 'from the phone', isFavorite: true, updatedAt: 3000 });
      expect((await stored(r.id)).fieldClock).toMatchObject({ notes: 3000, isFavorite: 2000, filename: 1000 });
    });

    it('an older edit of the same field is skipped with the merged record as current', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [edit({ ...r, updatedAt: 3000, notes: 'newer' }, ['notes'])]);
      const [result] = await push(db, USER_A, [edit({ ...r, updatedAt: 2000, notes: 'older' }, ['notes'])]);
      expect(result).toMatchObject({ status: 'skipped-lww', current: { notes: 'newer', updatedAt: 3000 } });
      expect(result.current).not.toHaveProperty('fieldClock');
    });

    it('a partial win applies its newer field, re-stamps server_seq and returns the merged record', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [edit({ ...r, updatedAt: 3000, notes: 'newer' }, ['notes'])]);
      const seq = await serverSeqOf(USER_A, r.id);
      const [result] = await push(db, USER_A, [
        edit({ ...r, updatedAt: 2000, notes: 'older', isFavorite: true }, ['notes', 'isFavorite']),
      ]);
      expect(result).toMatchObject({ status: 'skipped-lww', current: { notes: 'newer', isFavorite: true } });
      expect(await serverSeqOf(USER_A, r.id)).toBeGreaterThan(seq!);
    });

    it('a replay is applied and changes nothing, not even server_seq', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      const favorite = edit({ ...r, updatedAt: 2000, isFavorite: true }, ['isFavorite']);
      await push(db, USER_A, [favorite]);
      const seq = await serverSeqOf(USER_A, r.id);
      expect((await push(db, USER_A, [favorite]))[0].status).toBe('applied');
      expect(await serverSeqOf(USER_A, r.id)).toBe(seq);
    });

    it('an edit of another field doesn’t undelete; a newer restore does', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [edit({ ...r, updatedAt: 2000, deletedAt: 2000 }, ['deletedAt'])]);
      const [notes] = await push(db, USER_A, [edit({ ...r, updatedAt: 3000, notes: 'still here?' }, ['notes'])]);
      expect(notes.status).toBe('applied');
      expect(await stored(r.id)).toMatchObject({ deletedAt: 2000, notes: 'still here?' });

      await push(db, USER_A, [edit({ ...r, updatedAt: 4000, deletedAt: null }, ['deletedAt'])]);
      expect(await stored(r.id)).toMatchObject({ deletedAt: null, notes: 'still here?' });
    });

    it('a purge loses to a newer restore, beats a newer edit in the Deleted album, and is final', async () => {
      const r = assetRecord({ deletedAt: 1000 });
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [edit({ ...r, updatedAt: 3000, deletedAt: null }, ['deletedAt'])]); // restored
      const purge = edit({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['purgedAt']);
      expect((await push(db, USER_A, [purge]))[0]).toMatchObject({
        status: 'skipped-lww',
        current: { deletedAt: null, purgedAt: null },
      });

      await push(db, USER_A, [edit({ ...r, updatedAt: 4000, deletedAt: 4000 }, ['deletedAt'])]); // deleted again
      await push(db, USER_A, [edit({ ...r, updatedAt: 5000, deletedAt: 4000, notes: 'n' }, ['notes'])]);
      const laterPurge = edit({ ...r, updatedAt: 4500, deletedAt: 4000, purgedAt: 4500 }, ['purgedAt']);
      expect((await push(db, USER_A, [laterPurge]))[0].status).toBe('applied');

      const seq = await serverSeqOf(USER_A, r.id);
      const [restore] = await push(db, USER_A, [edit({ ...r, updatedAt: 9000, deletedAt: null }, ['deletedAt'])]);
      expect(restore).toMatchObject({ status: 'skipped-lww', current: { deletedAt: 4000, purgedAt: 4500 } });
      expect(await serverSeqOf(USER_A, r.id)).toBe(seq);
    });

    it('a purge applies over a newer whole-record edit in the Deleted album, which stamped every field', async () => {
      const r = assetRecord({ deletedAt: 1000, purgedAt: null });
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [mut({ ...r, updatedAt: 3000, notes: 'from the old app' })]);
      const purge = edit({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['purgedAt']);
      expect((await push(db, USER_A, [purge]))[0].status).toBe('applied');
      expect(await stored(r.id)).toMatchObject({ purgedAt: 2000, notes: 'from the old app', updatedAt: 3000 });
    });

    it('a row written before per-field merge takes its updated_at as every field’s clock', async () => {
      const r = assetRecord({ updatedAt: 2000 });
      await push(db, USER_A, [mut(r)]);
      await pool.query('UPDATE assets SET field_clock = NULL WHERE user_id = $1 AND id = $2', [USER_A, r.id]);
      const [older] = await push(db, USER_A, [edit({ ...r, updatedAt: 1500, notes: 'older' }, ['notes'])]);
      expect(older.status).toBe('skipped-lww');
      const [newer] = await push(db, USER_A, [edit({ ...r, updatedAt: 2500, notes: 'newer' }, ['notes'])]);
      expect(newer.status).toBe('applied');
      expect((await stored(r.id)).fieldClock).toMatchObject({ notes: 2500, isFavorite: 2000 });
    });

    it('drops fields that aren’t merge fields the record carries, and merges the rest', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      const { position: _position, ...withoutPosition } = albumRecord(); // an optional field
      const res = await push(db, USER_A, [
        {
          collection: 'assets',
          record: { ...r, updatedAt: 2000, notes: 'n' },
          fields: { updatedAt: 2000, syncError: 2000, bogus: 2000, notes: 2000 },
        },
        { collection: 'albums', record: withoutPosition, fields: { position: 1000 } },
      ]);
      expect(res.map((x) => x.status)).toEqual(['applied', 'applied']);
      expect(await stored(r.id)).toMatchObject({ notes: 'n' });
    });

    it('a field group sent in part merges whole, at its newest clock', async () => {
      const r = assetRecord({ isFileSynced: false, isThumbnailSynced: false, isSynced: false });
      await push(db, USER_A, [mut(r)]);
      // Another device marked the thumbnail later; this push names only isFileSynced, with stale others.
      await push(db, USER_A, [edit({ ...r, updatedAt: 3000, isThumbnailSynced: true }, ['isThumbnailSynced'])]);
      const stale = { ...r, updatedAt: 2000, isFileSynced: true };
      const [result] = await push(db, USER_A, [
        { collection: 'assets', record: stale, fields: { isFileSynced: 2000 } },
      ]);
      expect(result.status).toBe('skipped-lww');
      expect(await stored(r.id)).toMatchObject({ isFileSynced: false, isThumbnailSynced: true, isSynced: false });
      expect((await stored(r.id)).fieldClock).toMatchObject({ isFileSynced: 3000, isThumbnailSynced: 3000 });
    });

    it('a field without a stored clock takes the row’s updated_at, and keeps it once the row moves on', async () => {
      const r = assetRecord({ updatedAt: 2000 });
      await push(db, USER_A, [mut(r)]);
      await pool.query(`UPDATE assets SET field_clock = '{"notes": 2000}' WHERE user_id = $1 AND id = $2`, [
        USER_A,
        r.id,
      ]);
      const [older] = await push(db, USER_A, [edit({ ...r, updatedAt: 1500, isFavorite: true }, ['isFavorite'])]);
      expect(older.status).toBe('skipped-lww');
      await push(db, USER_A, [edit({ ...r, updatedAt: 5000, notes: 'n' }, ['notes'])]);
      expect((await stored(r.id)).fieldClock).toMatchObject({ notes: 5000, isFavorite: 2000 });
    });

    it('a restore beats a purge that hadn’t seen it, whatever the purge’s clock, and isn’t re-deleted', async () => {
      const r = { ...assetRecord({ deletedAt: 1000 }), purgedAt: null as number | null };
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [edit({ ...r, updatedAt: 3000, deletedAt: null }, ['deletedAt', 'purgedAt'])]);
      const seq = await serverSeqOf(USER_A, r.id);
      // Made later than the restore, on a device that only saw the deletion at 1000.
      const purge = edit({ ...r, updatedAt: 5000, purgedAt: 5000 }, ['deletedAt', 'purgedAt']);
      expect((await push(db, USER_A, [purge]))[0]).toMatchObject({
        status: 'skipped-lww',
        current: { deletedAt: null, purgedAt: null },
      });
      expect(await serverSeqOf(USER_A, r.id)).toBe(seq);
      // A deletion after the restore, then a purge of it, applies.
      const deletion = { ...r, updatedAt: 6000, deletedAt: 6000 };
      await push(db, USER_A, [edit(deletion, ['deletedAt', 'purgedAt'])]);
      const purgeAgain = edit({ ...deletion, updatedAt: 7000, purgedAt: 7000 }, ['deletedAt', 'purgedAt']);
      expect((await push(db, USER_A, [purgeAgain]))[0].status).toBe('applied');
    });

    it('an offline deletion and purge of a row the server never saw deleted apply together', async () => {
      const r = { ...assetRecord(), purgedAt: null as number | null };
      await push(db, USER_A, [mut(r)]);
      const gone = { ...r, updatedAt: 3000, deletedAt: 2000, purgedAt: 3000 };
      expect((await push(db, USER_A, [edit(gone, ['deletedAt', 'purgedAt'])]))[0].status).toBe('applied');
      expect(await stored(r.id)).toMatchObject({ deletedAt: 2000, purgedAt: 3000 });
    });

    it('a push to a purged asset that doesn’t have the purge is skipped with it, even if every sent field holds', async () => {
      const r = { ...assetRecord({ deletedAt: 1000 }), purgedAt: null as number | null };
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [edit({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['deletedAt', 'purgedAt'])]);
      // A device whose deletion the server already has, pushing it again without the purge.
      const [again] = await push(db, USER_A, [edit({ ...r, updatedAt: 1000 }, ['notes'])]);
      expect(again).toMatchObject({ status: 'skipped-lww', current: { purgedAt: 2000 } });
      const { purgedAt: _purgedAt, ...olderApp } = r; // an app that doesn't know purges
      expect((await push(db, USER_A, [mut(olderApp)]))[0]).toMatchObject({ status: 'skipped-lww' });
      const purge = edit({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['deletedAt', 'purgedAt']);
      expect((await push(db, USER_A, [purge]))[0].status).toBe('applied'); // the purge's own replay
    });

    it('a bad field clock rejects its mutation alone', async () => {
      const [good, bad] = [assetRecord(), assetRecord()];
      const res = await push(db, USER_A, [mut(good), { collection: 'assets', record: bad, fields: { notes: 1.5 } }]);
      expect(res.map((r) => r.reason ?? r.status)).toEqual(['applied', 'schema:fields']);
    });

    it('a row written since by a server without clocks (a rollback) takes its updated_at for every field', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [edit({ ...r, updatedAt: 2000, notes: 'n' }, ['notes'])]);
      // An older server writes a whole record at 5000 and leaves field_clock as it was.
      await pool.query(`UPDATE assets SET updated_at = 5000, is_favorite = true WHERE user_id = $1 AND id = $2`, [
        USER_A,
        r.id,
      ]);
      const [older] = await push(db, USER_A, [edit({ ...r, updatedAt: 4000, isFavorite: false }, ['isFavorite'])]);
      expect(older).toMatchObject({ status: 'skipped-lww', current: { isFavorite: true } });
      const [newer] = await push(db, USER_A, [edit({ ...r, updatedAt: 6000, notes: 'm' }, ['notes'])]);
      expect(newer.status).toBe('applied');
      expect((await stored(r.id)).fieldClock).toMatchObject({ notes: 6000, isFavorite: 5000 });
    });

    it('clamps a future field clock to server time', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      const future = Date.now() + 3_600_000;
      await push(db, USER_A, [edit({ ...r, updatedAt: future, notes: 'ahead' }, ['notes'])]);
      const row = await stored(r.id);
      expect(row.notes).toBe('ahead');
      expect(row.updatedAt).toBeLessThan(future);
      expect(row.fieldClock!.notes).toBe(row.updatedAt);
    });
  });

  describe('per-field merge, adversarial', () => {
    const edit = (record: Record<string, unknown>, fields: Record<string, number>, collection = 'assets') => ({
      collection,
      record,
      fields,
    });
    const at = (record: Record<string, unknown>, clock: number, fields: string[], collection = 'assets') =>
      edit(record, Object.fromEntries(fields.map((field) => [field, clock])), collection);
    const raw = async (id: string) =>
      (
        await db
          .select()
          .from(schema.assets)
          .where(and(eq(schema.assets.userId, USER_A), eq(schema.assets.id, id)))
      )[0]!;

    it('an old app’s whole-record push between per-field pushes: its newer field wins, its stale ones lose, current is merged', async () => {
      const r = assetRecord({ notes: 'orig' });
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [at({ ...r, updatedAt: 3000, notes: 'new app' }, 3000, ['notes'])]);
      const [old] = await push(db, USER_A, [mut({ ...r, updatedAt: 2000, isFavorite: true })]); // stale notes
      expect(old).toMatchObject({
        status: 'skipped-lww',
        current: { notes: 'new app', isFavorite: true, updatedAt: 3000 },
      });
      expect((await raw(r.id)).fieldClock).toMatchObject({
        notes: 3000,
        isFavorite: 2000,
        filename: 2000,
        deletedAt: 2000,
      });

      // A per-field push older than the old app's stamp loses on a field the old app never changed.
      const [late] = await push(db, USER_A, [at({ ...r, updatedAt: 1500, filename: 'b.jpg' }, 1500, ['filename'])]);
      expect(late).toMatchObject({ status: 'skipped-lww', current: { filename: 'a.jpg' } });
      // A newer one wins on it.
      expect(
        (await push(db, USER_A, [at({ ...r, updatedAt: 2500, filename: 'b.jpg' }, 2500, ['filename'])]))[0].status,
      ).toBe('applied');
      expect(await raw(r.id)).toMatchObject({ notes: 'new app', isFavorite: true, filename: 'b.jpg', updatedAt: 3000 });
    });

    it('a push that loses everything leaves the row and its server_seq alone', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut({ ...r, updatedAt: 3000 })]);
      const before = await raw(r.id);
      const [result] = await push(db, USER_A, [
        at({ ...r, updatedAt: 2000, notes: 'n', isFavorite: true, deletedAt: 2000 }, 2000, [
          'notes',
          'isFavorite',
          'deletedAt',
        ]),
      ]);
      expect(result.status).toBe('skipped-lww');
      expect(await raw(r.id)).toEqual(before);
    });

    it('equal clocks with different values: the first stays, the second is skipped-lww with it as current', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      expect((await push(db, USER_A, [at({ ...r, updatedAt: 2000, notes: 'first' }, 2000, ['notes'])]))[0].status).toBe(
        'applied',
      );
      const [second] = await push(db, USER_A, [at({ ...r, updatedAt: 2000, notes: 'second' }, 2000, ['notes'])]);
      expect(second).toMatchObject({ status: 'skipped-lww', current: { notes: 'first' } });
    });

    it('per-field clocks of one push merge one by one: an older clock on one field loses while a newer one wins', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [at({ ...r, updatedAt: 3000, notes: 'other device' }, 3000, ['notes'])]);
      const [result] = await push(db, USER_A, [
        edit({ ...r, updatedAt: 4000, notes: 'mine, older', isFavorite: true }, { notes: 2000, isFavorite: 4000 }),
      ]);
      expect(result).toMatchObject({ status: 'skipped-lww', current: { notes: 'other device', isFavorite: true } });
      expect((await raw(r.id)).fieldClock).toMatchObject({ notes: 3000, isFavorite: 4000 });
    });

    it('only the future field clocks of a push are clamped', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      const future = Date.now() + 3_600_000;
      await push(db, USER_A, [
        edit({ ...r, updatedAt: future, notes: 'ahead', isFavorite: true }, { notes: future, isFavorite: 2000 }),
      ]);
      const row = await raw(r.id);
      expect(row.fieldClock!.isFavorite).toBe(2000);
      expect(row.fieldClock!.notes).toBeLessThan(future);
      expect(row.updatedAt).toBe(row.fieldClock!.notes);
    });

    it('a replayed mixed batch gets the same results and moves no server_seq', async () => {
      const rs = [assetRecord(), assetRecord(), assetRecord()];
      await push(db, USER_A, rs.map(mut));
      await push(db, USER_A, [at({ ...rs[1], updatedAt: 3000, notes: 'newer' }, 3000, ['notes'])]);
      const batch = [
        at({ ...rs[0], updatedAt: 2000, notes: 'wins' }, 2000, ['notes']),
        at({ ...rs[1], updatedAt: 2000, notes: 'loses', isFavorite: true }, 2000, ['notes', 'isFavorite']),
        at({ ...rs[2], updatedAt: 2000, deletedAt: 2000 }, 2000, ['deletedAt']),
      ];
      const first = await push(db, USER_A, batch);
      expect(first.map((r) => r.status)).toEqual(['applied', 'skipped-lww', 'applied']);
      const seqs = await Promise.all(rs.map((r) => serverSeqOf(USER_A, r.id)));
      const again = await push(db, USER_A, batch);
      expect(again).toEqual(first);
      expect(await Promise.all(rs.map((r) => serverSeqOf(USER_A, r.id)))).toEqual(seqs);
    });

    it('a purged row is frozen for per-field pushes, whole-record pushes and a second purge alike', async () => {
      const r = assetRecord({ deletedAt: 1000 });
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [at({ ...r, updatedAt: 2000, purgedAt: 2000 }, 2000, ['purgedAt'])]);
      const frozen = await raw(r.id);
      const attempts = [
        at({ ...r, updatedAt: 9000, notes: 'n' }, 9000, ['notes']),
        at({ ...r, updatedAt: 9000, deletedAt: null }, 9000, ['deletedAt']),
        mut({ ...r, updatedAt: 9000, deletedAt: null, purgedAt: null }),
        mut({ ...r, updatedAt: 9000, isFavorite: true }), // no purgedAt key
        at({ ...r, updatedAt: 9000, purgedAt: 9000 }, 9000, ['purgedAt', 'deletedAt']),
      ];
      for (const attempt of attempts) {
        const [result] = await push(db, USER_A, [attempt]);
        expect(result).toMatchObject({
          status: 'skipped-lww',
          current: { purgedAt: 2000, deletedAt: 1000, notes: null },
        });
      }
      expect(await raw(r.id)).toEqual(frozen);
      // The identical purge, replayed, is applied.
      expect(
        (await push(db, USER_A, [at({ ...r, updatedAt: 2000, purgedAt: 2000 }, 2000, ['purgedAt'])]))[0].status,
      ).toBe('applied');
    });

    it('a purge with its own delete: applies on a live row, loses to a newer restore, applies under a newer delete', async () => {
      const live = assetRecord();
      const restored = assetRecord({ deletedAt: 1000 });
      const redeleted = assetRecord({ deletedAt: 1000 });
      await push(db, USER_A, [mut(live), mut(restored), mut(redeleted)]);
      await push(db, USER_A, [
        at({ ...restored, updatedAt: 3000, deletedAt: null }, 3000, ['deletedAt']),
        at({ ...redeleted, updatedAt: 3000, deletedAt: 3000 }, 3000, ['deletedAt']),
      ]);
      const purge = (r: Record<string, unknown>) =>
        edit({ ...r, updatedAt: 2500, deletedAt: 2000, purgedAt: 2500 }, { deletedAt: 2000, purgedAt: 2500 });
      const results = await push(db, USER_A, [purge(live), purge(restored), purge(redeleted)]);
      expect(results[0].status).toBe('applied');
      expect(await raw(live.id)).toMatchObject({ deletedAt: 2000, purgedAt: 2500 });
      expect(results[1]).toMatchObject({ status: 'skipped-lww', current: { deletedAt: null, purgedAt: null } });
      expect(results[2]).toMatchObject({ status: 'skipped-lww', current: { deletedAt: 3000, purgedAt: 2500 } });
    });

    // The restore remembers the deletion value it undid, so a purge made of it loses whatever the clocks.
    it('a restore beats a purge that hadn’t seen it when the deletion came from a fast clock', async () => {
      const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
      const r = { ...assetRecord(), purgedAt: null as number | null };
      await push(db, USER_A, [mut(r)]);
      const fastDeletion = Date.now() + 3_600_000; // the deleting device is an hour ahead
      const deleted = { ...r, updatedAt: fastDeletion, deletedAt: fastDeletion };
      expect((await push(db, USER_A, [at(deleted, fastDeletion, ['deletedAt'])]))[0].status).toBe('applied');
      await tick();
      const restoredAt = Date.now();
      await push(db, USER_A, [at({ ...r, updatedAt: restoredAt, deletedAt: null }, restoredAt, ['deletedAt'])]);
      expect(await raw(r.id)).toMatchObject({ deletedAt: null });
      await tick();
      const purgedAt = Date.now(); // made on a device that only saw the deletion
      const [result] = await push(db, USER_A, [
        at({ ...deleted, updatedAt: purgedAt, purgedAt }, purgedAt, ['deletedAt', 'purgedAt']),
      ]);
      expect(result).toMatchObject({ status: 'skipped-lww', current: { deletedAt: null, purgedAt: null } });
    });

    it('a restore and a purge of one record in one push: the restore first beats the purge, the purge first is final', async () => {
      const restoredFirst = { ...assetRecord({ deletedAt: 1000 }), purgedAt: null as number | null };
      const purgedFirst = { ...assetRecord({ deletedAt: 1000 }), purgedAt: null as number | null };
      await push(db, USER_A, [mut(restoredFirst), mut(purgedFirst)]);
      const restore = (r: Record<string, unknown>) =>
        at({ ...r, updatedAt: 3000, deletedAt: null }, 3000, ['deletedAt']);
      const purge = (r: Record<string, unknown>) => at({ ...r, updatedAt: 2000, purgedAt: 2000 }, 2000, ['purgedAt']);
      const results = await push(db, USER_A, [
        restore(restoredFirst),
        purge(restoredFirst),
        purge(purgedFirst),
        restore(purgedFirst),
      ]);
      expect(results.map((result) => result.status)).toEqual(['applied', 'skipped-lww', 'applied', 'skipped-lww']);
      expect(await raw(restoredFirst.id)).toMatchObject({ deletedAt: null, purgedAt: null });
      expect(await raw(purgedFirst.id)).toMatchObject({ deletedAt: 1000, purgedAt: 2000 });
    });

    it('a purge alone on a live row changes nothing', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      const before = await raw(r.id);
      const [result] = await push(db, USER_A, [at({ ...r, updatedAt: 2000, purgedAt: 2000 }, 2000, ['purgedAt'])]);
      expect(result).toMatchObject({ status: 'skipped-lww', current: { purgedAt: null } });
      expect(await raw(r.id)).toEqual(before);
    });

    it('an edge removal stays removed when a newer reorder of it arrives, and keeps the new position', async () => {
      const e = {
        id: randomUUID(),
        createdAt: 1000,
        updatedAt: 1000,
        deletedAt: null,
        albumId: randomUUID(),
        assetId: randomUUID(),
        position: 'a0',
      };
      await push(db, USER_A, [{ collection: 'album_assets', record: e }]);
      await push(db, USER_A, [at({ ...e, updatedAt: 2000, deletedAt: 2000 }, 2000, ['deletedAt'], 'album_assets')]);
      const [reorder] = await push(db, USER_A, [
        at({ ...e, updatedAt: 3000, position: 'Zz' }, 3000, ['position'], 'album_assets'),
      ]);
      expect(reorder.status).toBe('applied');
      const { changes } = await pull(db, USER_A, { cursor: 0 });
      expect(changes.album_assets.records).toEqual([
        expect.objectContaining({ id: e.id, deletedAt: 2000, position: 'Zz' }),
      ]);
    });

    it('a full batch of 500 mutations, two per record, newer and older, resolves each field by its clock', async () => {
      const rs = Array.from({ length: 250 }, () => assetRecord());
      await push(db, USER_A, rs.map(mut));
      const mutations = rs.flatMap((r, i) => [
        at({ ...r, updatedAt: 3000, notes: `newer ${i}` }, 3000, ['notes']),
        i % 2 === 0
          ? at({ ...r, updatedAt: 2000, notes: `older ${i}`, isFavorite: true }, 2000, ['notes', 'isFavorite'])
          : mut({ ...r, updatedAt: 2000, notes: `older ${i}`, isFavorite: true }), // an old app's whole record
      ]);
      expect(mutations).toHaveLength(500);
      const results = await push(db, USER_A, mutations);
      expect(results.filter((r) => r.status === 'skipped-lww')).toHaveLength(250);
      const { changes } = await pull(db, USER_A, { cursor: 0, limit: 1000 });
      const byId = new Map((changes.assets.records as any[]).map((row) => [row.id, row]));
      for (const [i, r] of rs.entries())
        expect(byId.get(r.id)).toMatchObject({ notes: `newer ${i}`, isFavorite: true, updatedAt: 3000 });
    });
  });

  it('idempotent strict-> replay: equal timestamp is a no-op, no server_seq re-stamp', async () => {
    const r = assetRecord({ updatedAt: 1000 });
    await push(db, USER_A, [mut(r)]);
    const seq1 = await serverSeqOf(USER_A, r.id);

    const replay = await push(db, USER_A, [mut(r)]); // identical, equal updatedAt: it holds
    expect(replay[0].status).toBe('applied');
    const seq2 = await serverSeqOf(USER_A, r.id);
    expect(seq2).toBe(seq1); // NOT re-stamped → no sync amplification
  });

  it('multiple mutations for the same row in one push resolve by LWW in order', async () => {
    const r = assetRecord();
    const res = await push(db, USER_A, [
      mut({ ...r, updatedAt: 1000 }),
      mut({ ...r, updatedAt: 2000, notes: 'win' }),
      mut({ ...r, updatedAt: 1500, notes: 'lose' }),
    ]);
    expect(res.map((x) => x.status)).toEqual(['applied', 'applied', 'skipped-lww']);
    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records[0]).toMatchObject({ id: r.id, updatedAt: 2000, notes: 'win' });
  });

  it('concurrent pushes do not drop rows (per-user advisory lock serializes)', async () => {
    const records = Array.from({ length: 8 }, () => assetRecord());
    await Promise.all(records.map((r) => push(db, USER_A, [mut(r)])));
    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records).toHaveLength(8);
    expect(new Set(page.changes.assets.records.map((r: any) => r.id))).toEqual(new Set(records.map((r) => r.id)));
  });

  it('partial-push rejection: invalid record rejected, valid one persists', async () => {
    const good = assetRecord();
    const bad = { ...assetRecord(), mediaType: 'gif' }; // not in enum
    const res = await push(db, USER_A, [mut(good), mut(bad)]);
    expect(res[0].status).toBe('applied');
    expect(res[1].status).toBe('rejected');
    expect(res[1].reason).toContain('schema:');

    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records.map((r: any) => r.id)).toEqual([good.id]);
  });

  it('partial-push rejection: a fractional timestamp is rejected, the rest of the push applies', async () => {
    const good = postRecord();
    const bad = postRecord({ suggestRepostAt: 1734567890123.5 }); // the server's bigint column can't take it
    const res = await push(db, USER_A, [
      { collection: 'posts', record: bad },
      { collection: 'posts', record: good },
    ]);
    expect(res[0]).toMatchObject({ id: bad.id, status: 'rejected', reason: 'schema:suggestRepostAt' });
    expect(res[1]).toMatchObject({ id: good.id, status: 'applied' });

    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.posts.records.map((r: any) => r.id)).toEqual([good.id]);
  });

  it('partial-push rejection: values Postgres cannot store are schema rejections, the rest applies', async () => {
    const nulByte = assetRecord({ notes: 'a\u0000b' }); // Postgres text can't hold NUL
    const tooWide = assetRecord({ width: 2 ** 31 }); // out of range for the int4 column
    const good = assetRecord();
    const res = await push(db, USER_A, [mut(nulByte), mut(tooWide), mut(good)]);
    expect(res[0]).toMatchObject({ id: nulByte.id, status: 'rejected', reason: 'schema:notes' });
    expect(res[1]).toMatchObject({ id: tooWide.id, status: 'rejected', reason: 'schema:width' });
    expect(res[2]).toMatchObject({ id: good.id, status: 'applied' });
  });

  // No record the schema accepts fails in Postgres today; the savepoint fallback is the backstop for
  // a row-level error the schema doesn't foresee. A temporary CHECK constraint stands in for one.
  const REJECTED_NOTES = 'rejected by test_rejected_notes';
  async function withRejectedNotes(run: () => Promise<void>) {
    await pool.query('ALTER TABLE assets DROP CONSTRAINT IF EXISTS test_rejected_notes');
    await pool.query(
      `ALTER TABLE assets ADD CONSTRAINT test_rejected_notes CHECK (notes IS DISTINCT FROM '${REJECTED_NOTES}') NOT VALID`,
    );
    try {
      await run();
    } finally {
      await pool.query('ALTER TABLE assets DROP CONSTRAINT test_rejected_notes');
    }
  }

  it('partial-push rejection: a database error on one row rejects it, the rest of the push applies', async () => {
    await withRejectedNotes(async () => {
      const bad = assetRecord({ notes: REJECTED_NOTES });
      const good = assetRecord();
      const res = await push(db, USER_A, [mut(bad), mut(good)]);
      expect(res[0]).toMatchObject({ id: bad.id, status: 'rejected', reason: 'db:23514' });
      expect(res[1]).toMatchObject({ id: good.id, status: 'applied' });

      const page = await pull(db, USER_A, { cursor: 0 });
      expect(page.changes.assets.records.map((r: any) => r.id)).toEqual([good.id]);
    });
  });

  it('partial-push rejection: rows before a database error get the same results as in a clean push', async () => {
    // The failing batch is rolled back and rerun row by row, so the rerun must not see its own writes.
    await withRejectedNotes(async () => {
      const r = assetRecord();
      const res = await push(db, USER_A, [
        mut({ ...r, updatedAt: 1000 }),
        mut({ ...r, updatedAt: 2000, notes: 'win' }),
        mut({ ...r, updatedAt: 1500, notes: 'lose' }),
        mut(assetRecord({ notes: REJECTED_NOTES })),
      ]);
      expect(res.map((x) => x.reason ?? x.status)).toEqual(['applied', 'applied', 'skipped-lww', 'db:23514']);
      expect(res[2].current).toMatchObject({ id: r.id, updatedAt: 2000, notes: 'win' });

      const page = await pull(db, USER_A, { cursor: 0 });
      expect(page.changes.assets.records).toHaveLength(1);
    });
  });

  it('a push for a deleted user fails as a whole instead of rejecting each row', async () => {
    // user_id comes from the token, so its foreign key failing is not the rows' fault.
    await expect(push(db, randomUUID(), [mut(assetRecord()), mut(assetRecord())])).rejects.toThrow(
      /assets_user_id_users_id_fk/,
    );
  });

  it('pagination: hasMore loops until drained', async () => {
    const records = Array.from({ length: 5 }, () => assetRecord());
    await push(db, USER_A, records.map(mut));

    const seen: string[] = [];
    let cursor = 0;
    for (let i = 0; i < 10; i++) {
      const page = await pull(db, USER_A, { cursor, limit: 2 });
      seen.push(...page.changes.assets.records.map((r: any) => r.id));
      cursor = page.cursor;
      if (!page.hasMore) break;
    }
    expect(new Set(seen)).toEqual(new Set(records.map((r) => r.id)));
  });

  describe('restored deletions, the lock, one batch against many pushes', () => {
    // Users of their own: another checkout's run on the same Postgres can't touch their rows.
    const ME = randomUUID();
    const TWIN = randomUUID();
    const pair = ['deletedAt', 'purgedAt'];
    const at = (record: Record<string, unknown>, clock: number, fields: string[]) => ({
      collection: 'assets',
      record,
      fields: Object.fromEntries(fields.map((field) => [field, clock])),
    });
    const raw = async (id: string, user = ME) =>
      (
        await db
          .select()
          .from(schema.assets)
          .where(and(eq(schema.assets.userId, user), eq(schema.assets.id, id)))
      )[0]!;
    const asset = (over: Record<string, unknown> = {}) => ({
      ...assetRecord(over),
      purgedAt: null as number | null,
      ...over,
    });

    beforeAll(async () => {
      await db.insert(schema.users).values([
        { id: ME, email: `r3-${ME}@test.local`, passwordDigest: 'x', storageBucket: null },
        { id: TWIN, email: `r3-${TWIN}@test.local`, passwordDigest: 'x', storageBucket: null },
      ]);
    });
    afterAll(async () => {
      await db.delete(schema.assets).where(inArray(schema.assets.userId, [ME, TWIN]));
      await db.delete(schema.users).where(inArray(schema.users.id, [ME, TWIN]));
    });

    it('300 delete/restore cycles keep the last ten deletions undone: a purge of one of them loses, of an older one goes by its clock', async () => {
      const r = asset();
      await push(db, ME, [mut(r)]);
      let clock = 2000;
      for (let cycle = 0; cycle < 300; cycle++) {
        const deletedAt = (clock += 10);
        await push(db, ME, [at({ ...r, updatedAt: deletedAt, deletedAt }, deletedAt, pair)]);
        clock += 10;
        await push(db, ME, [at({ ...r, updatedAt: clock, deletedAt: null }, clock, pair)]);
      }
      const row = await raw(r.id);
      const last = clock - 10;
      expect(row.restoredDeletions).toEqual(Array.from({ length: 10 }, (_, i) => last - (9 - i) * 20));
      const recent = { ...r, updatedAt: 9_000_000, deletedAt: last, purgedAt: 9_000_000 };
      const [lost] = await push(db, ME, [at(recent, 9_000_000, pair)]);
      expect(lost).toMatchObject({ status: 'skipped-lww', current: { deletedAt: null, purgedAt: null } });
      const oldest = { ...r, updatedAt: 9_000_001, deletedAt: 2010, purgedAt: 9_000_001 };
      const [applied] = await push(db, ME, [at(oldest, 9_000_001, pair)]);
      expect(applied.status).toBe('applied');
    });

    it('a fast clock’s restore doesn’t make a later real delete and purge on another device lose', async () => {
      const r = asset({ deletedAt: 1000 });
      await push(db, ME, [mut(r)]);
      // A device whose clock runs a day ahead restores the photo; then deletes it at its own clock.
      const ahead = 1000 + 86_400_000;
      await push(db, ME, [at({ ...r, updatedAt: ahead, deletedAt: null }, ahead, pair)]);
      await push(db, ME, [at({ ...r, updatedAt: ahead + 10, deletedAt: ahead + 10 }, ahead + 10, pair)]);
      await push(db, ME, [at({ ...r, updatedAt: ahead + 20, deletedAt: null }, ahead + 20, pair)]); // and restores again
      expect((await raw(r.id)).restoredDeletions).toEqual([1000, ahead + 10]);
      // Another device, its clock right, deletes and purges it for real, newer than every clock above.
      const now = ahead + 1000;
      await push(db, ME, [at({ ...r, updatedAt: now, deletedAt: now - 5, purgedAt: now }, now, pair)]);
      expect(await raw(r.id)).toMatchObject({ deletedAt: now - 5, purgedAt: now });
    });

    it('the restored deletions survive the rollback rule and an old app’s whole record, and no client ever sees them', async () => {
      const r = asset({ deletedAt: 1000 });
      await push(db, ME, [mut(r)]);
      await push(db, ME, [at({ ...r, updatedAt: 2000, deletedAt: null }, 2000, pair)]);
      // A server without clocks writes the row since (a rollback), leaving field_clock as it was.
      await pool.query(`UPDATE assets SET updated_at = 4000, notes = 'old server' WHERE user_id = $1 AND id = $2`, [
        ME,
        r.id,
      ]);
      // Then an old app's whole record, newer, from a device that saw the restore.
      const [old] = await push(db, ME, [
        mut({ ...r, updatedAt: 5000, deletedAt: null, notes: 'old server', isFavorite: true }),
      ]);
      expect(old.status).toBe('applied');
      expect((await raw(r.id)).restoredDeletions).toEqual([1000]);
      // A device that only saw the deletion at 1000 purges, its clock far ahead of everything.
      const [purge] = await push(db, ME, [at({ ...r, updatedAt: 9000, purgedAt: 9000 }, 9000, pair)]);
      expect(purge).toMatchObject({
        status: 'skipped-lww',
        current: { deletedAt: null, purgedAt: null, isFavorite: true },
      });
      const serverOnly = (record: object) =>
        Object.keys(record).filter((key) => key === 'restoredDeletions' || key === 'fieldClock');
      expect(serverOnly(purge.current!)).toEqual([]);
      const { changes } = await pull(db, ME, { cursor: 0, limit: 1000 });
      for (const record of changes.assets.records) expect(serverOnly(record)).toEqual([]);
    });

    it('a restore an old server took is not remembered: a purge of that deletion then goes by its clock (a rollback’s limit)', async () => {
      const r = asset({ deletedAt: 1000 });
      await push(db, ME, [mut(r)]);
      await pool.query(`UPDATE assets SET updated_at = 2000, deleted_at = NULL WHERE user_id = $1 AND id = $2`, [
        ME,
        r.id,
      ]);
      const [purge] = await push(db, ME, [at({ ...r, updatedAt: 3000, purgedAt: 3000 }, 3000, pair)]);
      expect(purge.status).toBe('applied');
      expect(await raw(r.id)).toMatchObject({ deletedAt: 1000, purgedAt: 3000 });
    });

    it('a stale field_clock behind an old server’s writes: every field takes its updated_at, then pins again', async () => {
      const r = asset();
      await push(db, ME, [mut(r)]);
      await push(db, ME, [at({ ...r, updatedAt: 3000, notes: 'new' }, 3000, ['notes'])]);
      // A server without clocks writes a newer whole record at 4000, field_clock left at notes 3000.
      await pool.query(
        `UPDATE assets SET updated_at = 4000, notes = 'old', is_favorite = true WHERE user_id = $1 AND id = $2`,
        [ME, r.id],
      );
      // A per-field edit older than the old server's write loses, though newer than the stale clock.
      const [older] = await push(db, ME, [at({ ...r, updatedAt: 3500, notes: 'newer than 3000' }, 3500, ['notes'])]);
      expect(older).toMatchObject({ status: 'skipped-lww', current: { notes: 'old' } });
      // A newer one wins, and from then on the row has clocks again: the next older edit of another field loses.
      expect(
        (await push(db, ME, [at({ ...r, updatedAt: 4500, isFavorite: false }, 4500, ['isFavorite'])]))[0].status,
      ).toBe('applied');
      const row = await raw(r.id);
      expect(row.fieldClock).toMatchObject({ notes: 4000, isFavorite: 4500, deletedAt: 4000 });
      expect(row.updatedAt).toBe(4500);
      const [stale] = await push(db, ME, [at({ ...r, updatedAt: 4200, notes: 'late' }, 4200, ['notes'])]);
      expect(stale.status).toBe('applied'); // 4200 > the notes clock 4000
      expect((await raw(r.id)).notes).toBe('late');
    });

    it('two devices pushing one record at once, 30 times over: the lock serializes, the newer clock wins in any order', async () => {
      for (let round = 0; round < 30; round++) {
        const r = asset({ deletedAt: 1000 });
        await push(db, ME, [mut(r)]);
        const restore = at({ ...r, updatedAt: 2000, deletedAt: null, notes: 'B' }, 2000, [
          'deletedAt',
          'purgedAt',
          'notes',
        ]);
        const purge = at({ ...r, updatedAt: 3000, purgedAt: 3000, notes: 'A' }, 3000, [
          'deletedAt',
          'purgedAt',
          'notes',
        ]);
        const [[a], [b]] = await Promise.all([push(db, ME, [purge]), push(db, ME, [restore])]);
        const row = await raw(r.id);
        // Either order is consistent: the purge first is final; the restore first beats the purge of its deletion.
        if (row.purgedAt !== null) {
          expect(row).toMatchObject({ deletedAt: 1000, purgedAt: 3000, notes: 'A' });
          expect([a!.status, b!.status]).toEqual(['applied', 'skipped-lww']);
        } else {
          expect(row).toMatchObject({ deletedAt: null, notes: 'A' }); // A's newer notes still apply
          expect([a!.status, b!.status]).toEqual(['skipped-lww', 'applied']);
        }
      }
      const records = Array.from({ length: 20 }, () => asset());
      await push(db, ME, records.map(mut));
      // 20 concurrent pushes per record, each a newer clock for notes and isFavorite: the newest wins.
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          push(
            db,
            ME,
            records.map((r) =>
              at({ ...r, updatedAt: 5000 + i, notes: `n${i}`, isFavorite: i % 2 === 0 }, 5000 + i, [
                'notes',
                'isFavorite',
              ]),
            ),
          ),
        ),
      );
      for (const r of records)
        expect(await raw(r.id)).toMatchObject({ notes: 'n19', isFavorite: false, updatedAt: 5019 });
    });

    // A record sent without the final field (an app from before purges) leaves the merged record's
    // purgedAt as the column holds it (null), which the next mutation of the batch merges against.
    it('a restore by an app from before purges, then a restore by a new app in the same batch: applied, as pushed alone', async () => {
      const r = asset({ deletedAt: 1000 });
      await push(db, ME, [mut(r)]);
      const { purgedAt: _p, ...prePurge } = { ...r, updatedAt: 3000, deletedAt: null };
      const newer = at({ ...r, updatedAt: 2000, deletedAt: null }, 2000, pair); // older clock, same values
      const results = await push(db, ME, [mut(prePurge), newer]);
      expect(await raw(r.id)).toMatchObject({ deletedAt: null, purgedAt: null });
      expect(results.map((result) => result.status)).toEqual(['applied', 'applied']);
    });

    // One batch reads its rows once and merges in JS; pushed one by one, every mutation reads the
    // row again. Both must come to the same results and rows. Seeded: 600 mutations, two batches.
    async function batchAgainstOneByOne(kinds: string[]) {
      let seed = 7;
      const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
      const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
      const records = Array.from({ length: 25 }, () => asset());
      // Each record has two devices' copies; a mutation changes one field of one copy, like an edit.
      const copies = records.map((r) => Array.from({ length: 2 }, () => ({ ...r }) as Record<string, any>));
      let now = 2000;
      const mutations = Array.from({ length: 600 }, () => {
        now += 10;
        const clock = now - (rand() < 0.2 ? Math.floor(rand() * 30) * 10 : 0);
        const copy = pick(copies)[rand() < 0.8 ? 0 : 1]!;
        const change = rand() < 0.04 ? 'purge' : pick(['notes', 'isFavorite', 'delete', 'restore', 'restore'] as const);
        let fields: string[];
        if (change === 'notes') ((copy.notes = pick([null, 'x', 'y', `n${clock}`])), (fields = ['notes']));
        else if (change === 'isFavorite') ((copy.isFavorite = !copy.isFavorite), (fields = ['isFavorite']));
        else if (change === 'delete') ((copy.deletedAt = clock), (copy.purgedAt = null), (fields = pair));
        else if (change === 'restore') ((copy.deletedAt = null), (copy.purgedAt = null), (fields = pair));
        else ((copy.deletedAt ??= clock), (copy.purgedAt = clock), (fields = pair));
        copy.updatedAt = clock;
        const record = { ...copy };
        const kind = pick(kinds);
        if (kind === 'whole') return mut(record); // an app from before per-field merge
        if (kind === 'prePurge') {
          const { purgedAt: _p, ...rest } = record; // and from before purges
          return mut(rest);
        }
        return at(record, clock, fields);
      });
      await push(db, ME, records.map(mut));
      await push(db, TWIN, records.map(mut));
      const batched = [];
      for (let i = 0; i < mutations.length; i += 500)
        batched.push(...(await push(db, ME, mutations.slice(i, i + 500))));
      const single = [];
      for (const mutation of mutations) single.push(...(await push(db, TWIN, [mutation])));
      // `current` is the wire record: JSON, where an undefined purgedAt reads as a missing one.
      const wire = (rows: unknown[]) => rows.map((row) => JSON.stringify(row));
      expect(batched.filter((result) => result.status === 'applied').length).toBeGreaterThan(300);
      expect(wire(batched)).toEqual(wire(single));
      for (const r of records) {
        const { userId: _a, serverSeq: _b, ...mine } = await raw(r.id, ME);
        const { userId: _c, serverSeq: _d, ...twin } = await raw(r.id, TWIN);
        expect(mine).toEqual(twin);
      }
    }

    it('a seeded batch of 600 mutations naming 25 records over and over merges like the same pushes one by one', async () => {
      await batchAgainstOneByOne(['fields', 'fields', 'fields', 'whole']);
    });

    // The one above, with apps from before purges in the mix.
    it('the same with apps from before purges in the mix', async () => {
      await batchAgainstOneByOne(['fields', 'fields', 'fields', 'whole', 'prePurge']);
    });

    it('an id sent in upper case names the stored row: a purged one stays purged, a live one merges', async () => {
      const purged = asset({ updatedAt: 2000, deletedAt: 1000, purgedAt: 2000 });
      const live = asset({ notes: 'kept' });
      await push(db, ME, [mut(purged), mut(live)]);
      const upper = (record: Record<string, unknown>) => ({ ...record, id: String(record.id).toUpperCase() });
      const results = await push(db, ME, [
        mut(upper({ ...purged, updatedAt: 9000, deletedAt: null, purgedAt: null })),
        at(upper({ ...live, updatedAt: 3000, isFavorite: true }), 3000, ['isFavorite']),
      ]);
      expect(results.map(({ id, status }) => ({ id, status }))).toEqual([
        { id: purged.id.toUpperCase(), status: 'skipped-lww' },
        { id: live.id.toUpperCase(), status: 'applied' },
      ]);
      expect(await raw(purged.id)).toMatchObject({ deletedAt: 1000, purgedAt: 2000 });
      expect(await raw(live.id)).toMatchObject({ notes: 'kept', isFavorite: true, updatedAt: 3000 });
    });

    it('an insert whose fields name nothing it carries is written whole and applied', async () => {
      const r = asset({ notes: 'new' });
      const [result] = await push(db, ME, [{ collection: 'assets', record: r, fields: { nothing: 5 } }]);
      expect(result.status).toBe('applied');
      expect(await raw(r.id)).toMatchObject({ notes: 'new', updatedAt: r.updatedAt, fieldClock: null });
    });
  });

  describe('tenant isolation', () => {
    it('user B never sees user A rows; a colliding id lands in B partition, A untouched', async () => {
      const shared = assetRecord({ notes: 'A-data', updatedAt: 5000 });
      await push(db, USER_A, [mut(shared)]);

      // B does not see A's row
      const bEmpty = await pull(db, USER_B, { cursor: 0 });
      expect(bEmpty.changes.assets.records).toHaveLength(0);

      // B pushes a record with the SAME id → creates in B's own partition (composite PK)
      const bRes = await push(db, USER_B, [mut({ ...shared, notes: 'B-data', updatedAt: 9999 })]);
      expect(bRes[0].status).toBe('applied');

      // A's row is untouched; B has its own
      const aPage = await pull(db, USER_A, { cursor: 0 });
      expect(aPage.changes.assets.records[0]).toMatchObject({ id: shared.id, notes: 'A-data', updatedAt: 5000 });
      const bPage = await pull(db, USER_B, { cursor: 0 });
      expect(bPage.changes.assets.records[0]).toMatchObject({ id: shared.id, notes: 'B-data', updatedAt: 9999 });
    });
  });

  // The "add a collection" recipe's silent failure modes (sync-design §9): a forgotten
  // server_seq trigger (rows never pulled) and a plain-id PK (cross-tenant collision). Assert
  // both — plus a round-trip and tenant isolation — for EVERY registered collection.
  describe('collection registry guard', () => {
    const base = () => ({ id: randomUUID(), createdAt: 1000, updatedAt: 1000, deletedAt: null });
    const sample: Record<string, () => Record<string, unknown>> = {
      assets: () => assetRecord(),
      albums: () => albumRecord(),
      posts: () => postRecord(),
      album_assets: () => ({ ...base(), albumId: randomUUID(), assetId: randomUUID(), position: 'a0' }),
      post_assets: () => ({ ...base(), postId: randomUUID(), assetId: randomUUID(), position: 'a0' }),
      personas: () => ({
        ...base(),
        aboutYou: 'Outdoor photographer from Oregon.',
        contentTags: ['hiking', 'forest'],
        tone: 'Short and calm.',
        rules: ['Never use hashtags'],
      }),
      prompt_buttons: () => ({
        ...base(),
        name: 'Shorter',
        prompt: 'Make each option shorter.',
        placement: 'refine',
        icon: null,
        position: 'a0',
      }),
      favorites: () => ({ ...base(), text: 'First light on the ridge.', source: null }),
      instructions: () => ({ ...base(), writing: 'Write like me.', personaDraft: null, visionTagging: null }),
    };

    for (const name of collectionNames) {
      it(`${name}: registered, trigger + composite PK, round-trips, tenant-isolated`, async () => {
        expect(serverCollections[name]).toBeTruthy();

        const trig = await pool.query('SELECT 1 FROM pg_trigger WHERE tgname = $1', [`${name}_server_seq`]);
        expect(trig.rowCount).toBe(1);

        const clock = await pool.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'field_clock'`,
          [name],
        );
        expect(clock.rowCount).toBe(1);

        const pk = await pool.query(
          `SELECT a.attname FROM pg_index i
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = $1::regclass AND i.indisprimary`,
          [name],
        );
        expect(pk.rows.map((r: { attname: string }) => r.attname).sort()).toEqual(['id', 'user_id']);

        const rec = sample[name]();
        const res = await push(db, USER_A, [{ collection: name, record: rec }]);
        expect(res[0].status).toBe('applied');

        const aPage = await pull(db, USER_A, { cursor: 0 });
        expect(aPage.changes[name].records.find((r: any) => r.id === rec.id)).toMatchObject(rec);

        const bPage = await pull(db, USER_B, { cursor: 0 });
        expect(bPage.changes[name]?.records.some((r: any) => r.id === rec.id) ?? false).toBe(false);

        // A per-field delete merges, comes back on pull as a tombstone, and is a no-op when replayed.
        const removal = {
          collection: name,
          record: { ...rec, updatedAt: 2000, deletedAt: 2000 },
          fields: { deletedAt: 2000 },
        };
        expect((await push(db, USER_A, [removal]))[0].status).toBe('applied');
        const { changes, cursor } = await pull(db, USER_A, { cursor: aPage.cursor });
        expect(changes[name].records).toEqual([expect.objectContaining({ id: rec.id, deletedAt: 2000 })]);
        expect(changes[name].records[0]).not.toHaveProperty('fieldClock');
        expect((await push(db, USER_A, [removal]))[0].status).toBe('applied');
        expect((await pull(db, USER_A, { cursor })).changes[name].records).toEqual([]);
      });
    }
  });
});
