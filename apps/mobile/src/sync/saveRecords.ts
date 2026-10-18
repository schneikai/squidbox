/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import { collectionsByName, mergeFields, type FieldClocks } from '@squidbox/shared';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { chunk, SQL_BATCH } from './chunk';
import type { SyncDb } from './db/types';
import { enqueueMutations } from './outbox';
import { readByIdMap } from './readByIds';
import { upsertRows } from './upsertRows';

type SavedRecord = { id: string; updatedAt: number; deletedAt?: number | null };

/**
 * A local write: store whole records of a collection and enqueue them for push. Call it inside the
 * transaction that read them, with records already given their next `updatedAt` (see clock.ts).
 * New records are inserted, so an id that already exists fails instead of overwriting that record.
 * The outbox row names the fields that changed from the stored row (sync-design §6); a record that
 * changes none is neither written nor enqueued.
 */
export async function saveRecords<R extends SavedRecord>(
  tx: SyncDb,
  collection: string,
  table: SQLiteTable,
  records: R[],
  { isNew = false } = {},
): Promise<void> {
  const fields = await changedFields(tx, collection, table, records, isNew);
  const changed = records.filter((record) => fields.has(record.id));
  if (changed.length === 0) return;
  if (isNew) for (const batch of chunk(changed, SQL_BATCH)) await tx.insert(table).values(batch as any);
  else await upsertRows(tx, collection, table, changed);
  await enqueueMutations(tx, collection, changed, fields);
}

// The merge fields each record changes from its stored row, widened to their field group; records
// that change none are left out. A field the record leaves out is unchanged.
async function changedFields(
  tx: SyncDb,
  collection: string,
  table: SQLiteTable,
  records: SavedRecord[],
  isNew: boolean,
): Promise<Map<string, FieldClocks>> {
  const descriptor = collectionsByName[collection]!;
  const names = mergeFields(descriptor);
  const ids = records.map((record) => record.id);
  const stored = isNew ? new Map() : await readByIdMap(tx, table, ids);
  const changes = new Map<string, FieldClocks>();
  for (const record of records as (SavedRecord & Record<string, unknown>)[]) {
    const prev = stored.get(record.id);
    const carried = names.filter((name) => record[name] !== undefined);
    const changed = new Set(carried.filter((name) => !prev || !Object.is(prev[name], record[name])));
    for (const group of descriptor.fieldGroups)
      if (group.some((name) => changed.has(name))) for (const name of group) changed.add(name);
    const clocks = carried.filter((name) => changed.has(name)).map((name) => [name, record.updatedAt]);
    if (clocks.length > 0) changes.set(record.id, Object.fromEntries(clocks));
  }
  return changes;
}
