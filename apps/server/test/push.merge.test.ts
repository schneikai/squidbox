import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { keyBetween } from '@squidbox/shared';
import { push } from '../src/sync/push.js';
import { pull } from '../src/sync/pull.js';
import { fakeClock } from '@squidbox/shared/testing/fakeClock';
import { tick } from '@squidbox/shared/testing/tick';
import {
  albumRecord,
  assetRecord,
  batchedAndOneByOne,
  db,
  expectSameRows,
  fieldPush,
  mut,
  pool,
  rowOf,
  serverSeqOf,
  USER_A,
  USER_B,
  useSyncDb,
  wire,
} from './helpers/syncDb.js';

// The merge rules a push applies (field clocks, LWW, purges, optional columns, the lock) on a real
// Postgres. Run with `npm run test:db`; plain `npm test` skips them.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

d('push: the merge rules (Postgres)', () => {
  useSyncDb();

  it('an update without an optional column keeps its stored value', async () => {
    const album = albumRecord({ name: 'Shots', position: 'a0' });
    const stored = () => rowOf(album.id, { collection: 'albums' });
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

    // A row without field clocks: each field's is its updated_at.
    await pool.query('UPDATE albums SET field_clock = NULL WHERE user_id = $1 AND id = $2', [USER_A, album.id]);
    await push(db, USER_A, [{ collection: 'albums', record: { ...withoutPosition, name: 'C', updatedAt: 3000 } }]);
    expect(await clocks()).toMatchObject({ name: 3000, position: 2000 });

    const { changes } = await pull(db, USER_A, { cursor: 0 });
    expect(changes.albums.records[0]).toMatchObject({ name: 'C', position: 'a0' });
    expect(changes.albums.records[0]).not.toHaveProperty('fieldClock'); // server-only
  });

  it('a persona with a useEmoji field is applied without it', async () => {
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

  it("a persona's Adult content starts off and survives a push without it", async () => {
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
    const pulled = async () =>
      (await pull(db, USER_A, { cursor: 0 })).changes.personas.records.find((record) => record.id === id);
    expect(
      (await push(db, USER_A, [{ collection: 'personas', record: persona, fields: { aboutYou: 1000 } }]))[0],
    ).toMatchObject({ status: 'applied' });
    expect(await pulled()).toMatchObject({ adultContent: false });
    const on = { ...persona, updatedAt: 2000, adultContent: true };
    await push(db, USER_A, [{ collection: 'personas', record: on, fields: { adultContent: 2000 } }]);
    const older = { ...persona, updatedAt: 3000, aboutYou: 'Me, later.' };
    expect(
      (await push(db, USER_A, [{ collection: 'personas', record: older, fields: { aboutYou: 3000 } }]))[0],
    ).toMatchObject({ status: 'applied' });
    expect(await pulled()).toMatchObject({ aboutYou: 'Me, later.', adultContent: true });
    await pool.query('DELETE FROM personas WHERE user_id = $1 AND id = $2', [USER_A, id]);
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

  it('a whole-record purge is final: it beats a newer edit in the Deleted album, and no later version applies', async () => {
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

    // A stale device's newer restore, an app that doesn't send purgedAt, or a newer purge: none applies.
    const restore = await push(db, USER_A, [mut({ ...r, updatedAt: 9000, deletedAt: null, purgedAt: null })]);
    expect(restore[0]).toMatchObject({ status: 'skipped-lww', current: { purgedAt: 3000, deletedAt: 2000 } });
    const withoutPurges = { ...r, updatedAt: 9001, deletedAt: null }; // no purgedAt key at all
    expect((await push(db, USER_A, [mut(withoutPurges)]))[0].status).toBe('skipped-lww');
    expect((await push(db, USER_A, [mut({ ...purged, updatedAt: 9002, isFileSynced: false })]))[0].status).toBe(
      'skipped-lww',
    );

    const { changes } = await pull(db, USER_A, { cursor: 0, limit: 100 });
    expect(changes.assets.records).toEqual([expect.objectContaining({ id: r.id, purgedAt: 3000, isFileSynced: true })]);
    expect(changes.assets.records[0]).not.toHaveProperty('filesDeletedAt'); // server-only
  });

  it('an offline device’s whole-record purge loses to a newer restore made on another device', async () => {
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

  describe('per-field merge', () => {
    it('edits of different fields both survive, whichever is pushed last', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      const newer = fieldPush({ ...r, updatedAt: 3000, notes: 'from the phone' }, ['notes']);
      const older = fieldPush({ ...r, updatedAt: 2000, isFavorite: true }, ['isFavorite']);
      expect((await push(db, USER_A, [newer]))[0].status).toBe('applied');
      expect((await push(db, USER_A, [older]))[0].status).toBe('applied');
      expect(await rowOf(r.id)).toMatchObject({ notes: 'from the phone', isFavorite: true, updatedAt: 3000 });
      expect((await rowOf(r.id))!.fieldClock).toMatchObject({ notes: 3000, isFavorite: 2000, filename: 1000 });
    });

    it('an older edit of the same field is skipped with the merged record as current', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 3000, notes: 'newer' }, ['notes'])]);
      const [result] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2000, notes: 'older' }, ['notes'])]);
      expect(result).toMatchObject({ status: 'skipped-lww', current: { notes: 'newer', updatedAt: 3000 } });
      expect(result.current).not.toHaveProperty('fieldClock');
    });

    it('a partial win applies its newer field, re-stamps server_seq and returns the merged record', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 3000, notes: 'newer' }, ['notes'])]);
      const seq = await serverSeqOf(USER_A, r.id);
      const [result] = await push(db, USER_A, [
        fieldPush({ ...r, updatedAt: 2000, notes: 'older', isFavorite: true }, ['notes', 'isFavorite']),
      ]);
      expect(result).toMatchObject({ status: 'skipped-lww', current: { notes: 'newer', isFavorite: true } });
      expect(await serverSeqOf(USER_A, r.id)).toBeGreaterThan(seq!);
    });

    it('a replay is applied and changes nothing, not even server_seq', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      const favorite = fieldPush({ ...r, updatedAt: 2000, isFavorite: true }, ['isFavorite']);
      await push(db, USER_A, [favorite]);
      const seq = await serverSeqOf(USER_A, r.id);
      expect((await push(db, USER_A, [favorite]))[0].status).toBe('applied');
      expect(await serverSeqOf(USER_A, r.id)).toBe(seq);
    });

    it('an edit of another field doesn’t undelete; a newer restore does', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2000, deletedAt: 2000 }, ['deletedAt'])]);
      const [notes] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 3000, notes: 'still here?' }, ['notes'])]);
      expect(notes.status).toBe('applied');
      expect(await rowOf(r.id)).toMatchObject({ deletedAt: 2000, notes: 'still here?' });

      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 4000, deletedAt: null }, ['deletedAt'])]);
      expect(await rowOf(r.id)).toMatchObject({ deletedAt: null, notes: 'still here?' });
    });

    it('a purge loses to a newer restore, beats a newer edit in the Deleted album, and is final', async () => {
      const r = assetRecord({ deletedAt: 1000 });
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 3000, deletedAt: null }, ['deletedAt'])]); // restored
      const purge = fieldPush({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['purgedAt']);
      expect((await push(db, USER_A, [purge]))[0]).toMatchObject({
        status: 'skipped-lww',
        current: { deletedAt: null, purgedAt: null },
      });

      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 4000, deletedAt: 4000 }, ['deletedAt'])]); // deleted again
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 5000, deletedAt: 4000, notes: 'n' }, ['notes'])]);
      const laterPurge = fieldPush({ ...r, updatedAt: 4500, deletedAt: 4000, purgedAt: 4500 }, ['purgedAt']);
      expect((await push(db, USER_A, [laterPurge]))[0].status).toBe('applied');

      const seq = await serverSeqOf(USER_A, r.id);
      const [restore] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 9000, deletedAt: null }, ['deletedAt'])]);
      expect(restore).toMatchObject({ status: 'skipped-lww', current: { deletedAt: 4000, purgedAt: 4500 } });
      expect(await serverSeqOf(USER_A, r.id)).toBe(seq);
    });

    it('a purge applies over a newer whole-record edit in the Deleted album, which stamped every field', async () => {
      const r = assetRecord({ deletedAt: 1000, purgedAt: null });
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [mut({ ...r, updatedAt: 3000, notes: 'from the whole-record app' })]);
      const purge = fieldPush({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['purgedAt']);
      expect((await push(db, USER_A, [purge]))[0].status).toBe('applied');
      expect(await rowOf(r.id)).toMatchObject({ purgedAt: 2000, notes: 'from the whole-record app', updatedAt: 3000 });
    });

    it('a row without field clocks takes its updated_at as every field’s clock', async () => {
      const r = assetRecord({ updatedAt: 2000 });
      await push(db, USER_A, [mut(r)]);
      await pool.query('UPDATE assets SET field_clock = NULL WHERE user_id = $1 AND id = $2', [USER_A, r.id]);
      const [older] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 1500, notes: 'older' }, ['notes'])]);
      expect(older.status).toBe('skipped-lww');
      const [newer] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2500, notes: 'newer' }, ['notes'])]);
      expect(newer.status).toBe('applied');
      expect((await rowOf(r.id))!.fieldClock).toMatchObject({ notes: 2500, isFavorite: 2000 });
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
      expect(await rowOf(r.id)).toMatchObject({ notes: 'n' });
    });

    it('a field group sent in part merges whole, at its newest clock', async () => {
      const r = assetRecord({ isFileSynced: false, isThumbnailSynced: false, isSynced: false });
      await push(db, USER_A, [mut(r)]);
      // Another device marked the thumbnail later; this push names only isFileSynced, with stale others.
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 3000, isThumbnailSynced: true }, ['isThumbnailSynced'])]);
      const stale = { ...r, updatedAt: 2000, isFileSynced: true };
      const [result] = await push(db, USER_A, [
        { collection: 'assets', record: stale, fields: { isFileSynced: 2000 } },
      ]);
      expect(result.status).toBe('skipped-lww');
      expect(await rowOf(r.id)).toMatchObject({ isFileSynced: false, isThumbnailSynced: true, isSynced: false });
      expect((await rowOf(r.id))!.fieldClock).toMatchObject({ isFileSynced: 3000, isThumbnailSynced: 3000 });
    });

    it('a field without a stored clock takes the row’s updated_at, and keeps it once the row moves on', async () => {
      const r = assetRecord({ updatedAt: 2000 });
      await push(db, USER_A, [mut(r)]);
      await pool.query(`UPDATE assets SET field_clock = '{"notes": 2000}' WHERE user_id = $1 AND id = $2`, [
        USER_A,
        r.id,
      ]);
      const [older] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 1500, isFavorite: true }, ['isFavorite'])]);
      expect(older.status).toBe('skipped-lww');
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 5000, notes: 'n' }, ['notes'])]);
      expect((await rowOf(r.id))!.fieldClock).toMatchObject({ notes: 5000, isFavorite: 2000 });
    });

    it('a restore beats a purge that hadn’t seen it, whatever the purge’s clock, and isn’t re-deleted', async () => {
      const r = { ...assetRecord({ deletedAt: 1000 }), purgedAt: null as number | null };
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 3000, deletedAt: null }, ['deletedAt', 'purgedAt'])]);
      const seq = await serverSeqOf(USER_A, r.id);
      // Made later than the restore, on a device that only saw the deletion at 1000.
      const purge = fieldPush({ ...r, updatedAt: 5000, purgedAt: 5000 }, ['deletedAt', 'purgedAt']);
      expect((await push(db, USER_A, [purge]))[0]).toMatchObject({
        status: 'skipped-lww',
        current: { deletedAt: null, purgedAt: null },
      });
      expect(await serverSeqOf(USER_A, r.id)).toBe(seq);
      // A deletion after the restore, then a purge of it, applies.
      const deletion = { ...r, updatedAt: 6000, deletedAt: 6000 };
      await push(db, USER_A, [fieldPush(deletion, ['deletedAt', 'purgedAt'])]);
      const purgeAgain = fieldPush({ ...deletion, updatedAt: 7000, purgedAt: 7000 }, ['deletedAt', 'purgedAt']);
      expect((await push(db, USER_A, [purgeAgain]))[0].status).toBe('applied');
    });

    it('an offline deletion and purge of a row the server never saw deleted apply together', async () => {
      const r = { ...assetRecord(), purgedAt: null as number | null };
      await push(db, USER_A, [mut(r)]);
      const gone = { ...r, updatedAt: 3000, deletedAt: 2000, purgedAt: 3000 };
      expect((await push(db, USER_A, [fieldPush(gone, ['deletedAt', 'purgedAt'])]))[0].status).toBe('applied');
      expect(await rowOf(r.id)).toMatchObject({ deletedAt: 2000, purgedAt: 3000 });
    });

    it('a push to a purged asset that doesn’t have the purge is skipped with it, even if every sent field holds', async () => {
      const r = { ...assetRecord({ deletedAt: 1000 }), purgedAt: null as number | null };
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['deletedAt', 'purgedAt'])]);
      // A device whose deletion the server already has, pushing it again without the purge.
      const [again] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 1000 }, ['notes'])]);
      expect(again).toMatchObject({ status: 'skipped-lww', current: { purgedAt: 2000 } });
      const { purgedAt: _purgedAt, ...withoutPurges } = r; // an app that doesn't know purges
      expect((await push(db, USER_A, [mut(withoutPurges)]))[0]).toMatchObject({ status: 'skipped-lww' });
      const purge = fieldPush({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['deletedAt', 'purgedAt']);
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
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2000, notes: 'n' }, ['notes'])]);
      // An older server writes a whole record at 5000 and leaves field_clock as it was.
      await pool.query(`UPDATE assets SET updated_at = 5000, is_favorite = true WHERE user_id = $1 AND id = $2`, [
        USER_A,
        r.id,
      ]);
      const [older] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 4000, isFavorite: false }, ['isFavorite'])]);
      expect(older).toMatchObject({ status: 'skipped-lww', current: { isFavorite: true } });
      const [newer] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 6000, notes: 'm' }, ['notes'])]);
      expect(newer.status).toBe('applied');
      expect((await rowOf(r.id))!.fieldClock).toMatchObject({ notes: 6000, isFavorite: 5000 });
    });
  });

  describe('per-field merge, adversarial', () => {
    it('a whole-record push between per-field pushes: its newer field wins, its stale ones lose, current is merged', async () => {
      const r = assetRecord({ notes: 'orig' });
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 3000, notes: 'new app' }, ['notes'], 3000)]);
      const [whole] = await push(db, USER_A, [mut({ ...r, updatedAt: 2000, isFavorite: true })]); // stale notes
      expect(whole).toMatchObject({
        status: 'skipped-lww',
        current: { notes: 'new app', isFavorite: true, updatedAt: 3000 },
      });
      expect((await rowOf(r.id))!.fieldClock).toMatchObject({
        notes: 3000,
        isFavorite: 2000,
        filename: 2000,
        deletedAt: 2000,
      });

      // A per-field push older than the whole-record stamp loses on a field the whole record never changed.
      const [late] = await push(db, USER_A, [
        fieldPush({ ...r, updatedAt: 1500, filename: 'b.jpg' }, ['filename'], 1500),
      ]);
      expect(late).toMatchObject({ status: 'skipped-lww', current: { filename: 'a.jpg' } });
      // A newer one wins on it.
      expect(
        (await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2500, filename: 'b.jpg' }, ['filename'], 2500)]))[0]
          .status,
      ).toBe('applied');
      expect(await rowOf(r.id)).toMatchObject({
        notes: 'new app',
        isFavorite: true,
        filename: 'b.jpg',
        updatedAt: 3000,
      });
    });

    it('a push that loses everything leaves the row and its server_seq alone', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut({ ...r, updatedAt: 3000 })]);
      const before = (await rowOf(r.id))!;
      const [result] = await push(db, USER_A, [
        fieldPush(
          { ...r, updatedAt: 2000, notes: 'n', isFavorite: true, deletedAt: 2000 },
          ['notes', 'isFavorite', 'deletedAt'],
          2000,
        ),
      ]);
      expect(result.status).toBe('skipped-lww');
      expect(await rowOf(r.id)).toEqual(before);
    });

    it('equal clocks with different values: the first stays, the second is skipped-lww with it as current', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      expect(
        (await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2000, notes: 'first' }, ['notes'], 2000)]))[0].status,
      ).toBe('applied');
      const [second] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2000, notes: 'second' }, ['notes'], 2000)]);
      expect(second).toMatchObject({ status: 'skipped-lww', current: { notes: 'first' } });
    });

    it('per-field clocks of one push merge one by one: an older clock on one field loses while a newer one wins', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 3000, notes: 'other device' }, ['notes'], 3000)]);
      const [result] = await push(db, USER_A, [
        fieldPush({ ...r, updatedAt: 4000, notes: 'mine, older', isFavorite: true }, { notes: 2000, isFavorite: 4000 }),
      ]);
      expect(result).toMatchObject({ status: 'skipped-lww', current: { notes: 'other device', isFavorite: true } });
      expect((await rowOf(r.id))!.fieldClock).toMatchObject({ notes: 3000, isFavorite: 4000 });
    });

    it('only the future field clocks of a push are clamped', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      const future = Date.now() + 3_600_000;
      await push(db, USER_A, [
        fieldPush({ ...r, updatedAt: future, notes: 'ahead', isFavorite: true }, { notes: future, isFavorite: 2000 }),
      ]);
      const row = (await rowOf(r.id))!;
      expect(row.notes).toBe('ahead');
      expect(row.fieldClock!.isFavorite).toBe(2000);
      expect(row.fieldClock!.notes).toBeLessThan(future);
      expect(row.updatedAt).toBe(row.fieldClock!.notes);
    });

    it('a replayed mixed batch gets the same results and moves no server_seq', async () => {
      const rs = [assetRecord(), assetRecord(), assetRecord()];
      await push(db, USER_A, rs.map(mut));
      await push(db, USER_A, [fieldPush({ ...rs[1], updatedAt: 3000, notes: 'newer' }, ['notes'], 3000)]);
      const batch = [
        fieldPush({ ...rs[0], updatedAt: 2000, notes: 'wins' }, ['notes'], 2000),
        fieldPush({ ...rs[1], updatedAt: 2000, notes: 'loses', isFavorite: true }, ['notes', 'isFavorite'], 2000),
        fieldPush({ ...rs[2], updatedAt: 2000, deletedAt: 2000 }, ['deletedAt'], 2000),
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
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['purgedAt'], 2000)]);
      const frozen = (await rowOf(r.id))!;
      const attempts = [
        fieldPush({ ...r, updatedAt: 9000, notes: 'n' }, ['notes'], 9000),
        fieldPush({ ...r, updatedAt: 9000, deletedAt: null }, ['deletedAt'], 9000),
        mut({ ...r, updatedAt: 9000, deletedAt: null, purgedAt: null }),
        mut({ ...r, updatedAt: 9000, isFavorite: true }), // no purgedAt key
        fieldPush({ ...r, updatedAt: 9000, purgedAt: 9000 }, ['purgedAt', 'deletedAt'], 9000),
      ];
      for (const attempt of attempts) {
        const [result] = await push(db, USER_A, [attempt]);
        expect(result).toMatchObject({
          status: 'skipped-lww',
          current: { purgedAt: 2000, deletedAt: 1000, notes: null },
        });
      }
      expect(await rowOf(r.id)).toEqual(frozen);
      // The identical purge, replayed, is applied.
      expect(
        (await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['purgedAt'], 2000)]))[0].status,
      ).toBe('applied');
    });

    it('a purge with its own delete: applies on a live row, loses to a newer restore, applies under a newer delete', async () => {
      const live = assetRecord();
      const restored = assetRecord({ deletedAt: 1000 });
      const redeleted = assetRecord({ deletedAt: 1000 });
      await push(db, USER_A, [mut(live), mut(restored), mut(redeleted)]);
      await push(db, USER_A, [
        fieldPush({ ...restored, updatedAt: 3000, deletedAt: null }, ['deletedAt'], 3000),
        fieldPush({ ...redeleted, updatedAt: 3000, deletedAt: 3000 }, ['deletedAt'], 3000),
      ]);
      const purge = (r: Record<string, unknown>) =>
        fieldPush({ ...r, updatedAt: 2500, deletedAt: 2000, purgedAt: 2500 }, { deletedAt: 2000, purgedAt: 2500 });
      const results = await push(db, USER_A, [purge(live), purge(restored), purge(redeleted)]);
      expect(results[0].status).toBe('applied');
      expect(await rowOf(live.id)).toMatchObject({ deletedAt: 2000, purgedAt: 2500 });
      expect(results[1]).toMatchObject({ status: 'skipped-lww', current: { deletedAt: null, purgedAt: null } });
      expect(results[2]).toMatchObject({ status: 'skipped-lww', current: { deletedAt: 3000, purgedAt: 2500 } });
    });

    // The restore remembers the deletion value it undid, so a purge made of it loses whatever the clocks.
    it('a restore beats a purge that hadn’t seen it when the deletion came from a fast clock', async () => {
      fakeClock();
      const r = { ...assetRecord(), purgedAt: null as number | null };
      await push(db, USER_A, [mut(r)]);
      const fastDeletion = Date.now() + 3_600_000; // the deleting device is an hour ahead
      const deleted = { ...r, updatedAt: fastDeletion, deletedAt: fastDeletion };
      expect((await push(db, USER_A, [fieldPush(deleted, ['deletedAt'], fastDeletion)]))[0].status).toBe('applied');
      tick();
      const restoredAt = Date.now();
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: restoredAt, deletedAt: null }, ['deletedAt'], restoredAt)]);
      expect(await rowOf(r.id)).toMatchObject({ deletedAt: null });
      tick();
      const purgedAt = Date.now(); // made on a device that only saw the deletion
      const [result] = await push(db, USER_A, [
        fieldPush({ ...deleted, updatedAt: purgedAt, purgedAt }, ['deletedAt', 'purgedAt'], purgedAt),
      ]);
      expect(result).toMatchObject({ status: 'skipped-lww', current: { deletedAt: null, purgedAt: null } });
    });

    it('a restore and a purge of one record in one push: the restore first beats the purge, the purge first is final', async () => {
      const restoredFirst = { ...assetRecord({ deletedAt: 1000 }), purgedAt: null as number | null };
      const purgedFirst = { ...assetRecord({ deletedAt: 1000 }), purgedAt: null as number | null };
      await push(db, USER_A, [mut(restoredFirst), mut(purgedFirst)]);
      const restore = (r: Record<string, unknown>) =>
        fieldPush({ ...r, updatedAt: 3000, deletedAt: null }, ['deletedAt'], 3000);
      const purge = (r: Record<string, unknown>) =>
        fieldPush({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['purgedAt'], 2000);
      const results = await push(db, USER_A, [
        restore(restoredFirst),
        purge(restoredFirst),
        purge(purgedFirst),
        restore(purgedFirst),
      ]);
      expect(results.map((result) => result.status)).toEqual(['applied', 'skipped-lww', 'applied', 'skipped-lww']);
      expect(await rowOf(restoredFirst.id)).toMatchObject({ deletedAt: null, purgedAt: null });
      expect(await rowOf(purgedFirst.id)).toMatchObject({ deletedAt: 1000, purgedAt: 2000 });
    });

    it('a purge alone on a live row changes nothing', async () => {
      const r = assetRecord();
      await push(db, USER_A, [mut(r)]);
      const before = (await rowOf(r.id))!;
      const [result] = await push(db, USER_A, [
        fieldPush({ ...r, updatedAt: 2000, purgedAt: 2000 }, ['purgedAt'], 2000),
      ]);
      expect(result).toMatchObject({ status: 'skipped-lww', current: { purgedAt: null } });
      expect(await rowOf(r.id)).toEqual(before);
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
      await push(db, USER_A, [
        fieldPush({ ...e, updatedAt: 2000, deletedAt: 2000 }, ['deletedAt'], 2000, 'album_assets'),
      ]);
      const [reorder] = await push(db, USER_A, [
        fieldPush({ ...e, updatedAt: 3000, position: 'Zz' }, ['position'], 3000, 'album_assets'),
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
        fieldPush({ ...r, updatedAt: 3000, notes: `newer ${i}` }, ['notes'], 3000),
        i % 2 === 0
          ? fieldPush({ ...r, updatedAt: 2000, notes: `older ${i}`, isFavorite: true }, ['notes', 'isFavorite'], 2000)
          : mut({ ...r, updatedAt: 2000, notes: `older ${i}`, isFavorite: true }), // a whole-record app's push
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

  describe('restored deletions, the lock, one batch against many pushes', () => {
    const pair = ['deletedAt', 'purgedAt'];
    const asset = (over: Record<string, unknown> = {}) => ({
      ...assetRecord(over),
      purgedAt: null as number | null,
      ...over,
    });

    it('300 delete/restore cycles keep the last ten deletions undone: a purge of one of them loses, of an older one goes by its clock', async () => {
      const r = asset();
      await push(db, USER_A, [mut(r)]);
      let clock = 2000;
      for (let cycle = 0; cycle < 300; cycle++) {
        const deletedAt = (clock += 10);
        await push(db, USER_A, [fieldPush({ ...r, updatedAt: deletedAt, deletedAt }, pair, deletedAt)]);
        clock += 10;
        await push(db, USER_A, [fieldPush({ ...r, updatedAt: clock, deletedAt: null }, pair, clock)]);
      }
      const row = (await rowOf(r.id))!;
      const last = clock - 10;
      expect(row.restoredDeletions).toEqual(Array.from({ length: 10 }, (_, i) => last - (9 - i) * 20));
      const recent = { ...r, updatedAt: 9_000_000, deletedAt: last, purgedAt: 9_000_000 };
      const [lost] = await push(db, USER_A, [fieldPush(recent, pair, 9_000_000)]);
      expect(lost).toMatchObject({ status: 'skipped-lww', current: { deletedAt: null, purgedAt: null } });
      const oldest = { ...r, updatedAt: 9_000_001, deletedAt: 2010, purgedAt: 9_000_001 };
      const [applied] = await push(db, USER_A, [fieldPush(oldest, pair, 9_000_001)]);
      expect(applied.status).toBe('applied');
    });

    it('a fast clock’s restore doesn’t make a later real delete and purge on another device lose', async () => {
      const r = asset({ deletedAt: 1000 });
      await push(db, USER_A, [mut(r)]);
      // A device whose clock runs a day ahead restores the photo; then deletes it at its own clock.
      const ahead = 1000 + 86_400_000;
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: ahead, deletedAt: null }, pair, ahead)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: ahead + 10, deletedAt: ahead + 10 }, pair, ahead + 10)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: ahead + 20, deletedAt: null }, pair, ahead + 20)]); // and restores again
      expect((await rowOf(r.id))!.restoredDeletions).toEqual([1000, ahead + 10]);
      // Another device, its clock right, deletes and purges it for real, newer than every clock above.
      const now = ahead + 1000;
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: now, deletedAt: now - 5, purgedAt: now }, pair, now)]);
      expect(await rowOf(r.id)).toMatchObject({ deletedAt: now - 5, purgedAt: now });
    });

    it('the restored deletions survive the rollback rule and a whole-record push, and no client ever sees them', async () => {
      const r = asset({ deletedAt: 1000 });
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 2000, deletedAt: null }, pair, 2000)]);
      // A server without clocks writes the row since (a rollback), leaving field_clock as it was.
      await pool.query(
        `UPDATE assets SET updated_at = 4000, notes = 'rolled-back server' WHERE user_id = $1 AND id = $2`,
        [USER_A, r.id],
      );
      // Then a whole record, newer, from a device that saw the restore.
      const [whole] = await push(db, USER_A, [
        mut({ ...r, updatedAt: 5000, deletedAt: null, notes: 'rolled-back server', isFavorite: true }),
      ]);
      expect(whole.status).toBe('applied');
      expect((await rowOf(r.id))!.restoredDeletions).toEqual([1000]);
      // A device that only saw the deletion at 1000 purges, its clock far ahead of everything.
      const [purge] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 9000, purgedAt: 9000 }, pair, 9000)]);
      expect(purge).toMatchObject({
        status: 'skipped-lww',
        current: { deletedAt: null, purgedAt: null, isFavorite: true },
      });
      const serverOnly = (record: object) =>
        Object.keys(record).filter((key) => key === 'restoredDeletions' || key === 'fieldClock');
      expect(serverOnly(purge.current!)).toEqual([]);
      const { changes } = await pull(db, USER_A, { cursor: 0, limit: 1000 });
      for (const record of changes.assets.records) expect(serverOnly(record)).toEqual([]);
    });

    it('a restore a rolled-back server took is not remembered: a purge of that deletion then goes by its clock (a rollback’s limit)', async () => {
      const r = asset({ deletedAt: 1000 });
      await push(db, USER_A, [mut(r)]);
      await pool.query(`UPDATE assets SET updated_at = 2000, deleted_at = NULL WHERE user_id = $1 AND id = $2`, [
        USER_A,
        r.id,
      ]);
      const [purge] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 3000, purgedAt: 3000 }, pair, 3000)]);
      expect(purge.status).toBe('applied');
      expect(await rowOf(r.id)).toMatchObject({ deletedAt: 1000, purgedAt: 3000 });
    });

    it('a stale field_clock behind a rolled-back server’s writes: every field takes its updated_at, then pins again', async () => {
      const r = asset();
      await push(db, USER_A, [mut(r)]);
      await push(db, USER_A, [fieldPush({ ...r, updatedAt: 3000, notes: 'new' }, ['notes'], 3000)]);
      // A server without clocks writes a newer whole record at 4000, field_clock left at notes 3000.
      await pool.query(
        `UPDATE assets SET updated_at = 4000, notes = 'rolled back', is_favorite = true WHERE user_id = $1 AND id = $2`,
        [USER_A, r.id],
      );
      // A per-field edit older than the rolled-back server's write loses, though newer than the stale clock.
      const [older] = await push(db, USER_A, [
        fieldPush({ ...r, updatedAt: 3500, notes: 'newer than 3000' }, ['notes'], 3500),
      ]);
      expect(older).toMatchObject({ status: 'skipped-lww', current: { notes: 'rolled back' } });
      // A newer one wins, and from then on the row has clocks again: the next older edit of another field loses.
      expect(
        (await push(db, USER_A, [fieldPush({ ...r, updatedAt: 4500, isFavorite: false }, ['isFavorite'], 4500)]))[0]
          .status,
      ).toBe('applied');
      const row = (await rowOf(r.id))!;
      expect(row.fieldClock).toMatchObject({ notes: 4000, isFavorite: 4500, deletedAt: 4000 });
      expect(row.updatedAt).toBe(4500);
      const [stale] = await push(db, USER_A, [fieldPush({ ...r, updatedAt: 4200, notes: 'late' }, ['notes'], 4200)]);
      expect(stale.status).toBe('applied'); // 4200 > the notes clock 4000
      expect((await rowOf(r.id))!.notes).toBe('late');
    });

    it('two devices pushing one record at once, 30 times over: the lock serializes, the newer clock wins in any order', async () => {
      for (let round = 0; round < 30; round++) {
        const r = asset({ deletedAt: 1000 });
        await push(db, USER_A, [mut(r)]);
        const restore = fieldPush(
          { ...r, updatedAt: 2000, deletedAt: null, notes: 'B' },
          ['deletedAt', 'purgedAt', 'notes'],
          2000,
        );
        const purge = fieldPush(
          { ...r, updatedAt: 3000, purgedAt: 3000, notes: 'A' },
          ['deletedAt', 'purgedAt', 'notes'],
          3000,
        );
        const [[a], [b]] = await Promise.all([push(db, USER_A, [purge]), push(db, USER_A, [restore])]);
        const row = (await rowOf(r.id))!;
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
      await push(db, USER_A, records.map(mut));
      // 20 concurrent pushes per record, each a newer clock for notes and isFavorite: the newest wins.
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          push(
            db,
            USER_A,
            records.map((r) =>
              fieldPush(
                { ...r, updatedAt: 5000 + i, notes: `n${i}`, isFavorite: i % 2 === 0 },
                ['notes', 'isFavorite'],
                5000 + i,
              ),
            ),
          ),
        ),
      );
      for (const r of records)
        expect(await rowOf(r.id)).toMatchObject({ notes: 'n19', isFavorite: false, updatedAt: 5019 });
    });

    // A record sent without the final field (an app without purges) leaves the merged record's
    // purgedAt as the column holds it (null), which the next mutation of the batch merges against.
    it('a restore by an app without purges, then a restore by a new app in the same batch: applied, as pushed alone', async () => {
      const r = asset({ deletedAt: 1000 });
      await push(db, USER_A, [mut(r)]);
      const { purgedAt: _p, ...withoutPurges } = { ...r, updatedAt: 3000, deletedAt: null };
      const newer = fieldPush({ ...r, updatedAt: 2000, deletedAt: null }, pair, 2000); // older clock, same values
      const results = await push(db, USER_A, [mut(withoutPurges), newer]);
      expect(await rowOf(r.id)).toMatchObject({ deletedAt: null, purgedAt: null });
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
        if (kind === 'whole') return mut(record); // an app without per-field merge (whole-record pushes)
        if (kind === 'withoutPurges') {
          const { purgedAt: _p, ...rest } = record; // and without purges
          return mut(rest);
        }
        return fieldPush(record, fields, clock);
      });
      await push(db, USER_A, records.map(mut));
      await push(db, USER_B, records.map(mut));
      const { batched, single } = await batchedAndOneByOne(mutations, 500);
      expect(batched.filter((result) => result.status === 'applied').length).toBeGreaterThan(300);
      expect(wire(batched)).toEqual(wire(single)); // `current` too: an undefined purgedAt reads as a missing one
      await expectSameRows(
        'assets',
        records.map((r) => r.id),
      );
    }

    it('a seeded batch of 600 mutations naming 25 records over and over merges like the same pushes one by one', async () => {
      await batchAgainstOneByOne(['fields', 'fields', 'fields', 'whole']);
    });

    // The one above, with apps without purges in the mix.
    it('the same with apps without purges in the mix', async () => {
      await batchAgainstOneByOne(['fields', 'fields', 'fields', 'whole', 'withoutPurges']);
    });

    it('an id sent in upper case names the stored row: a purged one stays purged, a live one merges', async () => {
      const purged = asset({ updatedAt: 2000, deletedAt: 1000, purgedAt: 2000 });
      const live = asset({ notes: 'kept' });
      await push(db, USER_A, [mut(purged), mut(live)]);
      const upper = (record: Record<string, unknown>) => ({ ...record, id: String(record.id).toUpperCase() });
      const results = await push(db, USER_A, [
        mut(upper({ ...purged, updatedAt: 9000, deletedAt: null, purgedAt: null })),
        fieldPush(upper({ ...live, updatedAt: 3000, isFavorite: true }), ['isFavorite'], 3000),
      ]);
      expect(results.map(({ id, status }) => ({ id, status }))).toEqual([
        { id: purged.id.toUpperCase(), status: 'skipped-lww' },
        { id: live.id.toUpperCase(), status: 'applied' },
      ]);
      expect(await rowOf(purged.id)).toMatchObject({ deletedAt: 1000, purgedAt: 2000 });
      expect(await rowOf(live.id)).toMatchObject({ notes: 'kept', isFavorite: true, updatedAt: 3000 });
    });

    it('an insert whose fields name nothing it carries is written whole and applied', async () => {
      const r = asset({ notes: 'new' });
      const [result] = await push(db, USER_A, [{ collection: 'assets', record: r, fields: { nothing: 5 } }]);
      expect(result.status).toBe('applied');
      expect(await rowOf(r.id)).toMatchObject({ notes: 'new', updatedAt: r.updatedAt, fieldClock: null });
    });
  });
});
