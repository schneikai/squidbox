import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import type { PushMutation, PushResult } from '@squidbox/shared';
import * as schema from '../src/db/schema.js';
import { serverCollections } from '../src/sync/collections.js';
import { push } from '../src/sync/push.js';
import { pull } from '../src/sync/pull.js';

// Pushes split into statements under Postgres' bind parameter limit. Rows
// merged twice across a statement boundary, the per-row fallback inside a split push, the read split
// at 65,534 ids, server_seq across statements, and a whole library of 10,000 photos.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

type Db = ReturnType<typeof drizzle<typeof schema>>;
type Rec = Record<string, any> & { id: string; updatedAt: number };

const rowsPerStatement = (collection: string) => Math.floor(65_535 / serverCollections[collection]!.columnCount);

d('push: split statements', () => {
  let pool: pg.Pool;
  let db: Db;
  const ME = randomUUID();
  const TWIN = randomUUID();

  const asset = (over: Record<string, unknown> = {}): Rec => ({
    id: randomUUID(),
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null,
    mediaLibraryAssetId: 'm1',
    mediaType: 'photo',
    width: 100,
    height: 100,
    fileSize: 500,
    duration: null,
    filename: 'a.jpg',
    thumbnailFilename: 't.jpg',
    isFavorite: false,
    notes: null,
    oldFileId: null,
    isFileSynced: true,
    isThumbnailSynced: true,
    isSynced: true,
    purgedAt: null,
    favoritedAt: null,
    takenAt: null,
    originalFilename: null,
    latitude: null,
    longitude: null,
    tags: null,
    ...over,
  });
  const edge = (over: Record<string, unknown> = {}): Rec => ({
    id: randomUUID(),
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null,
    albumId: randomUUID(),
    assetId: randomUUID(),
    position: 'a0',
    ...over,
  });
  const whole = (record: Rec, collection = 'assets'): PushMutation => ({ collection, record });
  const at = (record: Rec, clock: number, fields: string[], collection = 'assets'): PushMutation => ({
    collection,
    record,
    fields: Object.fromEntries(fields.map((field) => [field, clock])),
  });
  const wire = (results: PushResult[]) => results.map((result) => JSON.stringify(result));

  async function rowsOf(collection: string, user: string) {
    const table = serverCollections[collection]!.table as any;
    const rows = (await db.select().from(table).where(eq(table.userId, user))) as Record<string, any>[];
    return new Map(rows.map(({ userId: _u, serverSeq: _s, ...row }) => [row.id as string, row]));
  }
  async function expectSameRows(collection: string) {
    const mine = await rowsOf(collection, ME);
    const twin = await rowsOf(collection, TWIN);
    expect(mine.size).toBe(twin.size);
    for (const [id, row] of mine)
      if (JSON.stringify(row) !== JSON.stringify(twin.get(id))) expect(row).toEqual(twin.get(id));
  }
  async function clear(user: string) {
    for (const table of [schema.albumAssets, schema.postAssets, schema.posts, schema.albums, schema.assets])
      await db.delete(table).where(eq(table.userId, user));
  }
  async function inBatches(user: string, mutations: PushMutation[], size: number) {
    const results: PushResult[] = [];
    for (let i = 0; i < mutations.length; i += size)
      results.push(...(await push(db, user, mutations.slice(i, i + size))));
    return results;
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema });
    await db.insert(schema.users).values([
      { id: ME, email: `split-${ME}@test.local`, passwordDigest: 'x', storageBucket: null },
      { id: TWIN, email: `split-${TWIN}@test.local`, passwordDigest: 'x', storageBucket: null },
    ]);
  });
  afterAll(async () => {
    await clear(ME);
    await clear(TWIN);
    await db.delete(schema.users).where(inArray(schema.users.id, [ME, TWIN]));
    await pool.end();
  });

  // A seeded run of mutations over more rows than one statement writes: inserts naming some fields,
  // later edits of the same rows far apart (so their merges straddle a statement boundary), upper-case
  // ids, purges and restores.
  function seededMutations(seed: number, rows: number, edits: number) {
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
    const records = Array.from({ length: rows }, () => asset());
    const mutations: PushMutation[] = records.map((r, i) =>
      i % 3 === 0 ? whole(r) : at({ ...r, notes: `first${i}` }, 1000, ['notes']),
    );
    let now = 2000;
    for (let i = 0; i < edits; i++) {
      now += 3;
      const clock = now - (rand() < 0.3 ? Math.floor(rand() * 500) : 0);
      const record: Rec = { ...pick(records), updatedAt: clock };
      const change = pick(['notes', 'isFavorite', 'delete', 'restore', 'purge', 'whole'] as const);
      if (rand() < 0.2) record.id = record.id.toUpperCase();
      if (change === 'notes') mutations.push(at({ ...record, notes: `n${i}` }, clock, ['notes']));
      else if (change === 'isFavorite')
        mutations.push(at({ ...record, isFavorite: rand() < 0.5 }, clock, ['isFavorite']));
      else if (change === 'delete') mutations.push(at({ ...record, deletedAt: clock }, clock, ['deletedAt']));
      else if (change === 'restore') mutations.push(at({ ...record, deletedAt: null }, clock, ['deletedAt']));
      else if (change === 'purge')
        mutations.push(at({ ...record, deletedAt: clock - 1, purgedAt: clock }, clock, ['deletedAt', 'purgedAt']));
      else mutations.push(whole({ ...record, notes: `w${i}` }));
    }
    return mutations;
  }

  it('one push of 9,000 mutations over 3 statements per collection: as pushed in the client’s batches of 500', async () => {
    expect(rowsPerStatement('assets')).toBeLessThan(3000);
    const mutations = seededMutations(5, 7000, 2000);
    const giant = await push(db, ME, mutations);
    const batched = await inBatches(TWIN, mutations, 500);
    expect(wire(giant)).toEqual(wire(batched));
    await expectSameRows('assets');
    await clear(ME);
    await clear(TWIN);
  }, 180_000);

  it('a row error in the last statement of a split push: every other row as in batches of 500, the row alone rejected', async () => {
    const BAD = 'rejected by test_split_notes';
    await pool.query('ALTER TABLE assets DROP CONSTRAINT IF EXISTS test_split_notes');
    await pool.query(
      `ALTER TABLE assets ADD CONSTRAINT test_split_notes CHECK (notes IS DISTINCT FROM '${BAD}') NOT VALID`,
    );
    try {
      const mutations = seededMutations(9, 6000, 1000);
      const x = asset();
      mutations.push(whole(x));
      mutations.push(at({ ...x, updatedAt: 9_000_000, notes: BAD }, 9_000_000, ['notes']));
      mutations.push(at({ ...x, updatedAt: 9_000_001, isFavorite: true }, 9_000_001, ['isFavorite']));
      const giant = await push(db, ME, mutations);
      const batched = await inBatches(TWIN, mutations, 500);
      expect(giant.at(-2)).toMatchObject({ status: 'rejected', reason: 'db:23514' });
      expect(wire(giant)).toEqual(wire(batched));
      await expectSameRows('assets');
    } finally {
      await pool.query('ALTER TABLE assets DROP CONSTRAINT test_split_notes');
      await clear(ME);
      await clear(TWIN);
    }
  }, 300_000);

  it('a pull after a split push delivers every row once, in server_seq order, and a replay moves none', async () => {
    const mutations = seededMutations(13, 7000, 500);
    await push(db, ME, mutations);
    const seqs = async () => {
      const rows = await db
        .select({ id: schema.assets.id, serverSeq: schema.assets.serverSeq })
        .from(schema.assets)
        .where(eq(schema.assets.userId, ME));
      return new Map(rows.map((row) => [row.id, row.serverSeq]));
    };
    const before = await seqs();
    expect(new Set(before.values()).size).toBe(7000);
    let cursor = 0;
    const seen: string[] = [];
    for (;;) {
      const page = await pull(db, ME, { cursor, limit: 1000 });
      for (const record of page.changes.assets!.records) seen.push(record.id as string);
      expect(page.cursor).toBeGreaterThanOrEqual(cursor);
      cursor = page.cursor;
      if (!page.hasMore) break;
    }
    expect(seen).toHaveLength(7000);
    expect(new Set(seen).size).toBe(7000);
    const order = seen.map((id) => before.get(id)!);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // The whole push again: every merge a no-op, no row written.
    const replay = await push(db, ME, mutations);
    expect(replay.filter((r) => r.status === 'rejected')).toEqual([]);
    expect(await seqs()).toEqual(before);
    await clear(ME);
  }, 180_000);

  it('a push of 70,000 edges reads in two statements: the ids on both sides of the split merge right', async () => {
    const edges = Array.from({ length: 70_000 }, () => edge());
    const first = await push(
      db,
      ME,
      edges.map((r) => whole(r, 'album_assets')),
    );
    expect(first.filter((r) => r.status !== 'applied')).toEqual([]);
    // Edits of the ids around index 65,534 (the read's split), each twice, older second, and the rest replayed.
    const around = [0, 65_532, 65_533, 65_534, 65_535, 69_999];
    const mutations: PushMutation[] = edges.map((r) => whole(r, 'album_assets'));
    for (const i of around) {
      mutations.push(at({ ...edges[i]!, updatedAt: 3000, position: `z${i}` }, 3000, ['position'], 'album_assets'));
      mutations.push(at({ ...edges[i]!, updatedAt: 2000, position: `y${i}` }, 2000, ['position'], 'album_assets'));
    }
    const results = await push(db, ME, mutations);
    expect(results.slice(0, 70_000).filter((r) => r.status !== 'applied')).toEqual([]);
    expect(results.slice(70_000).map((r) => r.status)).toEqual(around.flatMap(() => ['applied', 'skipped-lww']));
    const stored = await db
      .select({ id: schema.albumAssets.id, position: schema.albumAssets.position })
      .from(schema.albumAssets)
      .where(
        and(
          eq(schema.albumAssets.userId, ME),
          inArray(
            schema.albumAssets.id,
            around.map((i) => edges[i]!.id),
          ),
        ),
      );
    expect(new Map(stored.map((row) => [row.id, row.position]))).toEqual(
      new Map(around.map((i) => [edges[i]!.id, `z${i}`])),
    );
    await clear(ME);
  }, 300_000);

  it('a library of 10,000 photos, 300 albums of 40 and 200 posts, each collection pushed whole, twice: the same rows, nothing moved', async () => {
    const assets = Array.from({ length: 10_000 }, (_, i) =>
      asset({
        mediaLibraryAssetId: `m${i}`,
        filename: `${i}.jpg`,
        thumbnailFilename: `t${i}.jpg`,
        isFavorite: i % 7 === 0,
        deletedAt: i % 11 === 0 ? 2500 : null,
        createdAt: 1000 + i,
        updatedAt: 2000 + i,
      }),
    );
    const albums = Array.from({ length: 300 }, (_, i) => ({
      id: randomUUID(),
      createdAt: 1000,
      updatedAt: 3000 + i,
      deletedAt: i % 13 === 0 ? 3500 : null,
      name: `Album ${i}`,
      isFavorite: false,
      archivedAt: null,
      showInPostSuggestionsAfter: null,
      oldCollectionName: null,
      notes: null,
      sortOrder: null,
      smartAlbumType: null,
      position: null,
    }));
    const posts = Array.from({ length: 200 }, (_, i) => ({
      id: randomUUID(),
      createdAt: 1000,
      updatedAt: 4000 + i,
      deletedAt: null,
      text: `post ${i}`,
      isFavorite: false,
      postedAt: null,
      rePostId: null,
      isIgnoredForRepost: false,
      suggestRepostAt: 0,
      hasBeenReposted: false,
    }));
    const albumEdges = albums.flatMap((album, i) =>
      Array.from({ length: 40 }, (_, j) =>
        edge({ albumId: album.id, assetId: assets[(i * 40 + j) % assets.length]!.id, position: `a${j}` }),
      ),
    );
    const postEdges = posts.flatMap((post, i) =>
      Array.from({ length: 5 }, (_, j) => {
        const { albumId: _a, ...rest } = edge({ assetId: assets[i * 5 + j]!.id, position: `a${j}` });
        return { ...rest, postId: post.id };
      }),
    );
    const library: [string, Rec[]][] = [
      ['assets', assets],
      ['albums', albums],
      ['posts', posts],
      ['album_assets', albumEdges],
      ['post_assets', postEdges],
    ];
    const pushAll = async () => {
      const counts: Record<string, Record<string, number>> = {};
      for (const [collection, records] of library) {
        const results = await push(
          db,
          ME,
          records.map((record) => whole(record, collection)),
        );
        counts[collection] = {};
        for (const { status } of results) counts[collection]![status] = (counts[collection]![status] ?? 0) + 1;
      }
      return counts;
    };
    const first = await pushAll();
    expect(first).toEqual({
      assets: { applied: 10_000 },
      albums: { applied: 300 },
      posts: { applied: 200 },
      album_assets: { applied: 12_000 },
      post_assets: { applied: 1000 },
    });
    const seqs = async () =>
      (
        await db
          .select({ id: schema.assets.id, serverSeq: schema.assets.serverSeq, updatedAt: schema.assets.updatedAt })
          .from(schema.assets)
          .where(eq(schema.assets.userId, ME))
      ).sort((a, b) => a.id.localeCompare(b.id));
    const before = await seqs();
    expect(await pushAll()).toEqual(first);
    expect(await seqs()).toEqual(before);
    await clear(ME);
  }, 180_000);

  // Insert clocks: an insert naming only some fields is clocked as it is written, so a batch
  // holding it and later edits of the row merges as one push per mutation, whatever the batch sizes.
  it('seeded runs with inserts naming some fields, split at random, merge as one push per mutation', async () => {
    const THIRD = randomUUID();
    await db
      .insert(schema.users)
      .values({ id: THIRD, email: `split-${THIRD}@test.local`, passwordDigest: 'x', storageBucket: null });
    try {
      for (let round = 0; round < 8; round++) {
        let seed = 1000 + round;
        const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
        const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
        const assets = Array.from({ length: 10 }, () => asset({ updatedAt: 1000 + Math.floor(rand() * 5000) }));
        const mutations: PushMutation[] = [];
        const seen = new Set<string>();
        for (let i = 0; i < 300; i++) {
          const base = pick(assets);
          const clock = 1000 + Math.floor(rand() * 8000);
          const record: Rec = { ...base, updatedAt: clock };
          let fields: string[];
          const change = pick(['notes', 'isFavorite', 'delete', 'restore', 'purge', 'flags'] as const);
          if (change === 'notes') ((record.notes = pick([null, 'x', `n${i}`])), (fields = ['notes']));
          else if (change === 'isFavorite') ((record.isFavorite = rand() < 0.5), (fields = ['isFavorite']));
          else if (change === 'delete') ((record.deletedAt = clock), (fields = ['deletedAt']));
          else if (change === 'restore') ((record.deletedAt = null), (fields = ['deletedAt']));
          else if (change === 'flags') ((record.isSynced = rand() < 0.5), (fields = ['isSynced']));
          else ((record.deletedAt = clock - 3), (record.purgedAt = clock), (fields = ['deletedAt', 'purgedAt']));
          if (rand() < 0.2) record.id = record.id.toUpperCase();
          const first = !seen.has(record.id.toLowerCase());
          seen.add(record.id.toLowerCase());
          // A first push names only the fields of its edit (a row the server lost, say), or none at all.
          if (rand() < (first ? 0.3 : 0.15)) mutations.push(whole(record));
          else mutations.push(at(record, clock - (rand() < 0.3 ? Math.floor(rand() * 50) : 0), fields));
        }
        const giant = await push(db, ME, mutations);
        const split: PushResult[] = [];
        for (let i = 0; i < mutations.length;) {
          const size = 1 + Math.floor(rand() * 40);
          split.push(...(await push(db, TWIN, mutations.slice(i, i + size))));
          i += size;
        }
        const single: PushResult[] = [];
        for (const mutation of mutations) single.push(...(await push(db, THIRD, [mutation])));
        expect(wire(giant), `round ${round}`).toEqual(wire(single));
        expect(wire(split), `round ${round}`).toEqual(wire(single));
        await expectSameRows('assets');
        const third = await rowsOf('assets', THIRD);
        for (const [id, row] of await rowsOf('assets', ME)) expect(row, id).toEqual(third.get(id));
      }
    } finally {
      await clear(ME);
      await clear(TWIN);
      await clear(THIRD);
      await db.delete(schema.users).where(eq(schema.users.id, THIRD));
    }
  }, 120_000);
});
