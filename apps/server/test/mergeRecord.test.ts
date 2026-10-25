import { describe, it, expect } from 'vitest';
import { assetCollection, mergeRecord, type FieldClocks, type MergeInput } from '@squidbox/shared';

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
    expect(result.clocks).toMatchObject(at(3000)); // and every other clocked field at the record's updatedAt, as written
    const partial = merge({ stored: undefined, sent: asset({ updatedAt: 3000 }), sentClocks: { notes: 2000 } });
    expect(partial.clocks).toMatchObject({ notes: 2000, isFavorite: 3000, deletedAt: 3000 });
    expect(partial.clocks).not.toHaveProperty('purgedAt');
    expect(result.record.updatedAt).toBe(3000);
  });

  it('an edit of another field doesn’t undelete; a newer restore does, and remembers the deletion it undid', () => {
    const deleted = asset({ deletedAt: 1000 });
    const edit = merge({ stored: deleted, sent: asset({ updatedAt: 3000, notes: 'n' }), sentClocks: { notes: 3000 } });
    expect(edit.record).toMatchObject({ deletedAt: 1000, notes: 'n' });
    const restore = merge({ stored: deleted, sent: asset({ updatedAt: 4000 }), sentClocks: pair(4000) });
    expect(restore.record).toMatchObject({ deletedAt: null, purgedAt: null });
    expect(restore.restoredDeletions).toEqual([1000]);
    const more = merge({
      stored: deleted,
      sent: asset({ updatedAt: 4000 }),
      sentClocks: pair(4000),
      restoredDeletions: [3000],
    });
    expect(more.restoredDeletions).toEqual([3000, 1000]);
    expect(edit.restoredDeletions).toEqual([]);
    // The last ten, the oldest dropped; one undone again moves to the end.
    const many = Array.from({ length: 10 }, (_, i) => 100 + i);
    expect(
      merge({ stored: deleted, sent: asset({ updatedAt: 4000 }), sentClocks: pair(4000), restoredDeletions: many })
        .restoredDeletions,
    ).toEqual([...many.slice(1), 1000]);
    const again = merge({
      stored: deleted,
      sent: asset({ updatedAt: 4000 }),
      sentClocks: pair(4000),
      restoredDeletions: [1000, 3000],
    });
    expect(again.restoredDeletions).toEqual([3000, 1000]);
  });

  it('a restore beats a purge made of the deletion it undid, whatever the purge’s clock', () => {
    const restored = merge({
      stored: asset({ deletedAt: 1000 }),
      sent: asset({ updatedAt: 2000 }),
      sentClocks: pair(2000),
    });
    const purge = asset({ updatedAt: 9_999_999, deletedAt: 1000, purgedAt: 9_999_999 });
    const input = { stored: restored.record, storedClocks: restored.clocks, sent: purge, sentClocks: pair(9_999_999) };
    const result = merge({ ...input, restoredDeletions: restored.restoredDeletions });
    expect(result).toMatchObject({ applied: [], record: { deletedAt: null, purgedAt: null } });
    expect(result.lost.sort()).toEqual(['deletedAt', 'purgedAt']);
    // Only that exact deletion: a purge of any other goes by the clocks (a fast clock's restore of
    // 9000 can't make another device's real later delete and purge lose).
    for (const deletedAt of [900, 1001]) {
      const other = { ...purge, deletedAt };
      expect(merge({ ...input, sent: other, restoredDeletions: [1000] }).record).toMatchObject({ purgedAt: 9_999_999 });
    }
    expect(merge({ ...input, sent: { ...purge, deletedAt: 900 }, restoredDeletions: [9000] }).record).toMatchObject({
      deletedAt: 900,
      purgedAt: 9_999_999,
    });

    // A push without fields keeps its whole-record rule: its newer purge re-deletes and applies.
    const whole = { ...input, restoredDeletions: restored.restoredDeletions, wholeRecord: true };
    expect(merge(whole).record).toMatchObject({ deletedAt: 1000, purgedAt: 9_999_999 });
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
      restoredDeletions: restored.restoredDeletions,
    });
    expect(again.restoredDeletions).toEqual([1000]);
    const redeleted = { stored: again.record, storedClocks: again.clocks, restoredDeletions: again.restoredDeletions };
    const purge = asset({ updatedAt: 4000, deletedAt: 3000, purgedAt: 4000 });
    expect(merge({ ...redeleted, sent: purge, sentClocks: pair(4000) }).record).toMatchObject({
      deletedAt: 3000,
      purgedAt: 4000,
    });
    // A re-deleted record takes a purge of the deletion the restore undid too: it is deleted again.
    const stale = asset({ updatedAt: 2500, deletedAt: 1000, purgedAt: 2500 });
    expect(merge({ ...redeleted, sent: stale, sentClocks: pair(2500) }).record).toMatchObject({
      deletedAt: 3000,
      purgedAt: 2500,
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

  // An installed app's outbox row (from before per-field merge, carried over by SQLite migration 0011)
  // is pushed without fields (worker.ts): that app removed a purge's files at once, so its purge keeps
  // the whole-record rule and no restoredDeletions check, like any push without fields.
  it('an installed app’s purge carried over by migration 0011 merges like its whole record', () => {
    const restored = merge({
      stored: asset({ deletedAt: 1000 }),
      sent: asset({ updatedAt: 2000 }),
      sentClocks: pair(2000),
    });
    const purge = asset({ updatedAt: 3000, deletedAt: 1000, purgedAt: 3000 });
    const input = { stored: restored.record, storedClocks: restored.clocks, sent: purge };
    const restoredDeletions = restored.restoredDeletions;
    const whole = merge({ ...input, sentClocks: at(3000, pair(3000)), restoredDeletions, wholeRecord: true }); // as push.ts
    const perField = merge({ ...input, sentClocks: pair(3000), restoredDeletions });
    expect(whole.record).toMatchObject({ deletedAt: 1000, purgedAt: 3000 });
    expect(perField.record).toMatchObject({ deletedAt: null, purgedAt: null });
  });

  // A record sent without the final field (an app from before purges) leaves the stored one: on the
  // server the column holds null, and so must the merged record, which the next mutation of the batch
  // merges against.
  it('a restore by an app from before purges leaves purgedAt null in the merged record, as the column holds', () => {
    const { purgedAt: _p, ...prePurge } = asset({ updatedAt: 3000 });
    const result = merge({
      stored: asset({ deletedAt: 1000 }),
      sent: prePurge as ReturnType<typeof asset>,
      sentClocks: at(3000, { deletedAt: 3000 }),
    });
    expect(result.record.deletedAt).toBeNull();
    expect(result.record.purgedAt).toBeNull();
  });

  it('a whole record that loses every clock but holds every value is told it lost: its row is newer', () => {
    const stored = asset({ updatedAt: 5000, notes: 'same' });
    const sent = asset({ updatedAt: 3000, notes: 'same' });
    const whole = merge({ stored, storedClocks: at(5000), sent, sentClocks: at(3000), wholeRecord: true });
    expect(whole).toMatchObject({ applied: [], lost: ['updatedAt'], record: { updatedAt: 5000 } });
    const replay = merge({ stored, storedClocks: at(5000), sent: stored, sentClocks: at(5000), wholeRecord: true });
    expect(replay.lost).toEqual([]);
    // With fields, nothing it sent holds another value: applied.
    expect(merge({ stored, storedClocks: at(5000), sent, sentClocks: { notes: 3000 } }).lost).toEqual([]);
  });

  it('an insert writes the whole record, whatever its fields name', () => {
    const result = merge({ stored: undefined, sent: asset({ updatedAt: 3000, notes: 'n' }), sentClocks: {} });
    expect(result.applied).toEqual(expect.arrayContaining(['notes', 'deletedAt', 'purgedAt']));
    expect(result).toMatchObject({ clocks: at(3000), lost: [], record: { notes: 'n', updatedAt: 3000 } });
  });
});
