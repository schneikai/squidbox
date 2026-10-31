import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { PushMutation, PushResult } from '@squidbox/shared';
import * as schema from '../src/db/schema.js';
import { serverCollections } from '../src/sync/collections.js';
import { push } from '../src/sync/push.js';
import { pull } from '../src/sync/pull.js';
import {
  clearRows,
  db,
  expectSameRows,
  fieldPush,
  fullAssetRecord,
  inBatches,
  mut,
  rowsOf,
  USER_A,
  USER_B,
  useSyncDb,
  wire,
} from './helpers/syncDb.js';
import { REJECTED_NOTES } from './dbSetup.js';

// Pushes split into statements under Postgres' bind parameter limit. Rows
// merged twice across a statement boundary, the per-row fallback inside a split push, the read split
// at 65,534 ids, server_seq across statements, and a whole library of 10,000 photos.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

type Rec = Record<string, any> & { id: string; updatedAt: number };

const rowsPerStatement = (collection: string) => Math.floor(65_535 / serverCollections[collection]!.columnCount);

d('push: split statements', () => {
  useSyncDb();

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

  // A seeded run of mutations over more rows than one statement writes: inserts naming some fields,
  // later edits of the same rows far apart (so their merges straddle a statement boundary), upper-case
  // ids, purges and restores.
  function seededMutations(seed: number, rows: number, edits: number) {
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
    const records = Array.from({ length: rows }, () => fullAssetRecord());
    const mutations: PushMutation[] = records.map((r, i) =>
      i % 3 === 0 ? mut(r) : fieldPush({ ...r, notes: `first${i}` }, ['notes'], 1000),
    );
    let now = 2000;
    for (let i = 0; i < edits; i++) {
      now += 3;
      const clock = now - (rand() < 0.3 ? Math.floor(rand() * 500) : 0);
      const record: Rec = { ...pick(records), updatedAt: clock };
      const change = pick(['notes', 'isFavorite', 'delete', 'restore', 'purge', 'whole'] as const);
      if (rand() < 0.2) record.id = record.id.toUpperCase();
      if (change === 'notes') mutations.push(fieldPush({ ...record, notes: `n${i}` }, ['notes'], clock));
      else if (change === 'isFavorite')
        mutations.push(fieldPush({ ...record, isFavorite: rand() < 0.5 }, ['isFavorite'], clock));
      else if (change === 'delete') mutations.push(fieldPush({ ...record, deletedAt: clock }, ['deletedAt'], clock));
      else if (change === 'restore') mutations.push(fieldPush({ ...record, deletedAt: null }, ['deletedAt'], clock));
      else if (change === 'purge')
        mutations.push(
          fieldPush({ ...record, deletedAt: clock - 1, purgedAt: clock }, ['deletedAt', 'purgedAt'], clock),
        );
      else mutations.push(mut({ ...record, notes: `w${i}` }));
    }
    return mutations;
  }

  it('one push of 9,000 mutations over 3 statements per collection: as pushed in the client’s batches of 500', async () => {
    expect(rowsPerStatement('assets')).toBeLessThan(3000);
    const mutations = seededMutations(5, 7000, 2000);
    const giant = await push(db, USER_A, mutations);
    const batched = await inBatches(USER_B, mutations, 500);
    expect(wire(giant)).toEqual(wire(batched));
    await expectSameRows('assets');
  }, 180_000);

  it('a row error in the last statement of a split push: every other row as in batches of 500, the row alone rejected', async () => {
    const mutations = seededMutations(9, 6000, 1000);
    const x = fullAssetRecord();
    mutations.push(mut(x));
    mutations.push(fieldPush({ ...x, updatedAt: 9_000_000, notes: REJECTED_NOTES }, ['notes'], 9_000_000));
    mutations.push(fieldPush({ ...x, updatedAt: 9_000_001, isFavorite: true }, ['isFavorite'], 9_000_001));
    const giant = await push(db, USER_A, mutations);
    const batched = await inBatches(USER_B, mutations, 500);
    expect(giant.at(-2)).toMatchObject({ status: 'rejected', reason: 'db:23514' });
    expect(wire(giant)).toEqual(wire(batched));
    await expectSameRows('assets');
  }, 300_000);

  it('a pull after a split push delivers every row once, in server_seq order, and a replay moves none', async () => {
    const mutations = seededMutations(13, 7000, 500);
    await push(db, USER_A, mutations);
    const seqs = async () => {
      const rows = await db
        .select({ id: schema.assets.id, serverSeq: schema.assets.serverSeq })
        .from(schema.assets)
        .where(eq(schema.assets.userId, USER_A));
      return new Map(rows.map((row) => [row.id, row.serverSeq]));
    };
    const before = await seqs();
    expect(new Set(before.values()).size).toBe(7000);
    let cursor = 0;
    const seen: string[] = [];
    for (;;) {
      const page = await pull(db, USER_A, { cursor, limit: 1000 });
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
    const replay = await push(db, USER_A, mutations);
    expect(replay.filter((r) => r.status === 'rejected')).toEqual([]);
    expect(await seqs()).toEqual(before);
  }, 180_000);

  it('a push of 70,000 edges reads in two statements: the ids on both sides of the split merge right', async () => {
    const edges = Array.from({ length: 70_000 }, () => edge());
    const first = await push(
      db,
      USER_A,
      edges.map((r) => mut(r, 'album_assets')),
    );
    expect(first.filter((r) => r.status !== 'applied')).toEqual([]);
    // Edits of the ids around index 65,534 (the read's split), each twice, older second, and the rest replayed.
    const around = [0, 65_532, 65_533, 65_534, 65_535, 69_999];
    const mutations: PushMutation[] = edges.map((r) => mut(r, 'album_assets'));
    for (const i of around) {
      mutations.push(
        fieldPush({ ...edges[i]!, updatedAt: 3000, position: `z${i}` }, ['position'], 3000, 'album_assets'),
      );
      mutations.push(
        fieldPush({ ...edges[i]!, updatedAt: 2000, position: `y${i}` }, ['position'], 2000, 'album_assets'),
      );
    }
    const results = await push(db, USER_A, mutations);
    expect(results.slice(0, 70_000).filter((r) => r.status !== 'applied')).toEqual([]);
    expect(results.slice(70_000).map((r) => r.status)).toEqual(around.flatMap(() => ['applied', 'skipped-lww']));
    const stored = await db
      .select({ id: schema.albumAssets.id, position: schema.albumAssets.position })
      .from(schema.albumAssets)
      .where(
        and(
          eq(schema.albumAssets.userId, USER_A),
          inArray(
            schema.albumAssets.id,
            around.map((i) => edges[i]!.id),
          ),
        ),
      );
    expect(new Map(stored.map((row) => [row.id, row.position]))).toEqual(
      new Map(around.map((i) => [edges[i]!.id, `z${i}`])),
    );
  }, 300_000);

  it('a library of 10,000 photos, 300 albums of 40 and 200 posts, each collection pushed whole, twice: the same rows, nothing moved', async () => {
    const assets = Array.from({ length: 10_000 }, (_, i) =>
      fullAssetRecord({
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
          USER_A,
          records.map((record) => mut(record, collection)),
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
          .where(eq(schema.assets.userId, USER_A))
      ).sort((a, b) => a.id.localeCompare(b.id));
    const before = await seqs();
    expect(await pushAll()).toEqual(first);
    expect(await seqs()).toEqual(before);
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
        const assets = Array.from({ length: 10 }, () =>
          fullAssetRecord({ updatedAt: 1000 + Math.floor(rand() * 5000) }),
        );
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
          if (rand() < (first ? 0.3 : 0.15)) mutations.push(mut(record));
          else mutations.push(fieldPush(record, fields, clock - (rand() < 0.3 ? Math.floor(rand() * 50) : 0)));
        }
        const giant = await push(db, USER_A, mutations);
        const split: PushResult[] = [];
        for (let i = 0; i < mutations.length;) {
          const size = 1 + Math.floor(rand() * 40);
          split.push(...(await push(db, USER_B, mutations.slice(i, i + size))));
          i += size;
        }
        const single: PushResult[] = [];
        for (const mutation of mutations) single.push(...(await push(db, THIRD, [mutation])));
        expect(wire(giant), `round ${round}`).toEqual(wire(single));
        expect(wire(split), `round ${round}`).toEqual(wire(single));
        await expectSameRows('assets');
        const third = await rowsOf('assets', THIRD);
        for (const [id, row] of await rowsOf('assets', USER_A)) expect(row, id).toEqual(third.get(id));
      }
    } finally {
      await clearRows([THIRD]);
      await db.delete(schema.users).where(eq(schema.users.id, THIRD));
    }
  }, 120_000);
});
