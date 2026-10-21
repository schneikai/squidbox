import { describe, it, expect } from 'vitest';
import { assetCollection, mergeRecord, restoredMark, type FieldClocks, type MergeInput } from '@squidbox/shared';

const fields = ['deletedAt', 'notes', 'isFavorite', 'isFileSynced', 'isThumbnailSynced', 'isSynced'];
const asset = (over: Record<string, unknown> = {}) => ({
  id: 'a',
  updatedAt: 1000,
  deletedAt: null as number | null,
  notes: null as string | null,
  isFavorite: false,
  isFileSynced: false,
  isThumbnailSynced: false,
  isSynced: false,
  purgedAt: null as number | null,
  ...over,
});
const at = (clock: number, over: FieldClocks = {}) => ({
  ...Object.fromEntries(fields.map((f) => [f, clock])),
  ...over,
});
const merge = (input: Partial<MergeInput> & Pick<MergeInput, 'sent' | 'sentClocks'>) =>
  mergeRecord(assetCollection, { stored: asset(), storedClocks: at(1000), ...input });
const pair = (clock: number) => ({ deletedAt: clock, purgedAt: clock });

describe('mergeRecord', () => {
  it('applies a field with a newer clock, loses one with an older, and a replay changes nothing', () => {
    const newer = merge({ sent: asset({ updatedAt: 2000, notes: 'n' }), sentClocks: { notes: 2000 } });
    expect(newer).toMatchObject({ applied: ['notes'], lost: [], record: { notes: 'n', updatedAt: 2000 } });
    expect(newer.clocks.notes).toBe(2000);

    const stored = newer.record;
    const older = merge({
      stored,
      storedClocks: newer.clocks,
      sent: asset({ notes: 'old', isFavorite: true }),
      sentClocks: { notes: 1500, isFavorite: 1500 },
    });
    expect(older).toMatchObject({ applied: ['isFavorite'], lost: ['notes'], record: { notes: 'n', isFavorite: true } });

    const replay = merge({ stored, storedClocks: newer.clocks, sent: stored, sentClocks: { notes: 2000 } });
    expect(replay).toMatchObject({ applied: [], lost: [] });
  });

  it('inserts a new record with the sent clocks', () => {
    const result = merge({ stored: undefined, sent: asset({ updatedAt: 3000 }), sentClocks: at(3000) });
    expect(result.applied).toContain('notes');
    expect(result.clocks).toEqual(at(3000));
    expect(result.record.updatedAt).toBe(3000);
  });

  it('an edit of another field doesn’t undelete; a newer restore does, and marks the deletion it undid', () => {
    const deleted = asset({ deletedAt: 1000 });
    const edit = merge({ stored: deleted, sent: asset({ updatedAt: 3000, notes: 'n' }), sentClocks: { notes: 3000 } });
    expect(edit.record).toMatchObject({ deletedAt: 1000, notes: 'n' });
    const restore = merge({ stored: deleted, sent: asset({ updatedAt: 4000 }), sentClocks: pair(4000) });
    expect(restore.record).toMatchObject({ deletedAt: null, purgedAt: null });
    expect(restore.clocks[restoredMark(1000)]).toBe(4000);
  });

  it('a restore beats a purge made of the deletion it undid, whatever the purge’s clock', () => {
    const restored = merge({
      stored: asset({ deletedAt: 1000 }),
      sent: asset({ updatedAt: 2000 }),
      sentClocks: pair(2000),
    });
    const purge = asset({ updatedAt: 9_999_999, deletedAt: 1000, purgedAt: 9_999_999 });
    const result = merge({
      stored: restored.record,
      storedClocks: restored.clocks,
      sent: purge,
      sentClocks: pair(9_999_999),
    });
    expect(result).toMatchObject({ applied: [], record: { deletedAt: null, purgedAt: null } });
    expect(result.lost.sort()).toEqual(['deletedAt', 'purgedAt']);

    // An app without fields keeps its whole-record rule: its newer purge re-deletes and applies.
    const old = merge({
      stored: restored.record,
      storedClocks: restored.clocks,
      sent: purge,
      sentClocks: pair(9_999_999),
      wholeRecord: true,
    });
    expect(old.record).toMatchObject({ deletedAt: 1000, purgedAt: 9_999_999 });
  });

  it('an offline deletion and purge of a record never deleted apply, and so does a purge of a deletion after a restore', () => {
    const gone = asset({ updatedAt: 3000, deletedAt: 2000, purgedAt: 3000 });
    expect(merge({ sent: gone, sentClocks: pair(3000) }).record).toMatchObject({ deletedAt: 2000, purgedAt: 3000 });

    const restored = merge({
      stored: asset({ deletedAt: 1000 }),
      sent: asset({ updatedAt: 2000 }),
      sentClocks: pair(2000),
    });
    const again = merge({
      stored: restored.record,
      storedClocks: restored.clocks,
      sent: asset({ updatedAt: 3000, deletedAt: 3000 }),
      sentClocks: pair(3000),
    });
    const purge = asset({ updatedAt: 4000, deletedAt: 3000, purgedAt: 4000 });
    expect(
      merge({ stored: again.record, storedClocks: again.clocks, sent: purge, sentClocks: pair(4000) }).record,
    ).toMatchObject({
      deletedAt: 3000,
      purgedAt: 4000,
    });
  });

  it('a purge applies to a record still deleted even when older, keeping its newer deletedAt', () => {
    const stored = asset({ updatedAt: 5000, deletedAt: 5000 });
    const result = merge({
      stored,
      storedClocks: at(5000),
      sent: asset({ updatedAt: 3000, deletedAt: 2000, purgedAt: 3000 }),
      sentClocks: pair(3000),
    });
    expect(result.record).toMatchObject({ deletedAt: 5000, purgedAt: 3000 });
    expect(result.lost).toEqual(['deletedAt']);
  });

  it('a purge without its deletion changes nothing', () => {
    const result = merge({ sent: asset({ updatedAt: 2000, purgedAt: 2000 }), sentClocks: pair(2000) });
    expect(result).toMatchObject({ applied: [], record: { deletedAt: null, purgedAt: null } });
  });

  it('a purged record is frozen, and a push without the purge is told it lost', () => {
    const purged = asset({ updatedAt: 2000, deletedAt: 1000, purgedAt: 2000 });
    const restore = merge({
      stored: purged,
      storedClocks: at(2000),
      sent: asset({ updatedAt: 9000 }),
      sentClocks: pair(9000),
    });
    expect(restore).toMatchObject({ applied: [], record: purged });
    const sameNotes = merge({
      stored: purged,
      storedClocks: at(2000),
      sent: { ...purged, purgedAt: null },
      sentClocks: { notes: 9000 },
    });
    expect(sameNotes.lost).toEqual(['purgedAt']);
    expect(merge({ stored: purged, storedClocks: at(2000), sent: purged, sentClocks: pair(2000) }).lost).toEqual([]);
  });

  it('a pending purge (a library merge) loses to a later restore only, and a deletion never replaces it', () => {
    const pending = {
      stored: asset({ updatedAt: 3000, deletedAt: 2000, purgedAt: 3000 }),
      storedClocks: at(0, pair(3000)),
      storedPurgeFinal: false,
    };
    expect(merge({ ...pending, sent: asset({ updatedAt: 4000 }), sentClocks: pair(4000) }).record).toMatchObject({
      deletedAt: null,
      purgedAt: null,
    });
    expect(merge({ ...pending, sent: asset({ updatedAt: 2500 }), sentClocks: pair(2500) }).record).toMatchObject({
      purgedAt: 3000,
    });
    const deletion = merge({ ...pending, sent: asset({ updatedAt: 4000, deletedAt: 4000 }), sentClocks: pair(4000) });
    expect(deletion).toMatchObject({ applied: [], record: { deletedAt: 2000, purgedAt: 3000 } });
  });

  // BUG (round 3): sync-design §6/§7 say an outbox row from before per-field merge names every merge
  // field of its payload at its updatedAt (SQLite migration 0011), "which comes to the same" as a
  // whole-record push. For the deletion pair it doesn't: the installed app's offline purge, pushed
  // after the upgrade, carries fields, so a restore of its deletion beats it although that app has
  // already removed its files (the reason pushes without fields keep their whole-record rule).
  it.fails('an installed app’s purge carried over by migration 0011 merges like its whole record', () => {
    const restored = merge({
      stored: asset({ deletedAt: 1000 }),
      sent: asset({ updatedAt: 2000 }),
      sentClocks: pair(2000),
    });
    const purge = asset({ updatedAt: 3000, deletedAt: 1000, purgedAt: 3000 });
    const input = { stored: restored.record, storedClocks: restored.clocks, sent: purge };
    const whole = merge({ ...input, sentClocks: at(3000, pair(3000)), wholeRecord: true });
    const migrated = merge({ ...input, sentClocks: at(3000, pair(3000)) }); // 0011: every merge field at updatedAt
    expect(whole.record).toMatchObject({ deletedAt: 1000, purgedAt: 3000 });
    expect(migrated.record).toEqual(whole.record); // actual: the restore wins, deletedAt null
  });

  // BUG (round 3): a record sent without the final field (an app from before purges) gets
  // `purgedAt: undefined` in the merged record when its deletion pair applies. On the server that row
  // reads back as NULL, but within one batch the next mutation of the record merges against the
  // undefined, and lostFields counts a sent `purgedAt: null` as lost (sync.test, round 3).
  it.fails(
    'a restore by an app from before purges leaves purgedAt null in the merged record, as the column holds',
    () => {
      const { purgedAt: _p, ...prePurge } = asset({ updatedAt: 3000 });
      const result = merge({
        stored: asset({ deletedAt: 1000 }),
        sent: prePurge as ReturnType<typeof asset>,
        sentClocks: at(3000, { deletedAt: 3000 }),
        wholeRecord: true,
      });
      expect(result.record.deletedAt).toBeNull();
      expect(result.record.purgedAt).toBeNull(); // actual: undefined
    },
  );
});
