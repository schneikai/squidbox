import { and, eq } from 'drizzle-orm';
import type { ClientDb } from './db/client';
import { schema } from './db/client';

type Tx = ClientDb | Parameters<Parameters<ClientDb['transaction']>[0]>[0];

// Enqueue a whole-record mutation, coalesced to one row per (collection, recordId): the latest
// payload wins (sync-design §6). `op` is 'delete' when the record is tombstoned, else 'upsert'.
export async function enqueueMutation(
  tx: Tx,
  collection: string,
  record: { id: string; updatedAt: number; deletedAt?: number | null },
): Promise<void> {
  const op = record.deletedAt != null ? 'delete' : 'upsert';
  await tx
    .insert(schema.outbox)
    .values({ collection, recordId: record.id, op, payload: record as Record<string, unknown>, updatedAt: record.updatedAt })
    .onConflictDoUpdate({
      target: [schema.outbox.collection, schema.outbox.recordId],
      set: { op, payload: record as Record<string, unknown>, updatedAt: record.updatedAt },
    });
}

export async function pendingRecordIds(db: ClientDb, collection: string): Promise<Set<string>> {
  const rows = await db
    .select({ recordId: schema.outbox.recordId })
    .from(schema.outbox)
    .where(eq(schema.outbox.collection, collection));
  return new Set(rows.map((r) => r.recordId));
}

export async function clearOutboxRow(db: ClientDb, collection: string, recordId: string): Promise<void> {
  await db
    .delete(schema.outbox)
    .where(and(eq(schema.outbox.collection, collection), eq(schema.outbox.recordId, recordId)));
}
