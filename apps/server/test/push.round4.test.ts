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

// Round 4 (adversarial): the one multi-row upsert per collection, against the same pushes one by
// one; duplicate ids, the savepoint fallback, server_seq per row, the upsert's guard, upper-case ids.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

type Db = ReturnType<typeof drizzle<typeof schema>>;
type Rec = Record<string, any> & { id: string; updatedAt: number };

d('push, round 4 (adversarial): one upsert per collection', () => {
  let pool: pg.Pool;
  let db: Db;
  // Users of their own, so another test file on the same Postgres never meets them.
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
    ...over,
  });
  const album = (over: Record<string, unknown> = {}): Rec => ({
    id: randomUUID(),
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null,
    name: 'A',
    isFavorite: false,
    archivedAt: null,
    showInPostSuggestionsAfter: null,
    oldCollectionName: null,
    notes: null,
    sortOrder: null,
    smartAlbumType: null,
    position: null,
    ...over,
  });
  const whole = (record: Rec, collection = 'assets'): PushMutation => ({ collection, record });
  const at = (record: Rec, clock: number, fields: string[], collection = 'assets'): PushMutation => ({
    collection,
    record,
    fields: Object.fromEntries(fields.map((field) => [field, clock])),
  });
  async function raw(collection: string, id: string, user = ME) {
    const table = serverCollections[collection]!.table as any;
    const [row] = await db
      .select()
      .from(table)
      .where(and(eq(table.userId, user), eq(table.id, id)));
    return row as Record<string, any> | undefined;
  }
  // The rows of both users, without what differs between users by construction.
  async function sameRows(collection: string, ids: string[]) {
    for (const id of ids) {
      const { userId: _a, serverSeq: _b, ...mine } = (await raw(collection, id.toLowerCase(), ME)) ?? {};
      const { userId: _c, serverSeq: _d, ...twin } = (await raw(collection, id.toLowerCase(), TWIN)) ?? {};
      expect(mine, `${collection} ${id}`).toEqual(twin);
    }
  }
  const wire = (results: PushResult[]) => results.map((result) => JSON.stringify(result));
  async function batchedAndOneByOne(mutations: PushMutation[]) {
    const batched = await push(db, ME, mutations);
    const single: PushResult[] = [];
    for (const mutation of mutations) single.push(...(await push(db, TWIN, [mutation])));
    return { batched, single };
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema });
    await db.insert(schema.users).values([
      { id: ME, email: `r4-${ME}@test.local`, passwordDigest: 'x', storageBucket: null },
      { id: TWIN, email: `r4-${TWIN}@test.local`, passwordDigest: 'x', storageBucket: null },
    ]);
  });
  afterAll(async () => {
    for (const table of [schema.albumAssets, schema.postAssets, schema.posts, schema.albums, schema.assets])
      await db.delete(table).where(inArray(table.userId, [ME, TWIN]));
    await db.delete(schema.users).where(inArray(schema.users.id, [ME, TWIN]));
    await pool.end();
  });

  // BUG (round 4): a new record is written with a clock for every field (writeRows gives each field
  // without a sent clock the row's updated_at, and that's what the next push reads back), but the
  // batch keeps only the sent fields' clocks in memory (mergeRecord's insert branch). So a second
  // mutation of that record in the same batch finds no clock for the other fields (0) and applies an
  // edit older than the insert, which the same push one by one rejects. push.ts applyMutations →
  // `stored.set(key, after)` with `merged.clocks` from mergeRecord's `!stored` branch.
  it.fails(
    'an insert naming some fields, then an older edit of another field in the same batch: as pushed one by one',
    async () => {
      const r = asset({ updatedAt: 2000, notes: 'new' });
      const mutations = [
        at(r, 2000, ['notes']), // a record the server doesn't have, sent with the fields its edit changed
        at({ ...r, updatedAt: 1500, isFavorite: true }, 1500, ['isFavorite']), // older than the insert
      ];
      const { batched, single } = await batchedAndOneByOne(mutations);
      expect(single.map((result) => result.status)).toEqual(['applied', 'skipped-lww']);
      expect(wire(batched)).toEqual(wire(single));
      await sameRows('assets', [r.id]);
    },
  );

  it('a whole-record insert, then an older edit in the same batch: as pushed one by one', async () => {
    const r = asset({ updatedAt: 2000 });
    const mutations = [whole(r), at({ ...r, updatedAt: 1500, isFavorite: true }, 1500, ['isFavorite'])];
    const { batched, single } = await batchedAndOneByOne(mutations);
    expect(wire(batched)).toEqual(wire(single));
    await sameRows('assets', [r.id]);
  });

  it('one id in upper and lower case in one batch is one row, written once, with one server_seq', async () => {
    const r = asset({ notes: 'a' });
    await push(db, ME, [whole(r)]);
    const before = (await raw('assets', r.id))!.serverSeq;
    const upper = r.id.toUpperCase();
    const results = await push(db, ME, [
      at({ ...r, id: upper, updatedAt: 2000, notes: 'b' }, 2000, ['notes']),
      at({ ...r, updatedAt: 3000, isFavorite: true }, 3000, ['isFavorite']),
      at({ ...r, id: upper, updatedAt: 2500, notes: 'older' }, 2500, ['notes']), // newer than 2000: applies
    ]);
    expect(results.map(({ id, status }) => [id, status])).toEqual([
      [upper, 'applied'],
      [r.id, 'applied'],
      [upper, 'applied'],
    ]);
    const row = (await raw('assets', r.id))!;
    expect(row).toMatchObject({ notes: 'older', isFavorite: true, updatedAt: 3000 });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM assets WHERE user_id = $1 AND id = $2', [
      ME,
      r.id,
    ]);
    expect(rows[0].n).toBe(1);
    // One write: the pull sees one new server_seq for it, after the old one.
    const page = await pull(db, ME, { cursor: before });
    expect(page.changes.assets!.records.map((record) => record.id)).toEqual([r.id]);
    expect(row.serverSeq).toBeGreaterThan(before);
  });

  it('a new record sent twice in one batch, in upper case first: inserted once, in lower case, both applied', async () => {
    const r = asset({ notes: 'first' });
    const results = await push(db, ME, [
      whole({ ...r, id: r.id.toUpperCase() }),
      at({ ...r, updatedAt: 2000, notes: 'second' }, 2000, ['notes']),
    ]);
    expect(results.map((result) => result.status)).toEqual(['applied', 'applied']);
    expect(await raw('assets', r.id)).toMatchObject({ id: r.id, notes: 'second', updatedAt: 2000 });
  });

  it('each row of a batch gets its own server_seq, and a lost or replayed mutation none', async () => {
    const rows = Array.from({ length: 5 }, () => asset());
    await push(
      db,
      ME,
      rows.map((r) => whole(r)),
    );
    const seqs = new Map<string, number>();
    for (const r of rows) seqs.set(r.id, (await raw('assets', r.id))!.serverSeq);
    const results = await push(db, ME, [
      at({ ...rows[0]!, updatedAt: 2000, notes: 'x' }, 2000, ['notes']), // applies
      at({ ...rows[1]!, updatedAt: 900, notes: 'x' }, 900, ['notes']), // loses
      whole(rows[2]!), // a replay
      at({ ...rows[3]!, updatedAt: 2000, notes: 'x', isFavorite: true }, 2000, ['notes']), // applies, favorite not sent
      at({ ...rows[4]!, updatedAt: 2000, notes: 'y' }, 2000, ['notes']),
      at({ ...rows[4]!, updatedAt: 2100, notes: 'z' }, 2100, ['notes']),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'applied',
      'skipped-lww',
      'applied',
      'applied',
      'applied',
      'applied',
    ]);
    const after = new Map<string, number>();
    for (const r of rows) after.set(r.id, (await raw('assets', r.id))!.serverSeq);
    expect(after.get(rows[1]!.id)).toBe(seqs.get(rows[1]!.id));
    expect(after.get(rows[2]!.id)).toBe(seqs.get(rows[2]!.id));
    const moved = [rows[0]!, rows[3]!, rows[4]!].map((r) => after.get(r.id)!);
    expect(new Set(moved).size).toBe(3);
    for (const seq of moved) expect(seq).toBeGreaterThan(Math.max(...seqs.values()));
    expect(await raw('assets', rows[3]!.id)).toMatchObject({ notes: 'x', isFavorite: false });
    expect(await raw('assets', rows[4]!.id)).toMatchObject({ notes: 'z' });
  });

  // The fallback after a row error reruns the batch one savepoint per row: every other row, a twice
  // merged one included, gets the result and row it gets pushed one by one.
  it('a database error in a batch with duplicates: the fallback gets the one-by-one results', async () => {
    const BAD = 'rejected by test_r4_notes';
    await pool.query('ALTER TABLE assets DROP CONSTRAINT IF EXISTS test_r4_notes');
    await pool.query(
      `ALTER TABLE assets ADD CONSTRAINT test_r4_notes CHECK (notes IS DISTINCT FROM '${BAD}') NOT VALID`,
    );
    try {
      const a = asset();
      const b = asset({ notes: 'b' });
      await push(db, ME, [whole(a), whole(b)]);
      await push(db, TWIN, [whole(a), whole(b)]);
      const c = asset();
      const mutations = [
        at({ ...a, updatedAt: 2000, notes: BAD }, 2000, ['notes']), // fails
        at({ ...a, updatedAt: 2100, isFavorite: true }, 2100, ['isFavorite']), // applies on the stored row
        at({ ...a, updatedAt: 1900, notes: 'older' }, 1900, ['notes']), // newer than the stored notes clock
        at({ ...b, updatedAt: 2000, notes: 'b2' }, 2000, ['notes']),
        at({ ...b, updatedAt: 1500, notes: 'b-old' }, 1500, ['notes']),
        whole(c),
        at({ ...c, updatedAt: 3000, notes: BAD }, 3000, ['notes']), // fails on a row inserted in this batch
        at({ ...c, updatedAt: 3100, isFavorite: true }, 3100, ['isFavorite']),
      ];
      const { batched, single } = await batchedAndOneByOne(mutations);
      expect(single.map((result) => result.reason ?? result.status)).toEqual([
        'db:23514',
        'applied',
        'applied',
        'applied',
        'skipped-lww',
        'applied',
        'db:23514',
        'applied',
      ]);
      expect(wire(batched)).toEqual(wire(single));
      await sameRows('assets', [a.id, b.id, c.id]);
    } finally {
      await pool.query('ALTER TABLE assets DROP CONSTRAINT test_r4_notes');
    }
  });

  it('the guard: a purge and pushes after it in one batch leave the row purged, its updated_at never set back', async () => {
    const r = asset({ updatedAt: 5000, deletedAt: 5000 });
    await push(db, ME, [whole(r)]);
    const pair = ['deletedAt', 'purgedAt'];
    const results = await push(db, ME, [
      at({ ...r, updatedAt: 6000, purgedAt: 6000 }, 6000, pair),
      at({ ...r, updatedAt: 7000, deletedAt: null }, 7000, pair), // a restore after the purge loses
      whole({ ...r, updatedAt: 8000, notes: 'late', deletedAt: null }), // an old app's newer record too
      at({ ...r, updatedAt: 9000, isFavorite: true }, 9000, ['isFavorite']),
    ]);
    expect(results.map((result) => result.status)).toEqual(['applied', 'skipped-lww', 'skipped-lww', 'skipped-lww']);
    for (const result of results.slice(1))
      expect(result.current).toMatchObject({ deletedAt: 5000, purgedAt: 6000, notes: null, isFavorite: false });
    expect(await raw('assets', r.id)).toMatchObject({ deletedAt: 5000, purgedAt: 6000, updatedAt: 6000 });
  });

  // An edit of one field at a clock below the row's updated_at (another field is newer) is a legitimate
  // write: the guard (stored updated_at <= sent) must let it through.
  it('the guard lets an older-clocked field through when another field holds the newest clock', async () => {
    const r = asset();
    await push(db, ME, [whole(r)]);
    await push(db, ME, [at({ ...r, updatedAt: 5000, notes: 'newest' }, 5000, ['notes'])]);
    const [result] = await push(db, ME, [at({ ...r, updatedAt: 3000, isFavorite: true }, 3000, ['isFavorite'])]);
    expect(result!.status).toBe('applied');
    expect(await raw('assets', r.id)).toMatchObject({ notes: 'newest', isFavorite: true, updatedAt: 5000 });
  });

  it('an album missing an optional column, pushed beside full ones in one upsert, keeps its stored value', async () => {
    const a = album({ position: 'a0' });
    const b = album({ position: 'b0' });
    await push(db, ME, [whole(a, 'albums'), whole(b, 'albums')]);
    const { position: _p, ...withoutPosition }: Rec = { ...a, updatedAt: 2000, name: 'renamed' };
    const results = await push(db, ME, [
      whole(withoutPosition as Rec, 'albums'), // an older app without `position`
      at({ ...b, updatedAt: 2000, position: 'b1' }, 2000, ['position'], 'albums'),
      whole(album({ position: 'c0' }), 'albums'), // and a new one in the same upsert
    ]);
    expect(results.map((result) => result.status)).toEqual(['applied', 'applied', 'applied']);
    expect(await raw('albums', a.id)).toMatchObject({ name: 'renamed', position: 'a0' });
    expect(await raw('albums', b.id)).toMatchObject({ position: 'b1' });
  });

  it('field_clock is null exactly when every clock is updated_at, and reads back the same', async () => {
    const r = asset();
    await push(db, ME, [whole(r)]);
    expect((await raw('assets', r.id))!.fieldClock).toBeNull();
    await push(db, ME, [at({ ...r, updatedAt: 2000, notes: 'n' }, 2000, ['notes'])]);
    expect((await raw('assets', r.id))!.fieldClock).toMatchObject({ notes: 2000, isFavorite: 1000 });
    // A whole record at 3000 pins every field at 3000: null again.
    await push(db, ME, [whole({ ...r, updatedAt: 3000, notes: 'n' })]);
    expect((await raw('assets', r.id))!.fieldClock).toBeNull();
    // ...and an edit older than 3000 still loses against every field.
    const [late] = await push(db, ME, [at({ ...r, updatedAt: 2500, isFavorite: true }, 2500, ['isFavorite'])]);
    expect(late!.status).toBe('skipped-lww');
  });

  // Seeded: inserts inside the batch, partial and whole pushes, upper-case ids, several collections.
  // Batched and one by one must come to the same results and rows (the in-memory clocks of an
  // insert are the one known difference, kept out here by naming every field on an insert).
  it('seeded batches with inserts, upper-case ids and three collections merge like one by one', async () => {
    let seed = 11;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
    for (let round = 0; round < 6; round++) {
      const assets = Array.from({ length: 12 }, () => asset());
      const albums = Array.from({ length: 6 }, () => album());
      const edges = Array.from({ length: 6 }, () => ({
        id: randomUUID(),
        createdAt: 1000,
        updatedAt: 1000,
        deletedAt: null,
        albumId: pick(albums).id,
        assetId: pick(assets).id,
        position: 'a0',
      }));
      const seen = new Set<string>();
      let now = 2000;
      const mutations: PushMutation[] = [];
      for (let i = 0; i < 400; i++) {
        now += 10;
        const clock = now - (rand() < 0.25 ? Math.floor(rand() * 40) * 10 : 0);
        const kind = pick(['assets', 'assets', 'albums', 'album_assets'] as const);
        const base = kind === 'assets' ? pick(assets) : kind === 'albums' ? pick(albums) : pick(edges);
        const record: Rec = { ...base, updatedAt: clock };
        let fields: string[];
        if (kind === 'assets') {
          const change = pick(['notes', 'isFavorite', 'delete', 'restore', 'purge'] as const);
          if (change === 'notes') ((record.notes = pick([null, 'x', `n${i}`])), (fields = ['notes']));
          else if (change === 'isFavorite') ((record.isFavorite = rand() < 0.5), (fields = ['isFavorite']));
          else if (change === 'delete') ((record.deletedAt = clock), (fields = ['deletedAt', 'purgedAt']));
          else if (change === 'restore') ((record.deletedAt = null), (fields = ['deletedAt', 'purgedAt']));
          else ((record.deletedAt = clock - 5), (record.purgedAt = clock), (fields = ['deletedAt', 'purgedAt']));
        } else if (kind === 'albums') {
          const change = pick(['name', 'position', 'delete'] as const);
          if (change === 'name') ((record.name = `n${i}`), (fields = ['name']));
          else if (change === 'position') ((record.position = `p${i}`), (fields = ['position']));
          else ((record.deletedAt = rand() < 0.5 ? clock : null), (fields = ['deletedAt']));
        } else {
          const change = pick(['position', 'delete'] as const);
          if (change === 'position') ((record.position = `a${i}`), (fields = ['position']));
          else ((record.deletedAt = rand() < 0.5 ? clock : null), (fields = ['deletedAt']));
        }
        if (rand() < 0.3) record.id = record.id.toUpperCase();
        const key = `${kind}:${record.id.toLowerCase()}`;
        const first = !seen.has(key);
        seen.add(key);
        const style = first ? pick(['whole', 'every']) : pick(['fields', 'fields', 'fields', 'whole']);
        if (style === 'whole') mutations.push(whole(record, kind));
        else if (style === 'every') {
          const every = serverCollections[kind]!.mergeFields.filter((field) => field in record);
          mutations.push(at(record, clock, every, kind));
        } else mutations.push(at(record, clock, fields, kind));
      }
      const { batched, single } = await batchedAndOneByOne(mutations);
      expect(wire(batched)).toEqual(wire(single));
      await sameRows(
        'assets',
        assets.map((r) => r.id),
      );
      await sameRows(
        'albums',
        albums.map((r) => r.id),
      );
      await sameRows(
        'album_assets',
        edges.map((r) => r.id),
      );
    }
  }, 60_000);
});
