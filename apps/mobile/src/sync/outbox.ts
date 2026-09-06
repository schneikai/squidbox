import { and, eq } from 'drizzle-orm';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';

// Enqueue a whole-record mutation, coalesced to one row per (collection, recordId): the latest
// payload wins (sync-design §6). `op` is 'delete' when the record is tombstoned, else 'upsert'.
// SYNCHRONOUS (.run()) — always called inside a sync SQLite transaction (see the repository).
export function enqueueMutation(
  tx: SyncDb,
  collection: string,
  record: { id: string; updatedAt: number; deletedAt?: number | null },
): void {
  const op = record.deletedAt != null ? 'delete' : 'upsert';
  tx.insert(schema.outbox)
    .values({ collection, recordId: record.id, op, payload: record as Record<string, unknown>, updatedAt: record.updatedAt })
    .onConflictDoUpdate({
      target: [schema.outbox.collection, schema.outbox.recordId],
      set: { op, payload: record as Record<string, unknown>, updatedAt: record.updatedAt },
    })
    .run();
}

export async function pendingRecordIds(db: SyncDb, collection: string): Promise<Set<string>> {
  const rows = await db
    .select({ recordId: schema.outbox.recordId })
    .from(schema.outbox)
    .where(eq(schema.outbox.collection, collection));
  return new Set(rows.map((r) => r.recordId));
}

/** Current outbox row's updatedAt for a record, or null if none pending. */
export async function getOutboxUpdatedAt(
  db: SyncDb,
  collection: string,
  recordId: string,
): Promise<number | null> {
  const [row] = await db
    .select({ updatedAt: schema.outbox.updatedAt })
    .from(schema.outbox)
    .where(and(eq(schema.outbox.collection, collection), eq(schema.outbox.recordId, recordId)));
  return row?.updatedAt ?? null;
}

export async function clearOutboxRow(db: SyncDb, collection: string, recordId: string): Promise<void> {
  await db
    .delete(schema.outbox)
    .where(and(eq(schema.outbox.collection, collection), eq(schema.outbox.recordId, recordId)));
}
