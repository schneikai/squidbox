import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PushMutation } from '@squidbox/shared';
import { serverCollections } from '../src/sync/collections.js';
import { push } from '../src/sync/push.js';
import { pull } from '../src/sync/pull.js';
import {
  albumRecord,
  batchedAndOneByOne,
  db,
  expectSameRows,
  fieldPush,
  fullAssetRecord,
  mut,
  pool,
  rowOf,
  USER_A,
  USER_B,
  useSyncDb,
  wire,
} from './helpers/syncDb.js';
import { REJECTED_NOTES } from './dbSetup.js';

// The one multi-row upsert per collection, against the same pushes one by
// one; duplicate ids, the savepoint fallback, server_seq per row, the upsert's guard, upper-case ids.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

type Rec = Record<string, any> & { id: string; updatedAt: number };

d('push: one upsert per collection', () => {
  useSyncDb();

  // A new record is written with a clock for every field (a sent one, or its updated_at), and the batch
  // keeps the same clocks in memory (mergeRecord's insert branch), so a second mutation of it in the
  // same batch merges as it would pushed alone.
  it('an insert naming some fields, then an older edit of another field in the same batch: as pushed one by one', async () => {
    const r = fullAssetRecord({ updatedAt: 2000, notes: 'new' });
    const mutations = [
      fieldPush(r, ['notes'], 2000), // a record the server doesn't have, sent with the fields its edit changed
      fieldPush({ ...r, updatedAt: 1500, isFavorite: true }, ['isFavorite'], 1500), // older than the insert
    ];
    const { batched, single } = await batchedAndOneByOne(mutations);
    expect(single.map((result) => result.status)).toEqual(['applied', 'skipped-lww']);
    expect(wire(batched)).toEqual(wire(single));
    await expectSameRows('assets', [r.id]);
  });

  it('a whole-record insert, then an older edit in the same batch: as pushed one by one', async () => {
    const r = fullAssetRecord({ updatedAt: 2000 });
    const mutations = [mut(r), fieldPush({ ...r, updatedAt: 1500, isFavorite: true }, ['isFavorite'], 1500)];
    const { batched, single } = await batchedAndOneByOne(mutations);
    expect(wire(batched)).toEqual(wire(single));
    await expectSameRows('assets', [r.id]);
  });

  it('one id in upper and lower case in one batch is one row, written once, with one server_seq', async () => {
    const r = fullAssetRecord({ notes: 'a' });
    await push(db, USER_A, [mut(r)]);
    const before = (await rowOf(r.id))!.serverSeq;
    const upper = r.id.toUpperCase();
    const results = await push(db, USER_A, [
      fieldPush({ ...r, id: upper, updatedAt: 2000, notes: 'b' }, ['notes'], 2000),
      fieldPush({ ...r, updatedAt: 3000, isFavorite: true }, ['isFavorite'], 3000),
      fieldPush({ ...r, id: upper, updatedAt: 2500, notes: 'older' }, ['notes'], 2500), // newer than 2000: applies
    ]);
    expect(results.map(({ id, status }) => [id, status])).toEqual([
      [upper, 'applied'],
      [r.id, 'applied'],
      [upper, 'applied'],
    ]);
    const row = (await rowOf(r.id))!;
    expect(row).toMatchObject({ notes: 'older', isFavorite: true, updatedAt: 3000 });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM assets WHERE user_id = $1 AND id = $2', [
      USER_A,
      r.id,
    ]);
    expect(rows[0].n).toBe(1);
    // One write: the pull sees one new server_seq for it, after the old one.
    const page = await pull(db, USER_A, { cursor: before });
    expect(page.changes.assets!.records.map((record) => record.id)).toEqual([r.id]);
    expect(row.serverSeq).toBeGreaterThan(before);
  });

  it('a new record sent twice in one batch, in upper case first: inserted once, in lower case, both applied', async () => {
    const r = fullAssetRecord({ notes: 'first' });
    const results = await push(db, USER_A, [
      mut({ ...r, id: r.id.toUpperCase() }),
      fieldPush({ ...r, updatedAt: 2000, notes: 'second' }, ['notes'], 2000),
    ]);
    expect(results.map((result) => result.status)).toEqual(['applied', 'applied']);
    expect(await rowOf(r.id)).toMatchObject({ id: r.id, notes: 'second', updatedAt: 2000 });
  });

  it('each row of a batch gets its own server_seq, and a lost or replayed mutation none', async () => {
    const rows = Array.from({ length: 5 }, () => fullAssetRecord());
    await push(
      db,
      USER_A,
      rows.map((r) => mut(r)),
    );
    const seqs = new Map<string, number>();
    for (const r of rows) seqs.set(r.id, (await rowOf(r.id))!.serverSeq);
    const results = await push(db, USER_A, [
      fieldPush({ ...rows[0]!, updatedAt: 2000, notes: 'x' }, ['notes'], 2000), // applies
      fieldPush({ ...rows[1]!, updatedAt: 900, notes: 'x' }, ['notes'], 900), // loses
      mut(rows[2]!), // a replay
      fieldPush({ ...rows[3]!, updatedAt: 2000, notes: 'x', isFavorite: true }, ['notes'], 2000), // applies, favorite not sent
      fieldPush({ ...rows[4]!, updatedAt: 2000, notes: 'y' }, ['notes'], 2000),
      fieldPush({ ...rows[4]!, updatedAt: 2100, notes: 'z' }, ['notes'], 2100),
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
    for (const r of rows) after.set(r.id, (await rowOf(r.id))!.serverSeq);
    expect(after.get(rows[1]!.id)).toBe(seqs.get(rows[1]!.id));
    expect(after.get(rows[2]!.id)).toBe(seqs.get(rows[2]!.id));
    const moved = [rows[0]!, rows[3]!, rows[4]!].map((r) => after.get(r.id)!);
    expect(new Set(moved).size).toBe(3);
    for (const seq of moved) expect(seq).toBeGreaterThan(Math.max(...seqs.values()));
    expect(await rowOf(rows[3]!.id)).toMatchObject({ notes: 'x', isFavorite: false });
    expect(await rowOf(rows[4]!.id)).toMatchObject({ notes: 'z' });
  });

  // The fallback after a row error reruns the batch one savepoint per row: every other row, a twice
  // merged one included, gets the result and row it gets pushed one by one.
  it('a database error in a batch with duplicates: the fallback gets the one-by-one results', async () => {
    const a = fullAssetRecord();
    const b = fullAssetRecord({ notes: 'b' });
    await push(db, USER_A, [mut(a), mut(b)]);
    await push(db, USER_B, [mut(a), mut(b)]);
    const c = fullAssetRecord();
    const mutations = [
      fieldPush({ ...a, updatedAt: 2000, notes: REJECTED_NOTES }, ['notes'], 2000), // fails
      fieldPush({ ...a, updatedAt: 2100, isFavorite: true }, ['isFavorite'], 2100), // applies on the stored row
      fieldPush({ ...a, updatedAt: 1900, notes: 'older' }, ['notes'], 1900), // newer than the stored notes clock
      fieldPush({ ...b, updatedAt: 2000, notes: 'b2' }, ['notes'], 2000),
      fieldPush({ ...b, updatedAt: 1500, notes: 'b-old' }, ['notes'], 1500),
      mut(c),
      fieldPush({ ...c, updatedAt: 3000, notes: REJECTED_NOTES }, ['notes'], 3000), // fails on a row inserted in this batch
      fieldPush({ ...c, updatedAt: 3100, isFavorite: true }, ['isFavorite'], 3100),
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
    await expectSameRows('assets', [a.id, b.id, c.id]);
  });

  it('the guard: a purge and pushes after it in one batch leave the row purged, its updated_at never set back', async () => {
    const r = fullAssetRecord({ updatedAt: 5000, deletedAt: 5000 });
    await push(db, USER_A, [mut(r)]);
    const pair = ['deletedAt', 'purgedAt'];
    const results = await push(db, USER_A, [
      fieldPush({ ...r, updatedAt: 6000, purgedAt: 6000 }, pair, 6000),
      fieldPush({ ...r, updatedAt: 7000, deletedAt: null }, pair, 7000), // a restore after the purge loses
      mut({ ...r, updatedAt: 8000, notes: 'late', deletedAt: null }), // a whole-record app's newer record too
      fieldPush({ ...r, updatedAt: 9000, isFavorite: true }, ['isFavorite'], 9000),
    ]);
    expect(results.map((result) => result.status)).toEqual(['applied', 'skipped-lww', 'skipped-lww', 'skipped-lww']);
    for (const result of results.slice(1))
      expect(result.current).toMatchObject({ deletedAt: 5000, purgedAt: 6000, notes: null, isFavorite: false });
    expect(await rowOf(r.id)).toMatchObject({ deletedAt: 5000, purgedAt: 6000, updatedAt: 6000 });
  });

  // An edit of one field at a clock below the row's updated_at (another field is newer) is a legitimate
  // write: the guard (stored updated_at <= sent) must let it through.
  it('the guard lets an older-clocked field through when another field holds the newest clock', async () => {
    const r = fullAssetRecord();
    await push(db, USER_A, [mut(r)]);
    await push(db, USER_A, [fieldPush({ ...r, updatedAt: 5000, notes: 'newest' }, ['notes'], 5000)]);
    const [result] = await push(db, USER_A, [
      fieldPush({ ...r, updatedAt: 3000, isFavorite: true }, ['isFavorite'], 3000),
    ]);
    expect(result!.status).toBe('applied');
    expect(await rowOf(r.id)).toMatchObject({ notes: 'newest', isFavorite: true, updatedAt: 5000 });
  });

  it('an album missing an optional column, pushed beside full ones in one upsert, keeps its stored value', async () => {
    const a = albumRecord({ position: 'a0' });
    const b = albumRecord({ position: 'b0' });
    await push(db, USER_A, [mut(a, 'albums'), mut(b, 'albums')]);
    const { position: _p, ...withoutPosition }: Rec = { ...a, updatedAt: 2000, name: 'renamed' };
    const results = await push(db, USER_A, [
      mut(withoutPosition as Rec, 'albums'), // an app without `position`
      fieldPush({ ...b, updatedAt: 2000, position: 'b1' }, ['position'], 2000, 'albums'),
      mut(albumRecord({ position: 'c0' }), 'albums'), // and a new one in the same upsert
    ]);
    expect(results.map((result) => result.status)).toEqual(['applied', 'applied', 'applied']);
    expect(await rowOf(a.id, { collection: 'albums' })).toMatchObject({ name: 'renamed', position: 'a0' });
    expect(await rowOf(b.id, { collection: 'albums' })).toMatchObject({ position: 'b1' });
  });

  // One push reads its records and writes each collection in as many statements as Postgres' 65,535
  // bind parameters need, so one push of a whole collection takes any size.
  it('one push takes a library of 5,000 photos', async () => {
    const results = await push(
      db,
      USER_A,
      Array.from({ length: 5000 }, (_, i) =>
        mut(fullAssetRecord({ filename: `${i}.jpg`, thumbnailFilename: `t${i}.jpg` })),
      ),
    );
    expect(results.filter((r) => r.status === 'applied')).toHaveLength(5000);
  }, 60_000);

  it('field_clock is null exactly when every clock is updated_at, and reads back the same', async () => {
    const r = fullAssetRecord();
    await push(db, USER_A, [mut(r)]);
    expect((await rowOf(r.id))!.fieldClock).toBeNull();
    await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2000, notes: 'n' }, ['notes'], 2000)]);
    expect((await rowOf(r.id))!.fieldClock).toMatchObject({ notes: 2000, isFavorite: 1000 });
    // A whole record at 3000 pins every field at 3000: null again.
    await push(db, USER_A, [mut({ ...r, updatedAt: 3000, notes: 'n' })]);
    expect((await rowOf(r.id))!.fieldClock).toBeNull();
    // ...and an edit older than 3000 still loses against every field.
    const [late] = await push(db, USER_A, [
      fieldPush({ ...r, updatedAt: 2500, isFavorite: true }, ['isFavorite'], 2500),
    ]);
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
      const assets = Array.from({ length: 12 }, () => fullAssetRecord());
      const albums = Array.from({ length: 6 }, () => albumRecord());
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
        if (style === 'whole') mutations.push(mut(record, kind));
        else if (style === 'every') {
          const every = serverCollections[kind]!.descriptor.mergeFields.filter((field) => field in record);
          mutations.push(fieldPush(record, every, clock, kind));
        } else mutations.push(fieldPush(record, fields, clock, kind));
      }
      const { batched, single } = await batchedAndOneByOne(mutations);
      expect(wire(batched)).toEqual(wire(single));
      await expectSameRows(
        'assets',
        assets.map((r) => r.id),
      );
      await expectSameRows(
        'albums',
        albums.map((r) => r.id),
      );
      await expectSameRows(
        'album_assets',
        edges.map((r) => r.id),
      );
    }
  }, 60_000);
});
