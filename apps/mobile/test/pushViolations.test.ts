import type { PushMutation, PushResult } from '@squidbox/shared';
import { describe, it, expect } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { pushViolations } from './helpers/pushViolations';

const record = makeAssetRecord({ notes: 'first light' });
const where = `assets ${record.id}`;

// One push of `pushed` that got `status`, judged against the server row `row`.
function judge(
  status: PushResult['status'],
  pushed: PushMutation,
  row: Record<string, unknown>,
  current: Record<string, unknown> = row,
) {
  const result = { id: record.id, collection: 'assets', status, current } as PushResult;
  return pushViolations([pushed], [result], async () => new Map([[record.id, row]]));
}
const notesEdit = (notes: string): PushMutation => ({
  collection: 'assets',
  record: { ...record, updatedAt: 2000, notes },
  fields: { notes: 2000 },
});
const whole: PushMutation = { collection: 'assets', record };

describe('pushViolations', () => {
  it('an applied push whose row lost a field it merged is a violation', async () => {
    expect(await judge('applied', notesEdit('dusk'), { ...record, notes: 'first light' })).toEqual([
      `${where}: applied, but lost notes`,
    ]);
  });

  it('an applied push into a row that holds a purge it did not push is a violation', async () => {
    const row = { ...record, updatedAt: 3000, notes: 'dusk', deletedAt: 3000, purgedAt: 3000 };
    expect(await judge('applied', notesEdit('dusk'), row)).toEqual([
      `${where}: applied, but its row holds another purge`,
    ]);
  });

  it('an applied push whose row holds every merged field and its purge is not a violation', async () => {
    const purged = { ...record, updatedAt: 3000, deletedAt: 3000, purgedAt: 3000 };
    const purge = { collection: 'assets', record: purged, fields: { deletedAt: 3000, purgedAt: 3000 } };
    expect(await judge('applied', purge, purged)).toEqual([]);
  });

  it('a skipped-lww push with fields whose every field holds is a violation, even when its row ended newer', async () => {
    const pushed = notesEdit('dusk');
    expect(await judge('skipped-lww', pushed, { ...pushed.record, updatedAt: 5000 })).toEqual([
      `${where}: skipped-lww, but every pushed field holds`,
    ]);
  });

  it('a skipped-lww push with fields that lost one of them, carrying the row as current, is not a violation', async () => {
    expect(await judge('skipped-lww', notesEdit('dusk'), { ...record, updatedAt: 3000, notes: 'noon' })).toEqual([]);
  });

  it('a skipped-lww whole record whose row ended newer is not a violation', async () => {
    expect(await judge('skipped-lww', whole, { ...record, updatedAt: 5000 })).toEqual([]);
  });

  it('a skipped-lww whole record whose row is not newer and holds every field is a violation', async () => {
    expect(await judge('skipped-lww', whole, { ...record })).toEqual([
      `${where}: skipped-lww, but every pushed field holds`,
    ]);
  });

  it("a skipped-lww push whose current isn't the server row is a violation", async () => {
    const row = { ...record, updatedAt: 3000, notes: 'noon' };
    expect(await judge('skipped-lww', notesEdit('dusk'), row, { ...row, notes: 'dusk' })).toEqual([
      `${where}: skipped-lww current is not the server row`,
    ]);
  });
});
