import { and, eq, inArray, sql } from 'drizzle-orm';

import { chunk, SQL_BATCH } from './chunk';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { localOnlyKeys } from './localOnlyKeys';

// Enqueue whole-record mutations, coalesced to one row per (collection, recordId): the latest
// payload wins (sync-design §6). `op` is 'delete' for a tombstone, else 'upsert'. The payload leaves
// out the collection's local-only fields. Called inside the transaction that writes the records.
export async function enqueueMutations(
  tx: SyncDb,
  collection: string,
  records: { id: string; updatedAt: number; deletedAt?: number | null }[],
): Promise<void> {
  const localOnly = localOnlyKeys(collection);
  for (const batch of chunk(records, SQL_BATCH)) {
    await tx
      .insert(schema.outbox)
      .values(
        batch.map((record) => ({
          collection,
          recordId: record.id,
          op: record.deletedAt != null ? ('delete' as const) : ('upsert' as const),
          payload: withoutKeys(record, localOnly),
          updatedAt: record.updatedAt,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.outbox.collection, schema.outbox.recordId],
        set: { op: sql`excluded."op"`, payload: sql`excluded."payload"`, updatedAt: sql`excluded."updated_at"` },
      });
  }
}

function withoutKeys(record: object, keys: Set<string>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...record };
  for (const key of keys) delete copy[key];
  return copy;
}

export async function pendingRecordIds(db: SyncDb, collection: string): Promise<Set<string>> {
  const rows = await db
    .select({ recordId: schema.outbox.recordId })
    .from(schema.outbox)
    .where(eq(schema.outbox.collection, collection));
  return new Set(rows.map((r) => r.recordId));
}

/** The outbox rows' updatedAt of these records, by record id; records without a pending row are left out. */
export async function outboxUpdatedAts(
  db: SyncDb,
  collection: string,
  recordIds: string[],
): Promise<Map<string, number>> {
  const updatedAts = new Map<string, number>();
  for (const batch of chunk(recordIds, SQL_BATCH)) {
    const rows = await db
      .select({ recordId: schema.outbox.recordId, updatedAt: schema.outbox.updatedAt })
      .from(schema.outbox)
      .where(and(eq(schema.outbox.collection, collection), inArray(schema.outbox.recordId, batch)));
    for (const row of rows) updatedAts.set(row.recordId, row.updatedAt);
  }
  return updatedAts;
}

export async function clearOutboxRows(db: SyncDb, collection: string, recordIds: string[]): Promise<void> {
  for (const batch of chunk(recordIds, SQL_BATCH)) {
    await db
      .delete(schema.outbox)
      .where(and(eq(schema.outbox.collection, collection), inArray(schema.outbox.recordId, batch)));
  }
}
