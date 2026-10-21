/* eslint-disable @typescript-eslint/no-explicit-any -- generic over any collection's table */
import {
  collectionsByName,
  mergeFields,
  widenToGroups,
  type CollectionDescriptor,
  type FieldClocks,
} from '@squidbox/shared';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { chunk, SQL_BATCH } from './chunk';
import type { SyncDb } from './db/types';
import { enqueueMutations } from './outbox';
import { upsertRows } from './upsertRows';

type SavedRecord = { id: string; updatedAt: number; deletedAt?: number | null };
type StoredRow = { id: string } & Record<string, any>;

/**
 * A local write: store whole records of a collection and enqueue them for push. Call it inside the
 * transaction that read them, with records already given their next `updatedAt` (see clock.ts).
 * - `isNew`: the records are inserted, so an id that already exists fails instead of overwriting it.
 * - `previous`: the stored rows the records were made from (one missing counts as new); the outbox
 *   row names the fields that changed from it, and a record that changes none isn't saved.
 * - `clocks`: the changed fields of each record with their own clocks (an edit replayed from another
 *   library's outbox).
 * Field groups are widened either way (sync-design §6).
 */
export async function saveRecords<R extends SavedRecord>(
  tx: SyncDb,
  collection: string,
  table: SQLiteTable,
  records: R[],
  saved: { isNew: true } | { previous: StoredRow[] } | { clocks: Map<string, FieldClocks> },
): Promise<void> {
  const descriptor = collectionsByName[collection]!;
  const fields =
    'clocks' in saved
      ? new Map([...saved.clocks].map(([id, clocks]) => [id, widenToGroups(descriptor, clocks)]))
      : changedFields(
          descriptor,
          records,
          new Map(('previous' in saved ? saved.previous : []).map((row) => [row.id, row])),
        );
  const changed = records.filter((record) => fields.has(record.id));
  if (changed.length === 0) return;
  if ('isNew' in saved) for (const batch of chunk(changed, SQL_BATCH)) await tx.insert(table).values(batch as any);
  else await upsertRows(tx, collection, table, changed);
  await enqueueMutations(tx, collection, changed, fields);
}

// The merge fields each record changes from its previous row, at the record's updatedAt, widened to
// their field groups; records that change none are left out. A field the record leaves out is unchanged.
function changedFields(
  descriptor: CollectionDescriptor,
  records: readonly SavedRecord[],
  previous: Map<string, StoredRow>,
): Map<string, FieldClocks> {
  const names = mergeFields(descriptor);
  const changes = new Map<string, FieldClocks>();
  for (const record of records) {
    const prev = previous.get(record.id);
    const value = (name: string) => (record as Record<string, unknown>)[name];
    const changed = names.filter((name) => value(name) !== undefined && (!prev || !Object.is(prev[name], value(name))));
    if (changed.length > 0)
      changes.set(
        record.id,
        widenToGroups(descriptor, Object.fromEntries(changed.map((name) => [name, record.updatedAt]))),
      );
  }
  return changes;
}
